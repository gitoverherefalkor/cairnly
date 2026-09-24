import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  amsterdamDay,
  coldWindow,
  dayCapacity,
  inReplyWindow,
  nextWorkingDays,
} from './outreachSchedule.ts';

Deno.test('Monday starts at 13:00, so it holds six mails, not eight', () => {
  assertEquals(coldWindow('2026-09-28'), { start: 780, end: 990 });
  assertEquals(dayCapacity('2026-09-28'), 6);
});

Deno.test('Friday stops at 12:00 and holds five', () => {
  assertEquals(coldWindow('2026-10-02'), { start: 540, end: 720 });
  assertEquals(dayCapacity('2026-10-02'), 5);
});

Deno.test('a full weekday is capped at eight', () => {
  assertEquals(coldWindow('2026-09-29'), { start: 540, end: 990 });
  assertEquals(dayCapacity('2026-09-29'), 8);
});

Deno.test('the weekend has no window and no capacity', () => {
  assertEquals(coldWindow('2026-09-26'), null);
  assertEquals(coldWindow('2026-09-27'), null);
  assertEquals(dayCapacity('2026-09-26'), 0);
});

Deno.test('a day whose window has closed does not count', () => {
  // Friday 22:00 Amsterdam: Friday's window closed at 12:00.
  assertEquals(nextWorkingDays(new Date('2026-09-25T20:00:00Z'), 2), ['2026-09-28', '2026-09-29']);
  // Tuesday 08:00 Amsterdam: Tuesday still counts.
  assertEquals(nextWorkingDays(new Date('2026-09-29T06:00:00Z'), 2), ['2026-09-29', '2026-09-30']);
  // Friday 11:00 Amsterdam: an hour of Friday left, it counts.
  assertEquals(nextWorkingDays(new Date('2026-10-02T09:00:00Z'), 1), ['2026-10-02']);
});

Deno.test('replies go out on weekdays between 08:00 and 18:00 Amsterdam', () => {
  assertEquals(inReplyWindow(new Date('2026-09-29T07:30:00Z')), true); // 09:30 CEST
  assertEquals(inReplyWindow(new Date('2026-09-29T16:30:00Z')), false); // 18:30 CEST
  assertEquals(inReplyWindow(new Date('2026-09-29T05:59:00Z')), false); // 07:59 CEST
  assertEquals(inReplyWindow(new Date('2026-09-27T10:00:00Z')), false); // Sunday
});

Deno.test('the Amsterdam day follows the clock change', () => {
  assertEquals(amsterdamDay(new Date('2026-10-24T22:30:00Z')), '2026-10-25');
  assertEquals(amsterdamDay(new Date('2026-10-25T22:30:00Z')), '2026-10-25'); // CET after the change
});
