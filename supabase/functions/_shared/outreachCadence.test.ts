import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { amsterdamDayStamp, nextActivationNudge, nextFollowUp } from './outreachCadence.ts';

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

const code = {
  status: 'codes_gemint',
  codesIssued: 1,
  codesClaimed: 0,
  codesOpen: 1,
  firstCodeAt: '2026-09-11T10:55:00Z',
  lastOutAt: '2026-09-11T14:30:00Z',
  theyWroteLast: false,
  parked: false,
  nudgedAt: null,
};

Deno.test('an unused code is nudged four working days after the code mail', () => {
  // Friday 11 Sept → Thursday 17 Sept (Mon, Tue, Wed, Thu).
  assertEquals(nextActivationNudge(code), { anchor: '2026-09-11T14:30:00Z', dueDay: day('2026-09-17') });
});

Deno.test('the mint starts the clock while the code mail is not logged yet', () => {
  assertEquals(nextActivationNudge({ ...code, lastOutAt: '2026-09-09T10:52:00Z' })?.anchor, '2026-09-11T10:55:00Z');
});

Deno.test('no nudge once used, expired, nudged, answered-to-them, parked or declined', () => {
  assertEquals(nextActivationNudge({ ...code, codesClaimed: 1 }), null);
  assertEquals(nextActivationNudge({ ...code, codesOpen: 0 }), null);
  assertEquals(nextActivationNudge({ ...code, nudgedAt: '2026-09-18T09:00:00Z' }), null);
  assertEquals(nextActivationNudge({ ...code, theyWroteLast: true }), null);
  assertEquals(nextActivationNudge({ ...code, parked: true }), null);
  assertEquals(nextActivationNudge({ ...code, status: 'afgewezen' }), null);
  assertEquals(nextActivationNudge({ ...code, codesIssued: 0, codesOpen: 0 }), null);
});
