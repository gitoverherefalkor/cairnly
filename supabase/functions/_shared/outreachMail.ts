// Outreach mail sync: the pure parts.
//
// Everything here is deterministic and unit-tested (outreachMail.test.ts):
// turning an n8n Gmail item into a small normalised message, finding the
// bureau it belongs to, and deciding what an outbound mail means for the
// pipeline. The edge function (outreach-mail-sync) does the I/O around it.

/** The two addresses Sjoerd sends outreach from. Lowercase. */
export const OUR_ADDRESSES = new Set(['sjoerd@cairnly.io', 'sjoerd@bethehitl.com']);

export interface NormalisedMail {
  id: string;
  threadId: string;
  /** Sender address, lowercase. */
  from: string;
  /** To + Cc addresses, lowercase, deduplicated. */
  to: string[];
  subject: string;
  /** ISO instant. */
  date: string;
  /** Plain text body, best effort. */
  text: string;
  snippet: string;
  labelIds: string[];
}

export interface ProspectLite {
  slug: string;
  to_email: string | null;
  domain: string | null;
  alt_domain: string | null;
}

export type Direction = 'out' | 'in';
export type OutboundKind = 'eerste' | 'opvolging' | 'antwoord';

// ─── Normalising the Gmail payload ───────────────────────────────────────────

const ADDR_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Every address found in a string / mailparser AddressObject / array of those. */
export function addressesOf(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return (v.match(ADDR_RE) ?? []).map((a) => a.toLowerCase());
  if (Array.isArray(v)) return v.flatMap(addressesOf);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.value)) {
      return (o.value as Array<Record<string, unknown>>)
        .map((e) => String(e.address ?? ''))
        .filter(Boolean)
        .map((a) => a.toLowerCase());
    }
    if (typeof o.address === 'string') return [o.address.toLowerCase()];
    if (typeof o.text === 'string') return addressesOf(o.text);
  }
  return [];
}

/** Rough HTML → text, enough for matching and for the classifier. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>/gi, ' $1 ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isoDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v).toISOString();
  const s = String(v);
  // Gmail internalDate is epoch milliseconds as a string.
  if (/^\d{12,14}$/.test(s)) return new Date(Number(s)).toISOString();
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Accepts what the n8n Gmail node emits in either mode (`simple` on or off)
 * and what the Gmail REST API returns, and returns one flat shape. Returns
 * null when the item has no id or no usable date.
 */
export function normaliseGmailItem(raw: unknown): NormalisedMail | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '');
  if (!id) return null;

  const date = isoDate(r.date) ?? isoDate(r.internalDate) ?? isoDate(r.Date);
  if (!date) return null;

  const from = addressesOf(r.from ?? r.From)[0] ?? '';
  const to = Array.from(new Set([...addressesOf(r.to ?? r.To), ...addressesOf(r.cc ?? r.Cc)]));

  let text = typeof r.text === 'string' ? r.text : '';
  if (!text.trim() && typeof r.html === 'string') text = htmlToText(r.html);
  if (!text.trim() && typeof r.textAsHtml === 'string') text = htmlToText(r.textAsHtml);
  if (!text.trim() && typeof r.snippet === 'string') text = r.snippet;

  let labelIds: string[] = [];
  if (Array.isArray(r.labelIds)) labelIds = r.labelIds.map(String);
  else if (Array.isArray(r.labels)) {
    labelIds = (r.labels as Array<Record<string, unknown>>).map((l) => String(l.id ?? l.name ?? '')).filter(Boolean);
  }

  return {
    id,
    threadId: String(r.threadId ?? id),
    from,
    to,
    subject: String(r.subject ?? r.Subject ?? '').trim(),
    date,
    text: text.trim(),
    snippet: String(r.snippet ?? '').trim() || text.trim().slice(0, 200),
    labelIds,
  };
}

// ─── Direction and matching ──────────────────────────────────────────────────

export function directionOf(mail: Pick<NormalisedMail, 'from'>): Direction {
  return OUR_ADDRESSES.has(mail.from) ? 'out' : 'in';
}

const SLUG_RE = /utm_content(?:=|%3D|%253D)([a-z0-9-]+)/i;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * The slug from a `utm_content=` in the body. Gmail rewrites links through
 * google.com/url and URL-encodes the original, sometimes twice, so try the raw
 * text and then two rounds of decoding.
 */
