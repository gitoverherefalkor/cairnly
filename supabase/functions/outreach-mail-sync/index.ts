// outreach-mail-sync — the brains behind n8n WF11 "Outreach Mail Sync".
//
// n8n does the Gmail I/O (it holds the OAuth credential); this function does
// everything that should live in git: matching a message to a bureau,
// deduplicating, deciding what a sent mail means for the pipeline, reading a
// reply with Claude, minting a test code when asked, and logging it all in
// outreach_mails. Nothing here sends mail.
//
// Since the control center (2026-09-24, docs/superpowers/specs/2026-09-24-
// outreach-control-center-design.md) an answer is no longer a Gmail draft. It
// is a CONCEPT in outreach_concepts, shown open in /ops. What happens to an
// incoming mail is decided by routeInbound():
//   bounce          → address marked broken, everything for the agency cancelled
//   stop            → they asked not to be mailed: nothing, ever again
//   ignore          → out-of-office; chases keep their cadence
//   auto_rejection  → the rejection boilerplate, auto-approved when the switch is on
//   review          → a Claude-written concept for Sjoerd, and a push ping
// Any new mail from them, or a mail Sjoerd sent from Gmail himself, makes the
// concepts written before it stale ('verouderd').
//
// Actions (POST, x-shared-secret = N8N_SHARED_SECRET):
//   { action?: 'sync', messages: GmailItem[] } → { processed, skipped, drafts: [] }
//   { action: 'draft_created', ... }           → { ok: true }   (legacy, WF11's idle branch)
//
// `drafts` is always empty now, so WF11's "create draft" branch has nothing
// to do and needs no change.

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
import { isBounce, routeInbound, type Route } from '../_shared/outreachRouting.ts';
import { templateRejection } from '../_shared/outreachRejection.ts';
import { MAX_WORDS, validateOutgoing } from '../_shared/outreachValidate.ts';
import {
  autoApproveOn,
  cancelAllForSlug,
  insertConcept,
  invalidateForSlug,
  REPLY_DELAY_AUTO,
} from '../_shared/outreachConcepts.ts';
import { notifyPush, OPS_OUTREACH_URL } from '../_shared/opsPush.ts';
import { claudeToolCall } from '../_shared/outreachClaude.ts';

const SNIPPET_MAX = 400;
const BODY_MAX = 20000;
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

const reSubject = (s: string) => (/^re:/i.test(s) ? s : `Re: ${s}`.trim());

// ─── Claude ──────────────────────────────────────────────────────────────────

