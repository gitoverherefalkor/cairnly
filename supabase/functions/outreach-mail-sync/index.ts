// outreach-mail-sync — the brains behind n8n WF11 "Outreach Mail Sync".
//
// n8n does the Gmail I/O (it holds the OAuth credential); this function does
// everything that should live in git: matching a message to a bureau,
// deduplicating, deciding what a sent mail means for the pipeline, reading a
// reply with Claude, minting a test code when asked, composing the draft
// answer, and logging it all in outreach_mails. Nothing here sends mail.
//
// Design: docs/superpowers/specs/2026-09-11-outreach-mail-sync-design.md
//
// Actions (POST, x-shared-secret = N8N_SHARED_SECRET):
//   { action?: 'sync', messages: GmailItem[] }
//     → { processed, skipped, drafts: [{ mail_id, thread_id, to, subject, body }] }
//   { action: 'draft_created', mail_id, draft_id }
//     → { ok: true }
//
// A `sync` response also carries the follow-up drafts /ops asked for, mixed in
// with the reply drafts. n8n creates whatever is in `drafts` and hands the id
// back under the same `mail_id` it was given, so the follow-up leg needed no
// workflow change at all: its handle is the string `followup:<slug>` instead
// of an outreach_mails uuid. See draftTarget() below. A check-in (a parked
// reply that went quiet) travels the same way as `checkin:<slug>`, and is the
// one follow-up that is never queued for sending.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';
import { CHECK_IN_CLOSED, isParked } from '../_shared/outreach.ts';
import { textToHtml } from '../_shared/outreachHtml.ts';
import {
  classifyOutbound,
  directionOf,
  looksAutomatic,
  matchProspect,
  normaliseGmailItem,
  replyBodyOnly,
  type NormalisedMail,
  type PriorMail,
  type ProspectLite,
} from '../_shared/outreachMail.ts';
import {
  buildUserMessage,
  CLASSIFY_TOOL,
  CODELINK_TOKEN,
  parseClassification,
  statusForSentiment,
  SYSTEM_PROMPT,
  type Classification,
} from '../_shared/outreachReply.ts';
import {
  buildCheckInMessage,
  buildFollowUpMessage,
  CHECK_IN_SYSTEM_PROMPT,
  FOLLOW_UP_SYSTEM_PROMPT,
  FOLLOW_UP_TOOL,
  parseFollowUp,
  renderFollowUp,
  templateCheckIn,
  type CheckInInput,
  type FollowUpInput,
} from '../_shared/outreachFollowUp.ts';

const MODEL = 'claude-sonnet-5'; // never send `temperature` to sonnet-5
const SNIPPET_MAX = 400;
const MAX_MESSAGES = 300;
/** Statuses at or beyond which a test code exists for the bureau. */
const CODE_ISSUED_FROM = new Set(['codes_gemint', 'pilot_gestart', 'founding_partner']);

type Json = Record<string, unknown>;

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface ProspectRow extends ProspectLite {
  naam: string | null;
  contactpersoon: string | null;
  status: string;
  partner_slug: string | null;
}

interface DraftOut {
  mail_id: string;
  thread_id: string;
  to: string;
  subject: string;
  body: string;
}

/**
 * Every draft is written as plain text and leaves as HTML, so a link can carry
 * a name instead of six utm parameters. One place, so no draft can slip out in
 * the wrong shape, and the Gmail node in WF11 is set to emailType "html" to
 * match. The two settings move together or the drafts arrive as visible markup.
 */
const asHtmlDraft = (d: DraftOut): DraftOut => ({ ...d, body: textToHtml(d.body) });

// ─── Claude ──────────────────────────────────────────────────────────────────

type ClaudeResponse = { content?: Array<{ type: string; name?: string; input?: unknown }> };

