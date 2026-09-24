import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { amsterdamDayStamp, nextFollowUp } from './outreachCadence.ts';

const day = (s: string) => amsterdamDayStamp(`${s}T10:00:00Z`);
const base = { status: 'verzonden', lastOutAt: null, verzondenOp: null, theyWroteLast: false, parkedAt: null };

Deno.test('chase 1 is four working days after the first mail, skipping the weekend', () => {
  // Wednesday 16 Sept → Tuesday 22 Sept (Thu, Fri, Mon, Tue).
  const fu = nextFollowUp({ ...base, lastOutAt: '2026-09-16T08:00:00Z' });
  assertEquals(fu, { kind: 'chase', step: 1, dueDay: day('2026-09-22') });
});

Deno.test('chase 2 is six working days after chase 1', () => {
  // Monday 21 Sept → Tuesday 29 Sept.
  const fu = nextFollowUp({ ...base, status: 'opvolging_1', lastOutAt: '2026-09-21T08:00:00Z' });
  assertEquals(fu, { kind: 'chase', step: 2, dueDay: day('2026-09-29') });
});

Deno.test('no chase when they wrote last, after both chases, or without an anchor', () => {
  assertEquals(nextFollowUp({ ...base, lastOutAt: '2026-09-16T08:00:00Z', theyWroteLast: true }), null);
  assertEquals(nextFollowUp({ ...base, status: 'opvolging_2', lastOutAt: '2026-09-16T08:00:00Z' }), null);
  assertEquals(nextFollowUp(base), null);
});

Deno.test('a parked reply gets a check-in ten working days later, unless closed', () => {
  const fu = nextFollowUp({ ...base, status: 'gereageerd', theyWroteLast: true, parkedAt: '2026-09-23T09:00:00Z' });
  assertEquals(fu, { kind: 'checkin', step: 1, dueDay: day('2026-10-07') });
  assertEquals(nextFollowUp({ ...base, status: 'afgewezen', theyWroteLast: true, parkedAt: '2026-09-23T09:00:00Z' }), null);
});