export function slugFromBody(text: string): string | null {
  let s = text;
  for (let i = 0; i < 3; i++) {
    const m = SLUG_RE.exec(s);
    if (m) return m[1].toLowerCase();
    const next = safeDecode(s);
    if (next === s) break;
    s = next;
  }
  return null;
}

const domainOf = (addr: string) => addr.split('@')[1]?.toLowerCase() ?? '';

/**
 * Which bureau a mail belongs to. First hit wins:
 *  1. utm_content in the body (our own mails carry the demo link);
 *  2. the counterpart address equals the prospect's to_email;
 *  3. the counterpart domain equals domain / alt_domain;
 *  4. the thread is already known.
 * Returns null when nothing matches; such mails are ignored.
 */
export function matchProspect(
  mail: NormalisedMail,
  direction: Direction,
  prospects: ProspectLite[],
  threadSlugs: Map<string, string>,
): string | null {
  const fromBody = slugFromBody(mail.text);
  if (fromBody && prospects.some((p) => p.slug === fromBody)) return fromBody;

  const counterparts = direction === 'out' ? mail.to : [mail.from];
  const cpSet = new Set(counterparts.filter((a) => !OUR_ADDRESSES.has(a)));

  for (const p of prospects) {
    if (p.to_email && cpSet.has(p.to_email.toLowerCase())) return p.slug;
  }
  const cpDomains = new Set(Array.from(cpSet).map(domainOf).filter(Boolean));
  for (const p of prospects) {
    const d = p.domain?.toLowerCase();
    const alt = p.alt_domain?.toLowerCase();
    if ((d && cpDomains.has(d)) || (alt && cpDomains.has(alt))) return p.slug;
  }

  return threadSlugs.get(mail.threadId) ?? null;
}

// ─── What an outbound mail means ─────────────────────────────────────────────

export interface PriorMail {
  gmail_thread_id: string;
  direction: Direction;
  kind: string;
  sent_at: string;
}

/**
 * Classify our own mail to a bureau, given everything logged for that bureau
 * before it (DB rows plus earlier messages in the same batch).
 *
 *  - a mail in a thread where the bureau already wrote to us = `antwoord`,
 *    no status change;
 *  - otherwise the n-th touch: 1 = `eerste` (verzonden), 2 = `opvolging`
 *    (opvolging_1), 3+ = `opvolging` (opvolging_2).
 */
export function classifyOutbound(
  mail: Pick<NormalisedMail, 'threadId' | 'date'>,
  prior: PriorMail[],
): { kind: OutboundKind; status: 'verzonden' | 'opvolging_1' | 'opvolging_2' | null } {
  const at = Date.parse(mail.date);
  const repliedBefore = prior.some(
    (m) => m.direction === 'in' && m.gmail_thread_id === mail.threadId && Date.parse(m.sent_at) < at,
  );
  if (repliedBefore) return { kind: 'antwoord', status: null };

  const touches = prior.filter(
    (m) => m.direction === 'out' && (m.kind === 'eerste' || m.kind === 'opvolging') && Date.parse(m.sent_at) < at,
  ).length;
  if (touches === 0) return { kind: 'eerste', status: 'verzonden' };
  if (touches === 1) return { kind: 'opvolging', status: 'opvolging_1' };
  return { kind: 'opvolging', status: 'opvolging_2' };
}

// ─── Inbound helpers ─────────────────────────────────────────────────────────

const AUTO_SUBJECT_RE =
  /automatisch antwoord|automatic reply|auto(?:matic)?[- ]?reply|out of office|afwezig|afwezigheid|niet aanwezig|delivery status|undeliverable|mail delivery/i;

/** Cheap pre-check; the classifier makes the final call. */
export function looksAutomatic(mail: Pick<NormalisedMail, 'subject' | 'from'>): boolean {
  if (AUTO_SUBJECT_RE.test(mail.subject)) return true;
  return /^(no-?reply|noreply|mailer-daemon|postmaster)@/i.test(mail.from);
}

/**
 * The part the person actually typed: cut quoted history ("Op ... schreef",
 * "From:", "> ") and cap the length so the classifier reads the reply, not
 * our own mail echoed back.
 */
export function replyBodyOnly(text: string, max = 4000): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const l = line.trim();
    if (/^(op|on) .{6,80} (schreef|wrote)/i.test(l)) break;
    if (/^-{2,}\s*(original message|oorspronkelijk bericht)/i.test(l)) break;
    if (/^(from|van|de):\s.+@/i.test(l)) break;
    if (l.startsWith('>')) continue;
    out.push(line);
  }
  return out.join('\n').trim().slice(0, max);
}