/** One forced tool call, retried once on a transient failure. */
async function claudeToolCall(
  system: string,
  userMessage: string,
  tool: { name: string },
  maxTokens: number,
): Promise<ClaudeResponse> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    // sonnet-5 runs adaptive thinking by default and it shares max_tokens
    // with the answer; a forced tool call does not need it.
    thinking: { type: 'disabled' },
  };
  const attempt = async () => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) {
      const text = (await r.text()).slice(0, 500);
      console.error('[outreach-mail-sync] Claude error', r.status, text);
      const err = new Error('claude-api-error') as Error & { retryable?: boolean };
      err.retryable = r.status === 429 || r.status >= 500;
      throw err;
    }
    return await r.json();
  };
  try {
    return await attempt();
  } catch (e) {
    if ((e as { retryable?: boolean }).retryable === false) throw e;
    await new Promise((res) => setTimeout(res, 1500));
    return await attempt();
  }
}

async function classifyWithClaude(userMessage: string): Promise<Classification | null> {
  return parseClassification(await claudeToolCall(SYSTEM_PROMPT, userMessage, CLASSIFY_TOOL, 1200));
}

/**
 * The chase itself. Claude fits the approved skeleton to this agency; if it is
 * unavailable or returns something malformed, the plain skeleton goes out. A
 * template in the Drafts folder beats an empty Drafts folder.
 */
async function writeFollowUp(input: FollowUpInput): Promise<string> {
  try {
    const resp = await claudeToolCall(
      FOLLOW_UP_SYSTEM_PROMPT,
      buildFollowUpMessage(input),
      FOLLOW_UP_TOOL,
      800,
    );
    return parseFollowUp(resp) ?? renderFollowUp(input);
  } catch (e) {
    console.error('[outreach-mail-sync] follow-up generation failed for', input.slug, e);
    return renderFollowUp(input);
  }
}

/**
 * The check-in to a parked reply. Same deal as the chase: Claude may fit the
 * approved skeleton, and a malformed or failed generation falls back to it.
 */
async function writeCheckIn(input: CheckInInput): Promise<string> {
  try {
    const resp = await claudeToolCall(CHECK_IN_SYSTEM_PROMPT, buildCheckInMessage(input), FOLLOW_UP_TOOL, 800);
    return parseFollowUp(resp) ?? templateCheckIn(input);
  } catch (e) {
    console.error('[outreach-mail-sync] check-in generation failed for', input.slug, e);
    return templateCheckIn(input);
  }
}

// ─── Sync ────────────────────────────────────────────────────────────────────

