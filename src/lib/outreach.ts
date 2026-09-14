// Outreach tab helpers: status vocabulary and the default row order.
//
// The status list mirrors the check constraint on outreach_prospects.status
// (and supabase/functions/_shared/outreach.ts, which Vite cannot import), so the
// KEYS stay as they are. Only STATUS_LABELS / SENTIMENT_LABELS are display text,
// and /ops reads English — renaming a key here breaks the DB write.

export const OUTREACH_STATUSES = [
  'nog_niet_benaderd',
  'verzonden',
  'opvolging_1',
  'opvolging_2',
  'gereageerd',
  'gesprek_gepland',
  'gesprek_gevoerd',
  'pilot_afgesproken',
  'partner_aangemaakt',
  'codes_gemint',
  'pilot_gestart',
  'founding_partner',
  'afgewezen',
  'geen_fit',
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const STATUS_LABELS: Record<OutreachStatus, string> = {
  nog_niet_benaderd: 'Not contacted',
  verzonden: 'Sent',
  opvolging_1: 'Follow-up 1',
  opvolging_2: 'Follow-up 2',
  gereageerd: 'Replied',
  gesprek_gepland: 'Call booked',
  gesprek_gevoerd: 'Call done',
  pilot_afgesproken: 'Pilot agreed',
  partner_aangemaakt: 'Partner created',
  codes_gemint: 'Codes minted',
  pilot_gestart: 'Pilot started',
  founding_partner: 'Founding partner',
  afgewezen: 'Declined',
  geen_fit: 'No fit',
};

export type MailSentiment = 'positief' | 'code' | 'vraag' | 'later' | 'afwijzing' | 'auto' | 'overig';

export const SENTIMENT_LABELS: Record<MailSentiment, string> = {
  positief: 'Positive',
  code: 'Wants a code',
  vraag: 'Question',
  later: 'Later',
  afwijzing: 'Rejection',
  auto: 'Auto-reply',
  overig: 'Other',
};

/** One row of outreach_mails, as the tab shows it. */
export interface OutreachMail {
  id: string;
  direction: 'in' | 'out';
  kind: 'eerste' | 'opvolging' | 'antwoord' | 'reactie';
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  snippet: string | null;
  sent_at: string;
  sentiment: MailSentiment | null;
  samenvatting: string | null;
  draft_id: string | null;
  status_voor: string | null;
  status_na: string | null;
}

export interface OutreachProspect {
  slug: string;
  naam: string | null;
  tier: 'A' | 'B' | 'C' | null;
  categorie: string | null;
  contactpersoon: string | null;
  plaats: string | null;
  campaign: string | null;
  to_email: string | null;
  status: OutreachStatus;
  notities: string | null;
  updated_at: string;
  /** When the mail actually went out. Null for anything not sent yet. */
  verzonden_op: string | null;
  /** Every non-bot click, scanner hits included. */
  kliks_totaal: number;
  kliks_uniek_dagen: number;
  eerste_klik: string | null;
  laatste_klik: string | null;
  bot_kliks: number;
  /** Non-bot clicks inside 2 minutes of verzonden_op: mail scanner shaped. */
  kliks_verdacht: number;
  /** The rest. This is the number the tab shows and sorts on. */
  kliks_bevestigd: number;
  dagen_bevestigd: number;
  eerste_bevestigde_klik: string | null;
  laatste_bevestigde_klik: string | null;
  /** Phase 3: partner hand-off. */
  partner_slug: string | null;
  partner_naam: string | null;
  codes_issued: number;
  codes_claimed: number;
  /** Phase 3: mail log, newest first, capped. */
  mails: OutreachMail[];
  laatste_mail_op: string | null;
  laatste_mail_richting: 'in' | 'out' | null;
  laatste_sentiment: MailSentiment | null;
  laatste_samenvatting: string | null;
  /** The newest mail is theirs and a Gmail draft is waiting for it. */
  concept_klaar: boolean;
  /** The newest mail is theirs (not an auto-reply): Sjoerd is up. */
  needs_reply: boolean;
}

// ─── Follow-up cadence ───────────────────────────────────────────────────────
//
// Four working days after the first mail, six after follow-up 1. Four is long
// enough not to read as nagging and short enough that our mail is still in
// their memory, and because it is not a whole week the follow-up lands on a
// different weekday than the first mail: a Wednesday send is chased on a
// Tuesday, a Friday send on a Thursday. Nobody gets "this guy again, every
// Wednesday".
//
// Three touches total. After follow-up 2 the pipeline stops nudging; a fourth
// mail to someone who never answered twice costs more goodwill than it buys.
export const FOLLOW_UP_1_WORKING_DAYS = 4;
export const FOLLOW_UP_2_WORKING_DAYS = 6;

const AMSTERDAM = 'Europe/Amsterdam';
const DAY_MS = 86_400_000;

/**
 * The Amsterdam calendar day an instant falls on, as a UTC-midnight stamp.
 * Everything below counts in whole days, so working in day stamps avoids both
 * DST and "sent at 23:50" edge cases.
 */
export function amsterdamDay(at: string | Date): number {
  const d = typeof at === 'string' ? new Date(at) : at;
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return Date.parse(`${ymd}T00:00:00Z`);
}

const isWeekend = (dayStamp: number): boolean => {
  const wd = new Date(dayStamp).getUTCDay();
  return wd === 0 || wd === 6;
};

/** The day stamp `days` working days after `dayStamp`. Saturdays and Sundays do not count. */
export function addWorkingDays(dayStamp: number, days: number): number {
  let stamp = dayStamp;
  let left = days;
  while (left > 0) {
    stamp += DAY_MS;
    if (!isWeekend(stamp)) left--;
  }
  return stamp;
}

/** Working days strictly after `from`, up to and including `to`. Zero when `to` is not later. */
export function workingDaysBetween(from: number, to: number): number {
  if (to <= from) return 0;
  let count = 0;
  for (let stamp = from + DAY_MS; stamp <= to; stamp += DAY_MS) {
    if (!isWeekend(stamp)) count++;
  }
  return count;
}

export interface FollowUp {
  /** 1 = first chase, 2 = last chase. */
  step: 1 | 2;
  /** UTC-midnight stamp of the Amsterdam day it is (or was) due. */
  dueDay: number;
  /** Working days past due. 0 means today, negative means still waiting. */
  daysLate: number;
  due: boolean;
}

/**
 * The next follow-up for an agency, or null when chasing is not the right move:
 * they wrote last (answer them first), they already had both chases, or the
 * conversation moved on (call booked, declined, pilot running).
 *
 * The clock runs from the last mail WE sent, not from the status change, so a
 * chase that went out today does not immediately look overdue again.
 */
export function followUp(
  p: Pick<OutreachProspect, 'status' | 'needs_reply' | 'verzonden_op' | 'mails'>,
  now: Date = new Date(),
): FollowUp | null {
  if (p.needs_reply) return null;

  const step: 1 | 2 | null =
    p.status === 'verzonden' ? 1 : p.status === 'opvolging_1' ? 2 : null;
  if (!step) return null;

  const lastOut = p.mails.find((m) => m.direction === 'out');
  const anchor = lastOut?.sent_at ?? p.verzonden_op;
  if (!anchor) return null;

  const wait = step === 1 ? FOLLOW_UP_1_WORKING_DAYS : FOLLOW_UP_2_WORKING_DAYS;
  const dueDay = addWorkingDays(amsterdamDay(anchor), wait);
  const today = amsterdamDay(now);
  const due = today >= dueDay;

  return {
    step,
    dueDay,
    daysLate: due ? workingDaysBetween(dueDay, today) : -workingDaysBetween(today, dueDay),
    due,
  };
}

/**
 * "Warm": someone opened the demo but the pipeline says we have not followed
 * up yet. These go to the top of the table, that is the whole reason to
 * open the tab.
 *
 * Counts CONFIRMED clicks only. The first three clicks of the bureaus-sep26
 * batch landed under 90 seconds after their mail went out, which is a link
 * scanner rather than a reader; letting those float to the top would send
 * Sjoerd chasing bureaus that never opened anything.
 */
export function isWarm(p: Pick<OutreachProspect, 'kliks_bevestigd' | 'status'>): boolean {
  return p.kliks_bevestigd > 0 && (p.status === 'nog_niet_benaderd' || p.status === 'verzonden');
}

/**
 * Default order: bureaus waiting for OUR reply first (their mail is the newest
 * thing in the thread), then warm rows, then most recent confirmed click first
 * (rows without one last), then tier A before B before C, then name.
 */
export function compareProspects(a: OutreachProspect, b: OutreachProspect): number {
  const reply = Number(Boolean(b.needs_reply)) - Number(Boolean(a.needs_reply));
  if (reply !== 0) return reply;

  const warm = Number(isWarm(b)) - Number(isWarm(a));
  if (warm !== 0) return warm;

  const at = a.laatste_bevestigde_klik ? Date.parse(a.laatste_bevestigde_klik) : -Infinity;
  const bt = b.laatste_bevestigde_klik ? Date.parse(b.laatste_bevestigde_klik) : -Infinity;
  if (at !== bt) return bt - at;

  const tier = (a.tier ?? 'Z').localeCompare(b.tier ?? 'Z');
  if (tier !== 0) return tier;

  // Agency names are Dutch even though the console is English.
  return (a.naam ?? '').localeCompare(b.naam ?? '', 'nl');
}

/**
 * The order the tab actually uses: answer-me first, then chase-me (longest
 * overdue at the top, so the queue drains oldest first), then the click-based
 * order above. Both top buckets are work Sjoerd owes someone; everything below
 * is browsing.
 */
export function compareWorkFirst(a: OutreachProspect, b: OutreachProspect, now: Date): number {
  const reply = Number(Boolean(b.needs_reply)) - Number(Boolean(a.needs_reply));
  if (reply !== 0) return reply;

  const fa = followUp(a, now);
  const fb = followUp(b, now);
  const dueA = fa?.due ? 1 : 0;
  const dueB = fb?.due ? 1 : 0;
  if (dueA !== dueB) return dueB - dueA;
  if (dueA === 1 && fa && fb && fa.daysLate !== fb.daysLate) return fb.daysLate - fa.daysLate;

  return compareProspects(a, b);
}
