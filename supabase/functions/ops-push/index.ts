// ops-push — the scheduled pings of the outreach cockpit.
//
// Event pings (a reply that needs Sjoerd, a bounce, a failed send) are sent
// where the event happens (outreach-mail-sync, outreach-send). This function
// holds the ones that run on a clock:
//   digest morning   08:30 working days, only when there is something to say
//   digest afternoon 15:00 working days, only when tomorrow has empty cold
//                    slots AND something could fill them (or supply ran out)
//   alarm            hourly: sending is paused while approved mail is due
//
// pg_cron runs in UTC, so the digest jobs fire at both possible UTC times and
// this function checks the Amsterdam clock itself (20-minute tolerance).
// ops_push_log makes every ping once per day.
//
// POST, x-shared-secret = N8N_SHARED_SECRET (vault 'n8n_shared_secret').
//   { action: 'digest', slot: 'morning' | 'afternoon', force? } → { sent, reason? }
//   { action: 'alarm', force? }                                 → { sent, reason? }
//   { action: 'stuck' }                                         → { sent, stuck }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';
import { notifyPush, OPS_OUTREACH_URL } from '../_shared/opsPush.ts';
import { amsterdamDay, dayCapacity, FIRST_MAILS_PER_DAY, nextWorkingDays } from '../_shared/outreachSchedule.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const SLOTS = { morning: 8 * 60 + 30, afternoon: 15 * 60 } as const;
const TOLERANCE_MIN = 20;
/** Below this many working days of first-mail supply the digest warns. */
const RUNWAY_WARN = 5;

