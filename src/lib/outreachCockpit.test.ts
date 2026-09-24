import { describe, expect, it } from 'vitest';
import { coldWindow, dayCapacity, estimateTimes, nextWorkingDays, runwayDays, tomorrowSlots } from './outreachCockpit';

// The same figures as supabase/functions/_shared/outreachSchedule.test.ts.
describe('capacity mirrors the Deno side', () => {
  it('Monday 6, Friday 5, Tuesday 8, Saturday 0', () => {
    expect(coldWindow('2026-09-28')).toEqual({ start: 780, end: 990 });
    expect(dayCapacity('2026-09-28')).toBe(6);
    expect(dayCapacity('2026-10-02')).toBe(5);
    expect(dayCapacity('2026-09-29')).toBe(8);
    expect(dayCapacity('2026-09-26')).toBe(0);
  });

  it('a closed day does not count', () => {
    expect(nextWorkingDays(new Date('2026-09-25T20:00:00Z'), 2)).toEqual(['2026-09-28', '2026-09-29']);
  });
});

describe('estimateTimes', () => {
  it('steps cold mail through the window at the mean gap and rolls to the next day', () => {
    // Tuesday 16:00 Amsterdam (14:00Z): one fits before 16:30, the next goes Wednesday 09:00.
    const now = new Date('2026-09-29T14:00:00Z');
    const est = estimateTimes(
      null,
      [
        { id: 'a', lane: 'cold', niet_voor: null, direct: false },
        { id: 'b', lane: 'cold', niet_voor: null, direct: false },
      ],
      now,
      0,
    );
    expect(est.a).toBe('2026-09-29T14:00:00.000Z');
    expect(est.b).toBe('2026-09-30T07:00:00.000Z'); // 09:00 CEST
  });

  it('a reply goes at its own moment, not in the cold line', () => {
    const now = new Date('2026-09-29T08:00:00Z');
    const est = estimateTimes('2026-09-29T09:00:00Z', [{ id: 'r', lane: 'reply', niet_voor: '2026-09-29T08:12:00Z', direct: false }], now, 0);
    expect(est.r).toBe('2026-09-29T08:12:00.000Z');
  });

  it('counts tomorrow’s slots from the estimates', () => {
    const now = new Date('2026-09-29T14:00:00Z');
    const est = { a: '2026-09-29T14:00:00.000Z', b: '2026-09-30T07:00:00.000Z' };
    expect(tomorrowSlots(now, est, ['a', 'b'])).toEqual({ day: '2026-09-30', capacity: 8, filled: 1, empty: 7 });
  });
});

describe('runway', () => {
  it('is the not-contacted list at four first mails a day', () => {
    expect(runwayDays(31)).toBe(7);
    expect(runwayDays(3)).toBe(0);
  });
});
