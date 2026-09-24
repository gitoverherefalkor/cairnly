// Concepts: the database side of "a mail that still has to leave".
//
// Four functions write concepts (outreach-mail-sync for replies,
// outreach-prepare for first mails, chases and check-ins, ops-outreach when
// Sjoerd acts, outreach-send when one goes out). They all go through here so
// the rules around a concept live in one place:
//   - approving a concept and queueing it are one step, never two;
//   - auto-approval needs the switch on AND a passing validator, and always
//     leaves a 60-minute veto window before the mail may leave;
//   - a concept that stopped being true is marked 'verouderd' and its queue
//     row cancelled, never silently rewritten;
//   - an opt-out or a bounce closes everything for that agency.
//
// Spec: docs/superpowers/specs/2026-09-24-outreach-control-center-design.md

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import type { ConceptSoort, ValidationResult } from './outreachValidate.ts';

export type { ConceptSoort };

/** Replies first, then the cadence mail, then new agencies. */
export const PRIORITY: Record<ConceptSoort, number> = { reply: 0, chase: 1, checkin: 1, initial: 2 };

/** Minutes an auto-approved mail stays visible under "Going out" before it may leave. */
export const VETO_MINUTES = 60;
/** Delay before a reply Sjoerd approved goes out, so it does not answer to the second. */
export const REPLY_DELAY_APPROVED: [number, number] = [5, 20];
/** Delay before an automatic rejection reply, so it never answers within minutes. */
export const REPLY_DELAY_AUTO: [number, number] = [60, 180];
/** How long "Send" waits so Undo can still catch it. */
export const UNDO_SECONDS = 15;

const LIVE = ['voorstel', 'ingepland'];

export interface NewConcept {
  slug: string;
  soort: ConceptSoort;
  step?: number | null;
  to_email: string;
  subject: string;
  body: string;
  skeleton?: string | null;
  variant?: string | null;
  basis: Record<string, unknown>;
  thread_id?: string | null;
  in_reply_to?: string | null;
  references_hdr?: string | null;
  answers_mail_id?: string | null;
  validatie: ValidationResult;
}

const randomBetween = ([lo, hi]: [number, number]) => lo + Math.floor(Math.random() * (hi - lo + 1));
const minutesFromNow = (m: number, now = new Date()) => new Date(now.getTime() + m * 60_000).toISOString();

/** Cold mail or reply lane, from the concept kind. */
const isReply = (soort: ConceptSoort) => soort === 'reply';

/**
 * Insert a concept. When `autoApprove` is true and the validator passed, it
 * is approved and queued in the same call. Returns the concept id, or null
 * when a live concept of the same kind already exists for this agency (the
 * partial unique index: someone else got there first, which is fine).
 */
export async function insertConcept(
  db: SupabaseClient,
  c: NewConcept,
  opts: { autoApprove: boolean; replyDelay?: [number, number] } = { autoApprove: false },
): Promise<string | null> {
  const now = new Date();
  const auto = opts.autoApprove && c.validatie.ok;
  const { data, error } = await db
    .from('outreach_concepts')
    .insert({
      slug: c.slug,
      soort: c.soort,
      step: c.step ?? null,
      to_email: c.to_email,
      subject: c.subject,
      body: c.body,
      body_origineel: c.body,
      skeleton: c.skeleton ?? null,
      variant: c.variant ?? null,
      basis: c.basis,
      thread_id: c.thread_id ?? null,
      in_reply_to: c.in_reply_to ?? null,
      references_hdr: c.references_hdr ?? null,
      answers_mail_id: c.answers_mail_id ?? null,
      validatie: c.validatie,
      status: auto ? 'ingepland' : 'voorstel',
      goedgekeurd_door: auto ? 'auto' : null,
      goedgekeurd_op: auto ? now.toISOString() : null,
    })
    .select('id')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  const id = data?.id as string;
  if (auto) {
    const nietVoor = isReply(c.soort)
      ? minutesFromNow(randomBetween(opts.replyDelay ?? REPLY_DELAY_AUTO), now)
      : minutesFromNow(VETO_MINUTES, now);
    await queue(db, id, c, { direct: false, nietVoor });
  }
  return id;
}

async function queue(
  db: SupabaseClient,
  conceptId: string,
  c: Pick<NewConcept, 'slug' | 'soort' | 'thread_id' | 'to_email'>,
  opts: { direct: boolean; nietVoor: string | null },
): Promise<void> {
  const { error } = await db.from('outreach_send_queue').insert({
    slug: c.slug,
    soort: c.soort,
    concept_id: conceptId,
    thread_id: c.thread_id ?? null,
    to_email: c.to_email,
    prioriteit: PRIORITY[c.soort],
    direct: opts.direct,
    niet_voor: opts.nietVoor,
  });
  // The live-row index: already queued, which is what a retry should find.
  if (error && error.code !== '23505') throw error;
}

