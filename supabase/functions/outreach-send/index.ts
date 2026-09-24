// Hand n8n one outreach mail that may go out right now, and record what
// happened to it.
//
// Since the control center (2026-09-24) the unit of work is a CONCEPT, not a
// Gmail draft. This function:
//   - claims one queue row through outreach_send_claim() (every pacing rule,
//     per lane, lives in the database; polling harder cannot send more);
//   - re-checks the concept against the facts it assumed when it was written
//     (a chase whose agency replied, clicked, or was closed since is dropped,
//     not sent);
//   - composes the full message (_shared/outreachMime.ts) with a Message-ID
//     it stores on the concept first, so the sync recognises it later;
//   - on 'sent', logs the outbound mail and moves the status ladder at once,
//     without waiting for WF11 to read it back.
//
// Shape (all POST, x-shared-secret, same secret as outreach-mail-sync):
//   { action: 'next' }                                   -> { send: { id, slug, soort, to_email, thread_id, raw } | null, reason? }
//   { action: 'sent', id, gmail_message_id, thread_id? } -> { ok: true }
//   { action: 'failed', id, error }                      -> { ok: true, status }
//
// WF12 "Outreach Send" is knocked by pg_cron (outreach_send_wake) or by
// ops-outreach after a Send; it calls 'next', posts `raw` (+ threadId) to
// Gmail's messages/send, and reports back. Nothing else calls this.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';
import { CHECK_IN_CLOSED } from '../_shared/outreach.ts';
import { classifyOutbound, type PriorMail } from '../_shared/outreachMail.ts';
import { buildMime, newMessageId } from '../_shared/outreachMime.ts';
import { chaseVariant } from '../_shared/outreachFollowUp.ts';
import { notifyPush, OPS_OUTREACH_URL } from '../_shared/opsPush.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Mirrors the agreed ceiling. The database enforces it; this is the dial. Keep equal to the SQL default. */
const MAX_PER_DAG = 8;

type Row = Record<string, unknown>;

interface Concept {
  id: string;
  slug: string;
  soort: 'initial' | 'chase' | 'checkin' | 'reply';
  step: number | null;
  status: string;
  to_email: string;
  subject: string;
  body: string;
  variant: string | null;
  basis: Record<string, unknown>;
  thread_id: string | null;
  in_reply_to: string | null;
  references_hdr: string | null;
  answers_mail_id: string | null;
  goedgekeurd_door: string | null;
  bewerkt_op: string | null;
  created_at: string;
}

const CONCEPT_COLUMNS =
  'id, slug, soort, step, status, to_email, subject, body, variant, basis, thread_id, in_reply_to, references_hdr, answers_mail_id, goedgekeurd_door, bewerkt_op, created_at';

/**
 * Is the concept still true? Returns the reason it is not, or null. The
 * questions differ per kind; the common ones: still approved, and the agency
 * has not asked to be left alone or bounced.
 */