function amsterdamMinutes(now: Date): number {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now);
  const get = (t: string) => Number(f.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface Picture {
  repliesWaiting: number;
  conceptsWaiting: number;
  goingOutToday: number;
  tomorrowEmpty: number;
  tomorrowCapacity: number;
  notContacted: number;
  runwayDays: number | null;
}

/** Everything a digest needs to say, in one read. */
async function picture(db: SupabaseClient, now: Date): Promise<Picture> {
  const [conceptsRes, queueRes, prospectsRes] = await Promise.all([
    db.from('outreach_concepts').select('soort, status').in('status', ['voorstel', 'ingepland']),
    db.from('outreach_send_queue').select('soort, niet_voor, status').eq('status', 'queued'),
    db.from('outreach_prospects').select('status, to_email, niet_mailen_op, email_ongeldig_op'),
  ]);
  for (const r of [conceptsRes, queueRes, prospectsRes]) if (r.error) throw r.error;
  const concepts = conceptsRes.data ?? [];
  const queue = queueRes.data ?? [];

  const today = amsterdamDay(now);
  const [first, second] = nextWorkingDays(now, 2);
  const tomorrow = first === today ? second : first;
  const tomorrowCapacity = tomorrow ? dayCapacity(tomorrow) : 0;
  // Cold rows that will fall on tomorrow: those explicitly not before
  // tomorrow, plus whatever does not fit in what is left of today.
  const coldQueued = queue.filter((q) => q.soort !== 'reply');
  const todayLeft = first === today ? dayCapacity(today) : 0;
  const pinnedTomorrow = coldQueued.filter((q) => q.niet_voor && amsterdamDay(new Date(q.niet_voor as string)) === tomorrow).length;
  const spill = Math.max(0, coldQueued.length - pinnedTomorrow - todayLeft);
  const tomorrowFilled = Math.min(tomorrowCapacity, pinnedTomorrow + spill);

  const notContacted = (prospectsRes.data ?? []).filter(
    (p) => p.status === 'nog_niet_benaderd' && p.to_email && !p.niet_mailen_op && !p.email_ongeldig_op,
  ).length;
  // The cockpit shows the same figure (runwayDays in src/lib/outreachCockpit.ts).
  const runwayDays = Math.floor(notContacted / FIRST_MAILS_PER_DAY);

  return {
    repliesWaiting: concepts.filter((c) => c.soort === 'reply' && c.status === 'voorstel').length,
    conceptsWaiting: concepts.filter((c) => c.soort !== 'reply' && c.status === 'voorstel').length,
    goingOutToday: queue.filter((q) => !q.niet_voor || amsterdamDay(new Date(q.niet_voor as string)) === today).length,
    tomorrowEmpty: Math.max(0, tomorrowCapacity - tomorrowFilled),
    tomorrowCapacity,
    notContacted,
    runwayDays,
  };
}

async function digest(db: SupabaseClient, slot: 'morning' | 'afternoon', now: Date) {
  const p = await picture(db, now);
  const lines: string[] = [];
  if (slot === 'morning') {
    if (p.repliesWaiting) lines.push(plural(p.repliesWaiting, 'reply needs you', 'replies need you'));
    if (p.conceptsWaiting) lines.push(`${plural(p.conceptsWaiting, 'concept', 'concepts')} waiting`);
    if (p.goingOutToday) lines.push(`${plural(p.goingOutToday, 'mail goes', 'mails go')} out today`);
    if (p.tomorrowEmpty) lines.push(`tomorrow ${p.tomorrowEmpty} of ${p.tomorrowCapacity} slots empty`);
    if (p.runwayDays !== null && p.runwayDays < RUNWAY_WARN) lines.push(`runway ${p.runwayDays} working days`);
    // "6 mails go out today" alone is information, not an action: stay quiet.
    const actionable = p.repliesWaiting || p.conceptsWaiting || p.tomorrowEmpty || (p.runwayDays ?? 99) < RUNWAY_WARN;
    if (!actionable) return { sent: false, reason: 'nothing to do' };
  } else {
    if (!p.tomorrowEmpty) return { sent: false, reason: 'tomorrow is full' };
    if (p.conceptsWaiting) {
      lines.push(`Tomorrow ${p.tomorrowEmpty} of ${p.tomorrowCapacity} slots empty: ${plural(p.conceptsWaiting, 'concept needs', 'concepts need')} you`);
    } else if (p.notContacted === 0) {
      lines.push(`Tomorrow ${p.tomorrowEmpty} of ${p.tomorrowCapacity} slots empty: no agencies left to contact`);
    } else {
      return { sent: false, reason: 'prepare will fill it' };
    }
  }
  const sent = await notifyPush(db, `digest_${slot}`, 'outreach', {
    title: slot === 'morning' ? 'Outreach today' : 'Outreach tomorrow',
    body: lines.join(' · '),
    url: OPS_OUTREACH_URL,
    tag: `digest-${slot}`,
  }, { now });
  return { sent, lines };
}

/** Sending is paused while approved mail waits inside its window: once a day, loudly. */
async function alarm(db: SupabaseClient, now: Date) {
  const { data: state } = await db.from('outreach_send_state').select('gepauzeerd').eq('id', true).maybeSingle();
  if (!state?.gepauzeerd) return { sent: false, reason: 'not paused' };
  const { data: q } = await db
    .from('outreach_send_queue')
    .select('id, niet_voor')
    .eq('status', 'queued')
    .or(`niet_voor.is.null,niet_voor.lte."${now.toISOString()}"`);
  const due = (q ?? []).length;
  if (!due) return { sent: false, reason: 'nothing due' };
  const sent = await notifyPush(db, 'alarm_paused', 'outreach', {
    title: 'Sending is paused',
    body: `${plural(due, 'approved mail is', 'approved mails are')} waiting. Unpause in /ops or they stay put.`,
    url: OPS_OUTREACH_URL,
    tag: 'alarm-paused',
  }, { now });
  return { sent };
}

/**
 * A submitted survey whose report is not ready 45 minutes later. A normal run
 * takes about 15 minutes; past 45 a customer is waiting on a run that died
 * (n8n error, webhook never arrived, model output that failed a guard). The
 * n8n Error Handler mails crashed executions, but it cannot see a run that
 * never started or one that ended without flipping the report to ready.
 * "Ready" = analysis-completed set the report to pending_review (or later,
 * completed). One ping per submission per day; covers every product.
 */
const STUCK_AFTER_MIN = 45;
const STUCK_LOOKBACK_H = 48;
const ENCORE_SURVEY_IDS = new Set([
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
]);

async function stuck(db: SupabaseClient, now: Date) {
  const newest = new Date(now.getTime() - STUCK_AFTER_MIN * 60_000).toISOString();
  const oldest = new Date(now.getTime() - STUCK_LOOKBACK_H * 3_600_000).toISOString();
  const { data: subs, error } = await db
    .from('answers')
    .select('id, survey_id, submitted_at, access_code_id')
    .eq('status', 'submitted')
    .gte('submitted_at', oldest)
    .lte('submitted_at', newest);
  if (error) throw error;
  if (!subs?.length) return { sent: 0, stuck: 0 };

  const codeIds = subs.map((s) => s.access_code_id).filter(Boolean);
  const { data: codes } = await db.from('access_codes').select('id, user_id').in('id', codeIds);
  const userByCode = new Map((codes ?? []).map((c) => [c.id, c.user_id as string | null]));
  const userIds = [...new Set((codes ?? []).map((c) => c.user_id).filter(Boolean))];
  const { data: reports } = userIds.length
    ? await db.from('reports').select('user_id, status, created_at').in('user_id', userIds)
    : { data: [] };

  const waiting = subs.filter((s) => {
    const userId = userByCode.get(s.access_code_id);
    if (!userId) return true; // submitted, but nobody to show a report to: worth a look
    const since = new Date(s.submitted_at).getTime() - 5 * 60_000;
    return !(reports ?? []).some((r) =>
      r.user_id === userId &&
      new Date(r.created_at).getTime() >= since &&
      (r.status === 'pending_review' || r.status === 'completed'));
  });

  let sent = 0;
  for (const s of waiting) {
    const product = ENCORE_SURVEY_IDS.has(s.survey_id) ? 'Encore' : 'Cairnly';
    const mins = Math.round((now.getTime() - new Date(s.submitted_at).getTime()) / 60_000);
    const ok = await notifyPush(db, 'report_stuck', s.id, {
      title: `${product} report not ready after ${mins} min`,
      body: 'A customer submitted the survey and is still waiting. Check n8n executions (WF1P to WF4P for Encore).',
      url: OPS_OUTREACH_URL,
      tag: `report-stuck-${s.id}`,
    }, { now });
    if (ok) sent++;
  }
  return { sent, stuck: waiting.length };
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const now = new Date();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const action = String(body.action ?? '');

  try {
    if (action === 'digest') {
      const slot = body.slot === 'afternoon' ? 'afternoon' : 'morning';
      if (!body.force) {
        const m = amsterdamMinutes(now);
        if (m < SLOTS[slot] || m >= SLOTS[slot] + TOLERANCE_MIN) return json({ sent: false, reason: 'not the moment' });
      }
      return json(await digest(supabase, slot, now));
    }
    if (action === 'alarm') return json(await alarm(supabase, now));
    if (action === 'stuck') return json(await stuck(supabase, now));
    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error('[ops-push]', action, e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