async function classifyWithClaude(userMessage: string): Promise<Classification | null> {
  return parseClassification(await claudeToolCall(SYSTEM_PROMPT, userMessage, CLASSIFY_TOOL, 1200));
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

  const autoOn = await autoApproveOn(supabase);

  // 5. Process in order.
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
      body_text: direction === 'in' ? replyBodyOnly(mail.text, BODY_MAX) : mail.text.slice(0, BODY_MAX),
      rfc_message_id: mail.messageId,
      sent_at: mail.date,
      status_voor: statusBefore,
    };

    let statusAfter: string | null = statusBefore;
    // What to do after the mail row exists (a concept needs its id).
    let afterInsert: ((mailId: string) => Promise<void>) | null = null;

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
      // Ours (sent from the queue) or Sjoerd's own from Gmail? The queue stamps
      // its own Message-ID on the concept before sending.
      const ours = mail.messageId
        ? (await supabase.from('outreach_concepts').select('id, status').eq('rfc_message_id', mail.messageId).maybeSingle()).data
        : null;
      if (ours) {
        if (ours.status !== 'verzonden') {
          await supabase
            .from('outreach_concepts')
            .update({ status: 'verzonden', verzonden_op: mail.date, updated_at: new Date().toISOString() })
            .eq('id', ours.id);
        }
      } else {
        // Sjoerd answered from Gmail directly: whatever was prepared is spent.
        await invalidateForSlug(supabase, slug, 'Sjoerd mailde zelf vanuit Gmail');
      }
    } else {
      row.kind = 'reactie';
      const ourLast = [...history].reverse().find((h) => h.direction === 'out')?.snippet ?? null;
      const codeIssued = CODE_ISSUED_FROM.has(prospect.status);
      const replyOnly = replyBodyOnly(mail.text);
      const bounce = isBounce({ from: mail.from, subject: mail.subject, contentType: mail.contentType });

      let cls: Classification | null = null;
      if (bounce) {
        cls = { sentiment: 'auto', samenvatting: 'Bounce: adres onbestelbaar.', concept: null };
        row.sentiment = 'bounce';
      } else if (looksAutomatic(mail)) {
        cls = { sentiment: 'auto', samenvatting: 'Automatisch antwoord.', concept: null };
      } else {
        try {
          cls = await classifyWithClaude(
            buildUserMessage({
              bureau: prospect.naam ?? slug,
              contactpersoon: prospect.contactpersoon,
              ourLastMail: ourLast,
              reply: replyOnly,
              replySubject: mail.subject,
              codeIssued,
            }),
          );
        } catch (e) {
          console.error('[outreach-mail-sync] classify failed for', mail.id, e);
        }
      }

      const route: Route = routeInbound({
        bounce,
        sentiment: cls?.sentiment ?? null,
        replyOnly,
        statusBefore,
      });

      if (cls) {
        if (!bounce) row.sentiment = cls.sentiment;
        row.samenvatting = cls.samenvatting;
      } else {
        row.samenvatting = 'Niet geclassificeerd (AI-fout). Lees de mail zelf.';
      }

      // The status ladder moves as before; only the concept handling is new.
      let body = cls?.concept ?? null;
      const target = cls && !bounce ? statusForSentiment(cls.sentiment) : null;
      if (target === 'code_request') {
        if (codeIssued) {
          if (body) body = body.replaceAll(CODELINK_TOKEN, '').replace(/\n{3,}/g, '\n\n');
        } else {
          const { data, error } = await supabase.rpc('outreach_code_request', { p_slug: slug, p_lang: 'nl' });
          if (error || !data || typeof data !== 'object' || !(data as Json).link) {
            console.error('[outreach-mail-sync] code request failed for', slug, error);
            row.samenvatting = `${cls?.samenvatting ?? ''} (code minten mislukt, link zelf invullen)`.trim();
          } else {
            const link = String((data as Json).link);
            if (body) body = body.includes(CODELINK_TOKEN) ? body.replaceAll(CODELINK_TOKEN, link) : `${body}\n\n${link}`;
          }
        }
      } else if (target) {
        const { error } = await supabase.rpc('outreach_advance_status', { p_slug: slug, p_status: target, p_at: mail.date });
        if (error) throw error;
      }

      const bureau = prospect.naam ?? slug;
      const replyBase = {
        slug,
        soort: 'reply' as const,
        to_email: mail.from,
        subject: reSubject(mail.subject || 'Vraagje'),
        thread_id: mail.threadId,
        in_reply_to: mail.messageId,
        references_hdr: [mail.references, mail.messageId].filter(Boolean).join(' ') || null,
      };

      if (route === 'bounce') {
        await supabase
          .from('outreach_prospects')
          .update({ email_ongeldig_op: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('slug', slug);
        await cancelAllForSlug(supabase, slug, 'Bounce: het adres bestaat niet');
        afterInsert = async () => {
          await notifyPush(supabase, 'bounce', slug, {
            title: `Bounce: ${bureau}`,
            body: `Mail naar ${prospect.to_email ?? 'het adres'} kwam terug. Adres nakijken in /ops.`,
            url: OPS_OUTREACH_URL,
            tag: `bounce-${slug}`,
          });
        };
      } else if (route === 'stop') {
        await supabase
          .from('outreach_prospects')
          .update({ niet_mailen_op: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('slug', slug);
        await cancelAllForSlug(supabase, slug, 'Wil geen mail meer');
      } else if (route === 'auto_rejection') {
        await invalidateForSlug(supabase, slug, 'Nieuwe mail van het bureau');
        const rejection = templateRejection({ bureau, replierName: mail.fromName, codeIssued });
        afterInsert = async (mailId) => {
          await insertConcept(
            supabase,
            {
              ...replyBase,
              body: rejection,
              skeleton: rejection,
              variant: codeIssued ? 'rejection_after_code' : 'rejection',
              basis: { status: 'afgewezen', answers: mailId },
              answers_mail_id: mailId,
              validatie: validateOutgoing(rejection, { soort: 'reply', expectedSalutation: null, maxWords: MAX_WORDS.reply }),
            },
            { autoApprove: autoOn, replyDelay: REPLY_DELAY_AUTO },
          );
        };
      } else if (route === 'review') {
        await invalidateForSlug(supabase, slug, 'Nieuwe mail van het bureau');
        const text = body ?? '';
        afterInsert = async (mailId) => {
          await insertConcept(
            supabase,
            {
              ...replyBase,
              body: text,
              basis: { status: statusAfter, answers: mailId },
              answers_mail_id: mailId,
              validatie: text
                ? validateOutgoing(text, { soort: 'reply', expectedSalutation: null, maxWords: MAX_WORDS.reply })
                : { ok: false, problems: ['Generation failed: write this one yourself.'] },
            },
            { autoApprove: false },
          );
          await notifyPush(
            supabase,
            'reply',
            mailId,
            {
              title: `${bureau} replied`,
              body: String(row.samenvatting ?? 'New reply waiting in /ops.'),
              url: OPS_OUTREACH_URL,
              tag: `reply-${slug}`,
            },
            { quietHours: true },
          );
        };
      }
      // 'ignore' (out-of-office): nothing. Chases keep their cadence.

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

    // A concept or ping is only worth making for a mail we logged just now;
    // a duplicate from an overlapping run was handled by that run.
    if (afterInsert && inserted?.id) {
      try {
        await afterInsert(inserted.id as string);
      } catch (e) {
        console.error('[outreach-mail-sync] concept step failed for', slug, e);
      }
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

  return { processed, skipped, drafts: [] };
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

    // WF11 still has a "draft created" branch; it never fires now that
    // `drafts` is always empty, but an old run in flight must not error.
    if (action === 'draft_created') return json({ ok: true, legacy: true });

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('[outreach-mail-sync]', action, e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
