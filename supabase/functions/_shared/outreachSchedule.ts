// When outreach mail may leave, as arithmetic.
//
// The database is the authority: outreach_send_in_window() and
// outreach_send_blocked() decide whether a mail actually goes. This module
// mirrors those rules so the parts that PLAN can reason about them: prepare
// needs to know how many slots the next two working days hold, and the
// cockpit needs "tomorrow 3 of 6 slots empty". If the SQL window changes,
// change it here too (and in src/lib/outreachCockpit.ts, which Vite can
// import and this file it cannot).

/** Cold mail per Amsterdam day. Mirrors MAX_PER_DAG in outreach-send and the SQL default. */
export const COLD_CAP_PER_DAY = 8;
/** The random gap between cold mails, in minutes. Mirrors outreach_send_done(). */
export const GAP_MIN = 24;
export const GAP_MAX = 53;
export const MEAN_GAP = (GAP_MIN + GAP_MAX) / 2;
/**
 * Rough first-mail slots per working day once chases take their share. The
 * runway figure divides the not-contacted list by this. Same value as
 * FIRST_MAILS_PER_DAY in src/lib/outreachCockpit.ts.
 */
export const FIRST_MAILS_PER_DAY = 4;

const TZ = 'Europe/Amsterdam';

function parts(at: Date): { day: string; minutes: number; isoDow: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  const dows: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    isoDow: dows[get('weekday')] ?? 0,
  };
}

/** The Amsterdam calendar day of an instant, as YYYY-MM-DD. */
export function amsterdamDay(at: Date): string {
  return parts(at).day;
}

/** ISO weekday (1 = Monday) of a YYYY-MM-DD calendar day. Time zone free. */
function isoDowOf(day: string): number {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The cold send window of a day, in minutes after Amsterdam midnight.
 * Monday from 13:00 (nobody reads a cold mail in a Monday morning inbox),
 * Friday until 12:00, otherwise 09:00-16:30, never at the weekend.
 */
export function coldWindow(day: string): { start: number; end: number } | null {
  switch (isoDowOf(day)) {
    case 1:
      return { start: 13 * 60, end: 16 * 60 + 30 };
    case 5:
      return { start: 9 * 60, end: 12 * 60 };
    case 6:
    case 7:
      return null;
    default:
      return { start: 9 * 60, end: 16 * 60 + 30 };
  }
}

/**
 * How many cold mails fit in a day at the mean gap: the first goes at the
 * window's start, each next one a mean gap later. A Monday holds six, a
 * Friday five, any other weekday hits the cap.
 */
export function dayCapacity(day: string, cap = COLD_CAP_PER_DAY): number {
  const w = coldWindow(day);
  if (!w) return 0;
  return Math.min(cap, Math.floor((w.end - w.start) / MEAN_GAP) + 1);
}

/**
 * The next n days on which cold mail can still leave, starting today. Today
 * only counts while its window has not closed yet.
 */
export function nextWorkingDays(from: Date, n: number): string[] {
  const now = parts(from);
  const out: string[] = [];
  let day = now.day;
  for (let i = 0; out.length < n && i < 14; i++, day = addDays(day, 1)) {
    const w = coldWindow(day);
    if (!w) continue;
    if (day === now.day && now.minutes >= w.end) continue;
    out.push(day);
  }
  return out;
}

/** Replies go out on weekdays between 08:00 and 18:00 Amsterdam. Mirrors outreach_reply_in_window(). */
export function inReplyWindow(at: Date): boolean {
  const p = parts(at);
  if (p.isoDow > 5) return false;
  return p.minutes >= 8 * 60 && p.minutes < 18 * 60;
}
