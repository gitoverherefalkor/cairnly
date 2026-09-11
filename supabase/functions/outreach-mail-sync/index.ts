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

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';
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

// ─── Claude ──────────────────────────────────────────────────────────────────

async function classifyWithClaude(userMessage: string): Promise<Classification | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const body = {
    model: MODEL,
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: 'tool', name: CLASSIFY_TOOL.name },
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
  let resp;
  try {
    resp = await attempt();
  } catch (e) {
    if ((e as { retryable?: boolean }).retryable === false) throw e;
    await new Promise((res) => setTimeout(res, 1500));
    resp = await attempt();
  }
  return parseClassification(resp);
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
      return json(await sync(supabase, messages));
    }

    if (action === 'draft_created') {
      const mailId = String(body.mail_id ?? '');
      const draftId = String(body.draft_id ?? '');
      if (!mailId || !draftId) return json({ error: 'mail_id and draft_id required' }, 400);
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
