// When the next chase or check-in is due. A Deno copy of followUp() and its
// working-day helpers in src/lib/outreach.ts, which Vite owns and Deno cannot
// import. The two must agree; outreachCadence.test.ts mirrors the frontend's
// cases so a drift shows up as a failing test on this side.
//
// Cadence (Sjoerd, 2026-09-14): a chase 4 working days after the first mail,
// the last one 6 working days after that, then stop. A parked reply gets one
// check-in 10 working days after it was parked. Tier C gets the first chase
// only (Sjoerd, 2026-09-28).

import { CHECK_IN_CLOSED, CHECK_IN_WORKING_DAYS } from './outreach.ts';

export const FOLLOW_UP_1_WORKING_DAYS = 4;
export const FOLLOW_UP_2_WORKING_DAYS = 6;

/**
 * How many chases an agency gets: tier C one, everyone else two. A third touch
 * on a weak-fit agency costs more goodwill than it returns. Ported from
 * OutsideInput's chasePolicy (b9723fd), without its insurer exception.
 */
export function maxChases(tier: string | null): 1 | 2 {
  return tier === 'C' ? 1 : 2;
}

const DAY_MS = 86_400_000;

/** The Amsterdam calendar day of an instant, as a UTC-midnight stamp. */
export function amsterdamDayStamp(at: string | Date): number {
  const d = typeof at === 'string' ? new Date(at) : at;
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return Date.parse(`${ymd}T00:00:00Z`);
}

const isWeekend = (stamp: number) => {
  const wd = new Date(stamp).getUTCDay();
  return wd === 0 || wd === 6;
};

export function addWorkingDays(stamp: number, days: number): number {
  let s = stamp;
  let left = days;
  while (left > 0) {
    s += DAY_MS;
    if (!isWeekend(s)) left--;
  }
  return s;
}

export interface CadenceInput {
  status: string;
  /** A, B or C; decides how many chases (see maxChases). */
  tier: string | null;
  /** When we last mailed them (any outbound), or null. */
  lastOutAt: string | null;
  /** Fallback anchor when no outbound mail is logged. */
  verzondenOp: string | null;
  /** They wrote last and it was a person, not an out-of-office. */
  theyWroteLast: boolean;
  /** Set when that last mail of theirs is parked ("they'll get back to me"). */
  parkedAt: string | null;
}

export interface NextFollowUp {
  kind: 'chase' | 'checkin';
  step: 1 | 2;
  /** UTC-midnight stamp of the Amsterdam day it is due. */
  dueDay: number;
}

/**
 * The next follow-up, or null when chasing is not the right move: they wrote
 * last and it is not parked (answer them first), every chase their tier gets
 * went out, or the conversation moved on.
 */
export function nextFollowUp(p: CadenceInput): NextFollowUp | null {
  if (p.parkedAt) {
    if (CHECK_IN_CLOSED.has(p.status)) return null;
    return { kind: 'checkin', step: 1, dueDay: addWorkingDays(amsterdamDayStamp(p.parkedAt), CHECK_IN_WORKING_DAYS) };
  }
  if (p.theyWroteLast) return null;

  const step = p.status === 'verzonden' ? 1 : p.status === 'opvolging_1' ? 2 : null;
  if (!step || step > maxChases(p.tier)) return null;
  const anchor = p.lastOutAt ?? p.verzondenOp;
  if (!anchor) return null;
  const wait = step === 1 ? FOLLOW_UP_1_WORKING_DAYS : FOLLOW_UP_2_WORKING_DAYS;
  return { kind: 'chase', step, dueDay: addWorkingDays(amsterdamDayStamp(anchor), wait) };
}

// ─── The unused test code ────────────────────────────────────────────────────
//
// An agency that got a test code and did nothing with it gets two touches:
//   1. a nudge, four working days after the last mail we sent since the code
//      existed (normally the mail that carried it);
//   2. a check-in, five working days after the last mail we sent since the
//      nudge (normally the nudge itself), offering to start it together.
// Then it stops. Both always wait for Sjoerd. Mirrors codeActivation() in
// src/lib/outreach.ts, which shows the same clock in /ops.

export const ACTIVATION_NUDGE_WORKING_DAYS = 4;
export const ACTIVATION_CHECKIN_WORKING_DAYS = 5;

/** No nudge to an agency that said no. */
export const ACTIVATION_CLOSED: ReadonlySet<string> = new Set(['afgewezen', 'geen_fit']);

export interface ActivationInput {
  status: string;
  codesIssued: number;
  codesClaimed: number;
  /** Unclaimed and not expired: something they could still redeem. */
  codesOpen: number;
  /** When their first code was minted. */
  firstCodeAt: string | null;
  /** When we last mailed them (any outbound), or null. */
  lastOutAt: string | null;
  /** They wrote last and it was a person: answer them, do not nudge. */
  theyWroteLast: boolean;
  /** Their last mail is parked: the check-in covers it. */
  parked: boolean;
  /** When the step-1 nudge went out, if it did. */
  nudgedAt: string | null;
  /** When the step-2 check-in went out, if it did. Two is the limit. */
  checkedInAt?: string | null;
}

export function nextActivationNudge(p: ActivationInput): { step: 1 | 2; dueDay: number; anchor: string } | null {
  if (p.codesIssued <= 0 || p.codesClaimed > 0 || p.codesOpen <= 0 || !p.firstCodeAt) return null;
  if (ACTIVATION_CLOSED.has(p.status) || p.checkedInAt || p.theyWroteLast || p.parked) return null;
  // The clock runs from the latest mail we sent after the previous milestone
  // (the mint, then the nudge); before that mail is logged, the milestone itself.
  const since = p.nudgedAt ?? p.firstCodeAt;
  const anchor = p.lastOutAt && Date.parse(p.lastOutAt) >= Date.parse(since) ? p.lastOutAt : since;
  const step = p.nudgedAt ? 2 : 1;
  const wait = step === 1 ? ACTIVATION_NUDGE_WORKING_DAYS : ACTIVATION_CHECKIN_WORKING_DAYS;
  return { step, anchor, dueDay: addWorkingDays(amsterdamDayStamp(anchor), wait) };
}