async function sync(supabase: SupabaseClient, rawMessages: unknown[]): Promise<Json> {
  // 1. Normalise, drop what we cannot read, oldest first so touch counts are right.
  const mails = rawMessages
    .slice(0, MAX_MESSAGES)
    .map(normaliseGmailItem)
    .filter((m): m is NormalisedMail => m !== null)
    .filter((m) => !m.labelIds.includes('DRAFT'))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  if (mails.length === 0) return { processed: 0, skipped: 0, drafts: [] };

  // 2. What we already know.
  const ids = mails.map((m) => m.id);
  const threadIds = Array.from(new Set(mails.map((m) => m.threadId)));
  const [prospectsRes, knownRes, threadRes] = await Promise.all([
    supabase
      .from('outreach_prospects')
      .select('slug, naam, contactpersoon, to_email, domain, alt_domain, status, partner_slug'),
    supabase.from('outreach_mails').select('gmail_message_id').in('gmail_message_id', ids),
    supabase.from('outreach_mails').select('gmail_thread_id, slug').in('gmail_thread_id', threadIds),
  ]);
  if (prospectsRes.error) throw prospectsRes.error;
  if (knownRes.error) throw knownRes.error;
  if (threadRes.error) throw threadRes.error;

  const prospects = (prospectsRes.data ?? []) as ProspectRow[];
  const bySlug = new Map(prospects.map((p) => [p.slug, p]));
  const known = new Set((knownRes.data ?? []).map((r) => r.gmail_message_id as string));
  const threadSlugs = new Map<string, string>();
  for (const r of threadRes.data ?? []) {
    if (r.slug) threadSlugs.set(r.gmail_thread_id as string, r.slug as string);
  }

  // 3. Match every new message to a bureau.
  const work: Array<{ mail: NormalisedMail; direction: 'out' | 'in'; slug: string }> = [];
  let skipped = 0;
  for (const mail of mails) {
    if (known.has(mail.id)) {
      skipped++;
      continue;
    }
    const direction = directionOf(mail);
    const slug = matchProspect(mail, direction, prospects, threadSlugs);
    if (!slug) {
      skipped++;
      continue;
    }
    threadSlugs.set(mail.threadId, slug);
    work.push({ mail, direction, slug });
  }
  if (work.length === 0) return { processed: 0, skipped, drafts: [] };

  // 4. Prior mails for the bureaus involved (for touch counts and context).
  const slugs = Array.from(new Set(work.map((w) => w.slug)));
  const priorRes = await supabase
    .from('outreach_mails')
    .select('slug, gmail_thread_id, direction, kind, sent_at, snippet')
    .in('slug', slugs)
    .order('sent_at', { ascending: true });
  if (priorRes.error) throw priorRes.error;
  const prior = new Map<string, Array<PriorMail & { snippet: string | null }>>();
  for (const r of priorRes.data ?? []) {
    const list = prior.get(r.slug as string) ?? [];
    list.push({
      gmail_thread_id: r.gmail_thread_id as string,
      direction: r.direction as 'out' | 'in',
      kind: r.kind as string,
      sent_at: r.sent_at as string,
      snippet: (r.snippet as string | null) ?? null,
    });
    prior.set(r.slug as string, list);
  }

  // 5. Process in order.
  const drafts: DraftOut[] = [];
  let processed = 0;

  for (const { mail, direction, slug } of work) {
    const prospect = bySlug.get(slug);
    if (!prospect) continue;
    const history = prior.get(slug) ?? [];
    const statusBefore = prospect.status;
    const snippet = (mail.snippet || mail.text).slice(0, SNIPPET_MAX);

    const row: Json = {
      gmail_message_id: mail.id,
      gmail_thread_id: mail.threadId,
      slug,
      direction,
      from_email: mail.from || null,
      to_email: mail.to[0] ?? null,
      subject: mail.subject || null,
      snippet,
      sent_at: mail.date,
      status_voor: statusBefore,
    };

    let statusAfter: string | null = statusBefore;
    let draft: DraftOut | null = null;

    if (direction === 'out') {
      const cls = classifyOutbound(mail, history);
      row.kind = cls.kind;
      if (cls.status) {
        const { data, error } = await supabase.rpc('outreach_advance_status', {
          p_slug: slug,
          p_status: cls.status,
          p_at: mail.date,
        });
        if (error) throw error;
        statusAfter = (data as string | null) ?? statusBefore;
      }
      // A mail actually went out to this agency, so any chase we had queued or
      // drafted for them is spent. Gmail drafts never reach this branch (sync
      // drops DRAFT-labelled messages), so this only fires on a real send.
      const { error: clearErr } = await supabase
        .from('outreach_prospects')
        .update({ followup_requested_at: null, followup_draft_id: null })
        .eq('slug', slug)
        .not('followup_requested_at', 'is', null);
      if (clearErr) console.error('[outreach-mail-sync] could not clear the follow-up flag for', slug, clearErr);
    } else {
      row.kind = 'reactie';
      const ourLast = [...history].reverse().find((h) => h.direction === 'out')?.snippet ?? null;
      const codeIssued = CODE_ISSUED_FROM.has(prospect.status);

      let cls: Classification | null = null;
      if (looksAutomatic(mail)) {
        cls = { sentiment: 'auto', samenvatting: 'Automatisch antwoord.', concept: null };
      } else {
        try {
          cls = await classifyWithClaude(
            buildUserMessage({
              bureau: prospect.naam ?? slug,
              contactpersoon: prospect.contactpersoon,
              ourLastMail: ourLast,
              reply: replyBodyOnly(mail.text),
              replySubject: mail.subject,
              codeIssued,
            }),
          );
        } catch (e) {
          console.error('[outreach-mail-sync] classify failed for', mail.id, e);
        }
      }

      if (cls) {
        row.sentiment = cls.sentiment;
        row.samenvatting = cls.samenvatting;
        const target = statusForSentiment(cls.sentiment);
        let body = cls.concept;

        if (target === 'code_request') {
          if (codeIssued) {
            // No second code; the ladder is already at or past codes_gemint.
            if (body) body = body.replaceAll(CODELINK_TOKEN, '').replace(/\n{3,}/g, '\n\n');
          } else {
            const { data, error } = await supabase.rpc('outreach_code_request', { p_slug: slug, p_lang: 'nl' });
            if (error || !data || typeof data !== 'object' || !(data as Json).link) {
              console.error('[outreach-mail-sync] code request failed for', slug, error);
              row.samenvatting = `${cls.samenvatting} (code minten mislukt, link zelf invullen)`;
            } else {
              const link = String((data as Json).link);
              if (body) {
                body = body.includes(CODELINK_TOKEN) ? body.replaceAll(CODELINK_TOKEN, link) : `${body}\n\n${link}`;
              }
            }
          }
        } else if (target) {
          const { error } = await supabase.rpc('outreach_advance_status', {
            p_slug: slug,
            p_status: target,
            p_at: mail.date,
          });
          if (error) throw error;
        }

        if (body) {
          draft = {
            mail_id: '', // filled after insert
            thread_id: mail.threadId,
            to: mail.from,
            subject: /^re:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject}`.trim(),
            body,
          };
        }
      } else {
        row.samenvatting = 'Niet geclassificeerd (AI-fout). Lees de mail zelf.';
      }

      const { data: fresh } = await supabase.from('outreach_prospects').select('status').eq('slug', slug).maybeSingle();
      statusAfter = (fresh?.status as string | undefined) ?? statusBefore;
    }

    row.status_na = statusAfter;

    const { data: inserted, error: insErr } = await supabase
      .from('outreach_mails')
      .upsert(row, { onConflict: 'gmail_message_id', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();
    if (insErr) throw insErr;

    if (draft && inserted?.id) {
      draft.mail_id = inserted.id as string;
      drafts.push(draft);
    }

    // Keep the in-memory view current for the next message of the same bureau.
    history.push({
      gmail_thread_id: mail.threadId,
      direction,
      kind: String(row.kind),
      sent_at: mail.date,
      snippet,
    });
    prior.set(slug, history);
    if (statusAfter) prospect.status = statusAfter;
    processed++;
  }

  return { processed, skipped, drafts };
}

// ─── Follow-up drafts ────────────────────────────────────────────────────────

/** The handle n8n carries for a queued chase. Not a uuid, on purpose: see the file header. */
const FOLLOW_UP_PREFIX = 'followup:';
const draftTarget = (slug: string) => `${FOLLOW_UP_PREFIX}${slug}`;
/** Same idea for a check-in. A different prefix because draft_created must NOT queue it. */
const CHECK_IN_PREFIX = 'checkin:';
const checkInTarget = (slug: string) => `${CHECK_IN_PREFIX}${slug}`;

/** Agencies we may still chase. Anything else that asked for one has moved on. */
const CHASEABLE = new Set(['verzonden', 'opvolging_1']);

/**
 * Turn every "Draft follow-up" click in /ops into a draft for n8n to create.
 *
 * Runs on every sync, including runs with no new mail, because the queue is
 * filled by the dashboard rather than by Gmail. A click in /ops also knocks
 * WF11's sync-now webhook (outreach_sync_wake, debounced), so the draft does
 * not wait for the next sweep. A request on an agency
 * that has meanwhile replied or been closed is dropped rather than written: by
 * the time Sjoerd reads the draft the situation would already have changed.
 */
async function composePendingFollowUps(supabase: SupabaseClient): Promise<DraftOut[]> {
  const { data: pending, error } = await supabase
    .from('outreach_prospects')
    .select('slug, naam, contactpersoon, to_email, status, campaign, openingshaak, partner_slug, reply_dismissed_at')
    .not('followup_requested_at', 'is', null)
    .is('followup_draft_id', null);
  if (error) throw error;
  if (!pending?.length) return [];

  const slugs = pending.map((p) => p.slug as string);
  const [statsRes, mailsRes] = await Promise.all([
    supabase.from('outreach_prospect_stats').select('slug, kliks_bevestigd, dagen_bevestigd').in('slug', slugs),
    supabase
      .from('outreach_mails')
      .select('slug, gmail_thread_id, subject, from_email, to_email, direction, sentiment, snippet, samenvatting, sent_at')
      .in('slug', slugs)
      .order('sent_at', { ascending: false }),
  ]);
  if (statsRes.error) throw statsRes.error;
  if (mailsRes.error) throw mailsRes.error;

  const clicksBySlug = new Map((statsRes.data ?? []).map((r) => [r.slug as string, Number(r.kliks_bevestigd ?? 0)]));
  // How many separate days those clicks fell on: the evidence that decides
  // whether the chase may claim to have seen them look. See templateClicked.
  const clickDaysBySlug = new Map((statsRes.data ?? []).map((r) => [r.slug as string, Number(r.dagen_bevestigd ?? 0)]));
  const lastMail = new Map<string, Record<string, unknown>>();
  for (const m of mailsRes.data ?? []) {
    if (!lastMail.has(m.slug as string)) lastMail.set(m.slug as string, m as Record<string, unknown>);
  }

  const drafts: DraftOut[] = [];
  const stale: string[] = [];

  for (const p of pending) {
    const slug = p.slug as string;
    const status = String(p.status ?? '');
    const last = lastMail.get(slug);

    // A parked reply gets a check-in, addressed to whoever answered (often not
    // the person the first mail went to), in their own thread.
    if (isParked(p.reply_dismissed_at as string | null, last as never)) {
      if (CHECK_IN_CLOSED.has(status) || !last?.from_email) {
        stale.push(slug);
        continue;
      }
      const subject = String(last.subject ?? 'Vraagje over jullie spoor 2-trajecten');
      const body = await writeCheckIn({
        slug,
        bureau: (p.naam as string | null) ?? slug,
        replierName: null,
        theirReply: (last.snippet as string | null) ?? null,
        summary: (last.samenvatting as string | null) ?? null,
        codeIssued: Boolean(p.partner_slug),
      });
      drafts.push({
        mail_id: checkInTarget(slug),
        thread_id: String(last.gmail_thread_id),
        to: String(last.from_email),
        subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
        body,
      });
      continue;
    }

    if (!CHASEABLE.has(status)) {
      stale.push(slug);
      continue;
    }
    if (!last) {
      // Nothing to thread onto. The status says a mail went out, so this is a
      // data problem rather than a normal state; leave the flag for a human.
      console.error('[outreach-mail-sync] follow-up requested but no mail logged for', slug);
      continue;
    }
    const to = (p.to_email as string | null) ?? (last.to_email as string | null);
    if (!to) {
      console.error('[outreach-mail-sync] follow-up requested but no address for', slug);
      continue;
    }

    const subject = String(last.subject ?? 'Vraagje over jullie spoor 2-trajecten');
    const body = await writeFollowUp({
      slug,
      bureau: (p.naam as string | null) ?? slug,
      contactpersoon: (p.contactpersoon as string | null) ?? null,
      step: status === 'verzonden' ? 1 : 2,
      clicks: clicksBySlug.get(slug) ?? 0,
      clickDays: clickDaysBySlug.get(slug) ?? 0,
      openingshaak: (p.openingshaak as string | null) ?? null,
      campaign: (p.campaign as string | null) ?? null,
      codeIssued: Boolean(p.partner_slug),
    });

    drafts.push({
      mail_id: draftTarget(slug),
      thread_id: String(last.gmail_thread_id),
      to,
      subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
      body,
    });
  }

  if (stale.length) {
    const { error: clearErr } = await supabase
      .from('outreach_prospects')
      .update({ followup_requested_at: null })
      .in('slug', stale);
    if (clearErr) console.error('[outreach-mail-sync] could not clear stale follow-ups', clearErr);
  }

  return drafts;
}

/**
 * Put a freshly created chase in the send queue.
 *
 * Chases queue themselves because their content is a skeleton that was signed
 * off once, not per mail. Replies never do: those answer a person who wrote
 * to us, and a human reads them first. That difference is the whole policy,
 * and it lives here rather than in the workflow.
 *
 * The draft is the unit of work — the queue only carries its id, so editing
 * the draft in Gmail changes what ships and deleting it cancels the send.
 *
 * Never fatal. A chase that fails to queue still sits in Drafts, and losing
 * the automation is better than losing the sync that logs the mail.
 */
async function queueChase(
  supabase: SupabaseClient,
  slug: string,
  draftId: string,
  toEmail: string | null,
): Promise<void> {
  const { data: last } = await supabase
    .from('outreach_mails')
    .select('gmail_thread_id, to_email')
    .eq('slug', slug)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('outreach_send_queue').insert({
    slug,
    soort: 'chase',
    draft_id: draftId,
    thread_id: (last?.gmail_thread_id as string | null) ?? null,
    to_email: toEmail ?? (last?.to_email as string | null) ?? null,
    // Chases are on a cadence; a first mail can always wait a slot.
    prioriteit: 1,
  });
  // 23505 is the partial unique index: this draft is already queued, which is
  // exactly what should happen when a sync is retried.
  if (error && error.code !== '23505') {
    console.error('[outreach-mail-sync] could not queue chase for', slug, error);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const action = String(body.action ?? 'sync');

  try {
    if (action === 'sync') {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const result = await sync(supabase, messages);
      // Outside sync() on purpose: the queue is filled by /ops, so it has to be
      // drained on the many runs where Gmail brought nothing new and sync()
      // returns early.
      const followUps = await composePendingFollowUps(supabase);
      const drafts = [...((result.drafts as DraftOut[]) ?? []), ...followUps].map(asHtmlDraft);
      return json({ ...result, drafts, follow_ups: followUps.length });
    }

    if (action === 'draft_created') {
      const mailId = String(body.mail_id ?? '');
      const draftId = String(body.draft_id ?? '');
      if (!mailId || !draftId) return json({ error: 'mail_id and draft_id required' }, 400);

      // Three kinds of draft come back through this one door. A reply hangs off
      // the mail it answers; a chase and a check-in hang off the agency itself.
      //
      // A check-in is recorded exactly like a chase (so /ops shows it waiting in
      // Gmail) but NEVER queued: it answers someone who wrote to us, and those
      // mails always get read by a human before they go.
      if (mailId.startsWith(CHECK_IN_PREFIX)) {
        const slug = mailId.slice(CHECK_IN_PREFIX.length);
        const { data, error } = await supabase
          .from('outreach_prospects')
          .update({ followup_draft_id: draftId, updated_at: new Date().toISOString() })
          .eq('slug', slug)
          .is('followup_draft_id', null)
          .select('slug')
          .maybeSingle();
        if (error) throw error;
        if (!data) console.warn('[outreach-mail-sync] second check-in draft for', slug, draftId);
        return json({ ok: true, slug, check_in: true, duplicate: !data });
      }

      if (mailId.startsWith(FOLLOW_UP_PREFIX)) {
        const slug = mailId.slice(FOLLOW_UP_PREFIX.length);
        // Only the FIRST draft for a request counts. WF11 has several doors now
        // (Gmail Trigger, sweep, sync-now webhook), so two runs can overlap and
        // both write a chase for the same agency. A request always resets
        // followup_draft_id to null, so a non-null value here means this draft
        // is the second one: it stays in Gmail for Sjoerd to delete, but it is
        // never queued, because a queued chase is sent without a human.
        const { data, error } = await supabase
          .from('outreach_prospects')
          .update({ followup_draft_id: draftId, updated_at: new Date().toISOString() })
          .eq('slug', slug)
          .is('followup_draft_id', null)
          .select('slug, to_email')
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          const { data: known } = await supabase.from('outreach_prospects').select('slug').eq('slug', slug).maybeSingle();
          if (!known) return json({ error: 'Unknown prospect' }, 404);
          console.warn('[outreach-mail-sync] second chase draft for', slug, draftId, '- not queued');
          return json({ ok: true, slug, duplicate: true });
        }
        await queueChase(supabase, slug, draftId, (data.to_email as string | null) ?? null);
        return json({ ok: true, slug });
      }

      const { error } = await supabase.from('outreach_mails').update({ draft_id: draftId }).eq('id', mailId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('[outreach-mail-sync]', action, e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