async function staleReason(db: SupabaseClient, c: Concept): Promise<string | null> {
  if (c.status !== 'ingepland') return `concept is ${c.status}, not scheduled`;

  const { data: p } = await db
    .from('outreach_prospects')
    .select('status, niet_mailen_op, email_ongeldig_op')
    .eq('slug', c.slug)
    .maybeSingle();
  if (!p) return 'agency not found';
  if (p.niet_mailen_op) return 'they asked not to be mailed';
  if (p.email_ongeldig_op) return 'their address bounced';

  const { data: mails } = await db
    .from('outreach_mails')
    .select('id, direction, sentiment, sent_at, gmail_thread_id')
    .eq('slug', c.slug)
    .order('sent_at', { ascending: false })
    .limit(20);
  const list = mails ?? [];
  const personIn = (m: Row) => m.direction === 'in' && m.sentiment !== 'auto';
  const since = Date.parse(c.created_at);

  switch (c.soort) {
    case 'initial':
      if (p.status !== 'nog_niet_benaderd') return `status is now ${p.status}`;
      return null;

    case 'chase': {
      if (p.status !== c.basis.status) return `status moved from ${c.basis.status} to ${p.status}`;
      if (list.some((m) => personIn(m) && Date.parse(m.sent_at as string) > since)) return 'they wrote since';
      const lastOut = list.find((m) => m.direction === 'out');
      if (lastOut && c.basis.lastOutAt && Date.parse(lastOut.sent_at as string) > Date.parse(String(c.basis.lastOutAt))) {
        return 'another mail went out since';
      }
      // The text claims things about clicks. When a human approved or edited
      // it, that is his call; an auto-approved chase must still match.
      if (c.goedgekeurd_door === 'auto' && !c.bewerkt_op) {
        const { data: s } = await db
          .from('outreach_prospect_stats')
          .select('kliks_bevestigd, dagen_bevestigd')
          .eq('slug', c.slug)
          .maybeSingle();
        const now = chaseVariant({
          step: (c.step === 2 ? 2 : 1),
          clicks: Number(s?.kliks_bevestigd ?? 0),
          clickDays: Number(s?.dagen_bevestigd ?? 0),
        });
        if (now !== c.variant) return `click picture changed (${c.variant} → ${now})`;
      }
      return null;
    }

    case 'checkin':
      if (CHECK_IN_CLOSED.has(p.status as string)) return `status is now ${p.status}`;
      if (list.some((m) => personIn(m) && Date.parse(m.sent_at as string) > since)) return 'they wrote since';
      return null;

    case 'reply': {
      const answered = c.answers_mail_id ? list.find((m) => m.id === c.answers_mail_id) : null;
      const after = answered ? Date.parse(answered.sent_at as string) : since;
      const newer = list.find(
        (m) => personIn(m) && m.id !== c.answers_mail_id && Date.parse(m.sent_at as string) > after &&
          (!c.thread_id || m.gmail_thread_id === c.thread_id),
      );
      if (newer) return 'they wrote again since';
      return null;
    }
  }
}