/**
 * Sjoerd approves a concept: Schedule (direct = false) or Send (direct = true).
 * Send waits UNDO_SECONDS so Undo can still catch it; a scheduled reply waits
 * a few minutes; a scheduled cold mail takes the next free slot. Returns when
 * the mail may leave at the earliest.
 */
export async function approveConcept(
  db: SupabaseClient,
  id: string,
  opts: { direct: boolean },
): Promise<{ niet_voor: string | null }> {
  const { data: c, error } = await db
    .from('outreach_concepts')
    .update({ status: 'ingepland', goedgekeurd_door: 'sjoerd', goedgekeurd_op: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['voorstel', 'verouderd'])
    .select('id, slug, soort, thread_id, to_email')
    .maybeSingle();
  if (error) throw error;
  if (!c) throw new Error('Concept is not waiting for approval (already scheduled, sent or discarded).');

  const soort = c.soort as ConceptSoort;
  const nietVoor = opts.direct
    ? new Date(Date.now() + UNDO_SECONDS * 1000).toISOString()
    : isReply(soort)
      ? minutesFromNow(randomBetween(REPLY_DELAY_APPROVED))
      : null;
  await queue(db, id, { slug: c.slug as string, soort, thread_id: c.thread_id as string | null, to_email: c.to_email as string }, {
    direct: opts.direct,
    nietVoor,
  });
  return { niet_voor: nietVoor };
}

/**
 * Take a scheduled concept back: its queue row is cancelled (only while it
 * has not been claimed) and the concept waits again. Returns false when it is
 * already on its way.
 */
export async function unscheduleConcept(db: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await db
    .from('outreach_send_queue')
    .update({ status: 'cancelled' })
    .eq('concept_id', id)
    .eq('status', 'queued');
  if (error) throw error;
  // A row WF12 already claimed cannot be called back; say so instead of pretending.
  const { data: onItsWay } = await db
    .from('outreach_send_queue')
    .select('id')
    .eq('concept_id', id)
    .in('status', ['sending', 'sent'])
    .limit(1);
  if (onItsWay?.length) return false;
  const { error: cErr } = await db
    .from('outreach_concepts')
    .update({ status: 'voorstel', goedgekeurd_door: null, goedgekeurd_op: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'ingepland');
  if (cErr) throw cErr;
  return true;
}

async function cancelQueueFor(db: SupabaseClient, conceptIds: string[]): Promise<void> {
  if (!conceptIds.length) return;
  const { error } = await db
    .from('outreach_send_queue')
    .update({ status: 'cancelled' })
    .in('concept_id', conceptIds)
    .eq('status', 'queued');
  if (error) throw error;
}

/**
 * Something changed for this agency (they wrote, Sjoerd wrote from Gmail, the
 * status moved): every live concept stops being true. Marked 'verouderd' with
 * the reason, queue rows cancelled. The text is kept, so an edited concept
 * can still be scheduled by hand from /ops.
 */
export async function invalidateForSlug(
  db: SupabaseClient,
  slug: string,
  reason: string,
  opts: { exceptId?: string; soorten?: ConceptSoort[] } = {},
): Promise<number> {
  let q = db
    .from('outreach_concepts')
    .update({ status: 'verouderd', verouderd_reden: reason, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .in('status', LIVE);
  if (opts.exceptId) q = q.neq('id', opts.exceptId);
  if (opts.soorten?.length) q = q.in('soort', opts.soorten);
  const { data, error } = await q.select('id');
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id as string);
  await cancelQueueFor(db, ids);
  return ids.length;
}

/** Opt-out or bounce: everything for this agency is discarded, not merely stale. */
export async function cancelAllForSlug(db: SupabaseClient, slug: string, reason: string): Promise<void> {
  const { data, error } = await db
    .from('outreach_concepts')
    .update({ status: 'weggegooid', verouderd_reden: reason, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .in('status', [...LIVE, 'verouderd'])
    .select('id');
  if (error) throw error;
  await cancelQueueFor(db, (data ?? []).map((r) => r.id as string));
}

/** The auto-approve switch. Off (the launch state) means every concept waits for Sjoerd. */
export async function autoApproveOn(db: SupabaseClient): Promise<boolean> {
  const { data } = await db.from('outreach_send_state').select('auto_goedkeuren').eq('id', true).maybeSingle();
  return Boolean(data?.auto_goedkeuren);
}
