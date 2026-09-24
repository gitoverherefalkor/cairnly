// Cockpit arithmetic for /ops: send windows, day capacity, tomorrow's slots,
// estimated send times and runway.
//
// A browser copy of supabase/functions/_shared/outreachSchedule.ts (Vite
// cannot import the Deno side). The database is the authority on when a mail
// actually leaves; these numbers are for planning and are shown as estimates.
// outreachCockpit.test.ts pins the same Monday/Friday/Tuesday figures as the
// Deno test, so a drift between the two shows up as a failing test.

export const COLD_CAP_PER_DAY = 8;
export const MEAN_GAP_MIN = (24 + 53) / 2;
/** Rough first-mail slots per working day once chases take their share. */
export const FIRST_MAILS_PER_DAY = 4;

const TZ = 'Europe/Amsterdam';

function parts(at: Date): { day: string; minutes: number } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return { day: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function amsterdamDayString(at: Date): string {
  return parts(at).day;
}

const isoDow = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function coldWindow(day: string): { start: number; end: number } | null {
  switch (isoDow(day)) {
    case 1:
      return { start: 780, end: 990 };
    case 5:
      return { start: 540, end: 720 };
    case 6:
    case 7:
      return null;
    default:
      return { start: 540, end: 990 };
  }
}

export function dayCapacity(day: string, cap = COLD_CAP_PER_DAY): number {
  const w = coldWindow(day);
  if (!w) return 0;
  return Math.min(cap, Math.floor((w.end - w.start) / MEAN_GAP_MIN) + 1);
}

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

/** Amsterdam wall-clock minutes of a day → an instant. Handles both offsets. */
function atAmsterdam(day: string, minutes: number): Date {
  const guess = new Date(`${day}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00Z`);
  const shown = parts(guess);
  const diff = (shown.day === day ? shown.minutes : shown.minutes + (shown.day > day ? 1440 : -1440)) - minutes;
  return new Date(guess.getTime() - diff * 60_000);
}

export interface QueuedForEstimate {
  id: string;
  lane: 'cold' | 'reply';
  niet_voor: string | null;
  direct: boolean;
}

/**
 * When each queued mail will roughly leave. Cold mail steps through the
 * windows at the mean gap starting from the persisted next-allowed moment and
 * never before its own niet_voor; replies and direct sends go at their
 * niet_voor (or now). Returns ISO strings keyed by queue id.
 */
export function estimateTimes(
  nextAllowedAt: string | null,
  queued: QueuedForEstimate[],
  now: Date,
  coldSentToday: number,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of queued) {
    if (q.lane === 'reply' || q.direct) {
      const t = Math.max(now.getTime(), q.niet_voor ? Date.parse(q.niet_voor) : 0);
      out[q.id] = new Date(t).toISOString();
    }
  }
  let cursor = Math.max(now.getTime(), nextAllowedAt ? Date.parse(nextAllowedAt) : 0);
  let sentOnDay = coldSentToday;
  let cursorDay = amsterdamDayString(new Date(cursor));
  const cold = queued.filter((q) => q.lane === 'cold' && !q.direct);
  for (const q of cold) {
    let t = Math.max(cursor, q.niet_voor ? Date.parse(q.niet_voor) : 0);
    for (let guard = 0; guard < 30; guard++) {
      const p = parts(new Date(t));
      if (p.day !== cursorDay) {
        cursorDay = p.day;
        sentOnDay = 0;
      }
      const w = coldWindow(p.day);
      if (w && sentOnDay < COLD_CAP_PER_DAY && p.minutes < w.end) {
        if (p.minutes < w.start) t = atAmsterdam(p.day, w.start).getTime();
        break;
      }
      // Next day, at its window start.
      const next = addDays(p.day, 1);
      const nw = coldWindow(next);
      t = atAmsterdam(next, nw ? nw.start : 0).getTime();
    }
    out[q.id] = new Date(t).toISOString();
    sentOnDay++;
    cursor = t + MEAN_GAP_MIN * 60_000;
  }
  return out;
}

/** Tomorrow's cold slots: capacity, how many the queue will fill, and what is left. */
export function tomorrowSlots(
  now: Date,
  estimates: Record<string, string>,
  coldIds: string[],
): { day: string | null; capacity: number; filled: number; empty: number } {
  const today = amsterdamDayString(now);
  const next = nextWorkingDays(now, 2).find((d) => d !== today) ?? null;
  if (!next) return { day: null, capacity: 0, filled: 0, empty: 0 };
  const capacity = dayCapacity(next);
  const filled = Math.min(capacity, coldIds.filter((id) => estimates[id] && amsterdamDayString(new Date(estimates[id])) === next).length);
  return { day: next, capacity, filled, empty: capacity - filled };
}

/** Working days of first-mail supply left at the usual pace. */
export function runwayDays(notContacted: number): number {
  return Math.floor(notContacted / FIRST_MAILS_PER_DAY);
}