async function next(db: SupabaseClient) {
  // Claims in the same statement that selects, so two overlapping runs cannot
  // both be handed the same mail.
  const { data, error } = await db.rpc('outreach_send_claim', { p_max_per_dag: MAX_PER_DAG });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  // No row is the normal answer outside the window, over the cap, or inside the gap.
  if (!row) return { send: null };

  if (!row.concept_id) {
    // A legacy draft row. The cutover requires none to exist; refuse rather
    // than hand WF12 something it can no longer send.
    await db
      .from('outreach_send_queue')
      .update({ status: 'cancelled', fout: 'legacy draft row: send it from Gmail by hand', claimed_at: null })
      .eq('id', row.id);
    return { send: null, reason: 'legacy draft row' };
  }

  const { data: concept, error: cErr } = await db
    .from('outreach_concepts')
    .select(CONCEPT_COLUMNS)
    .eq('id', row.concept_id as string)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!concept) {
    await db.from('outreach_send_queue').update({ status: 'cancelled', fout: 'concept missing' }).eq('id', row.id);
    return { send: null, reason: 'concept missing' };
  }
  const c = concept as unknown as Concept;

  const stale = await staleReason(db, c);
  if (stale) {
    await db
      .from('outreach_concepts')
      .update({ status: 'verouderd', verouderd_reden: stale, updated_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('status', 'ingepland');
    await db.from('outreach_send_queue').update({ status: 'cancelled', fout: stale, claimed_at: null }).eq('id', row.id);
    console.log('[outreach-send] dropped stale concept', c.id, c.slug, stale);
    return { send: null, reason: 'stale', detail: stale };
  }

  // A reply quotes the mail it answers, the way Gmail's web client does.
  let quote = null;
  if (c.soort === 'reply' && c.answers_mail_id) {
    const { data: m } = await db
      .from('outreach_mails')
      .select('from_email, sent_at, body_text, snippet')
      .eq('id', c.answers_mail_id)
      .maybeSingle();
    if (m?.from_email) {
      quote = { at: m.sent_at as string, name: null, email: m.from_email as string, text: String(m.body_text ?? m.snippet ?? '') };
    }
  }

  // Stamp the Message-ID before the mail exists, so whoever reads it back
  // (the sync, a later chase) can tie it to this concept.
  const messageId = newMessageId();
  const { error: idErr } = await db.from('outreach_concepts').update({ rfc_message_id: messageId }).eq('id', c.id);
  if (idErr) throw idErr;

  const raw = buildMime({
    to: c.to_email,
    subject: c.subject,
    body: c.body,
    messageId,
    inReplyTo: c.in_reply_to,
    references: c.references_hdr,
    signature: c.soort === 'initial',
    quote,
  });

  return {
    send: { id: row.id, slug: c.slug, soort: c.soort, to_email: c.to_email, thread_id: c.thread_id, raw },
  };
}

/**
 * The mail left. Log it in outreach_mails right away (the sync would do it
 * within the hour; the cockpit and the next chase should not wait) and move
 * the ladder exactly as the sync does for an outbound mail.
 */
async function sent(db: SupabaseClient, id: string, gmailMessageId: string | null, threadId: string | null) {
  const { error } = await db.rpc('outreach_send_done', { p_id: id, p_gmail_message_id: gmailMessageId });
  if (error) throw error;

  const { data: q } = await db.from('outreach_send_queue').select('concept_id, slug').eq('id', id).maybeSingle();
  if (!q?.concept_id) return;
  const { data: c } = await db.from('outreach_concepts').select(CONCEPT_COLUMNS + ', rfc_message_id').eq('id', q.concept_id).maybeSingle();
  if (!c) return;
  const concept = c as unknown as Concept & { rfc_message_id: string | null };
  const now = new Date().toISOString();

  await db.from('outreach_concepts').update({ status: 'verzonden', verzonden_op: now, updated_at: now }).eq('id', concept.id);

  if (!gmailMessageId) return;
  const thread = threadId ?? concept.thread_id ?? gmailMessageId;

  const { data: priorRows } = await db
    .from('outreach_mails')
    .select('gmail_thread_id, direction, kind, sent_at')
    .eq('slug', concept.slug)
    .order('sent_at', { ascending: true });
  const prior = (priorRows ?? []) as PriorMail[];
  const cls = classifyOutbound({ threadId: thread, date: now }, prior);

  const { data: before } = await db.from('outreach_prospects').select('status').eq('slug', concept.slug).maybeSingle();
  let statusAfter = (before?.status as string | undefined) ?? null;
  if (cls.status) {
    const { data, error: advErr } = await db.rpc('outreach_advance_status', { p_slug: concept.slug, p_status: cls.status, p_at: now });
    if (advErr) console.error('[outreach-send] status advance failed', concept.slug, advErr);
    else statusAfter = (data as string | null) ?? statusAfter;
  }

  const { error: insErr } = await db.from('outreach_mails').upsert(
    {
      gmail_message_id: gmailMessageId,
      gmail_thread_id: thread,
      slug: concept.slug,
      direction: 'out',
      kind: cls.kind,
      from_email: 'sjoerd@cairnly.io',
      to_email: concept.to_email,
      subject: concept.subject,
      snippet: concept.body.replace(/\s+/g, ' ').slice(0, 400),
      body_text: concept.body,
      rfc_message_id: concept.rfc_message_id,
      sent_at: now,
      status_voor: before?.status ?? null,
      status_na: statusAfter,
    },
    { onConflict: 'gmail_message_id', ignoreDuplicates: true },
  );
  if (insErr) console.error('[outreach-send] could not log the sent mail', concept.slug, insErr);
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const action = String(body.action ?? 'next');

  try {
    if (action === 'next') return json(await next(supabase));

    if (action === 'sent') {
      const id = String(body.id ?? '');
      if (!id) return json({ error: 'id required' }, 400);
      await sent(
        supabase,
        id,
        body.gmail_message_id ? String(body.gmail_message_id) : null,
        body.thread_id ? String(body.thread_id) : null,
      );
      return json({ ok: true });
    }

    if (action === 'failed') {
      const id = String(body.id ?? '');
      if (!id) return json({ error: 'id required' }, 400);
      const fout = String(body.error ?? 'unknown').slice(0, 500);
      const { error } = await supabase.rpc('outreach_send_failed', { p_id: id, p_fout: fout });
      if (error) throw error;
      // Two tries and then it waits for a human: a mail that keeps failing has
      // something wrong with it, and retrying forever only risks a double send.
      const { data } = await supabase
        .from('outreach_send_queue')
        .select('status, pogingen, slug')
        .eq('id', id)
        .maybeSingle();
      console.error('[outreach-send] send failed for', id, fout);
      if (data?.status === 'failed') {
        await notifyPush(supabase, 'send_failed', id, {
          title: `Mail to ${data.slug} failed`,
          body: fout.slice(0, 140),
          url: OPS_OUTREACH_URL,
          tag: `failed-${data.slug}`,
        });
      }
      return json({ ok: true, status: data?.status ?? null, pogingen: data?.pogingen ?? null });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('[outreach-send]', action, e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
