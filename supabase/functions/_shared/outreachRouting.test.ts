import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hasQuestion, isBounce, routeInbound } from './outreachRouting.ts';

Deno.test('bounces are recognised by sender, subject or report type', () => {
  assertEquals(isBounce({ from: 'mailer-daemon@googlemail.com', subject: 'Delivery Status Notification (Failure)' }), true);
  assertEquals(isBounce({ from: 'postmaster@outlook.com', subject: 'x' }), true);
  assertEquals(isBounce({ from: 'x@y.nl', subject: 'Onbestelbaar: Vraagje over jullie spoor 2-trajecten' }), true);
  assertEquals(isBounce({ from: 'x@y.nl', subject: 'Re: vraagje', contentType: 'multipart/report; report-type=delivery-status' }), true);
  assertEquals(isBounce({ from: 'x@y.nl', subject: 'Re: Vraagje over jullie spoor 2-trajecten' }), false);
});

Deno.test('a question mark inside a link is not a question', () => {
  assertEquals(hasQuestion('Kijk op https://x.nl/demo?a=1 maar geen interesse.'), false);
  assertEquals(hasQuestion('Waarom vraag je dat?'), true);
  assertEquals(hasQuestion('Geen interesse, dank.'), false);
});

const route = (over: Partial<Parameters<typeof routeInbound>[0]>) =>
  routeInbound({ bounce: false, sentiment: 'afwijzing', replyOnly: 'Geen interesse, dank.', statusBefore: 'verzonden', ...over });

Deno.test('a plain rejection early in the pipeline is answered automatically', () => {
  assertEquals(route({}), 'auto_rejection');
  assertEquals(route({ statusBefore: 'codes_gemint' }), 'auto_rejection');
});

Deno.test('a rejection with a question, or after a call, goes to Sjoerd', () => {
  assertEquals(route({ replyOnly: 'Geen interesse. Hoe kom je aan ons adres?' }), 'review');
  assertEquals(route({ statusBefore: 'gesprek_gepland' }), 'review');
  assertEquals(route({ statusBefore: 'gesprek_gevoerd' }), 'review');
});

Deno.test('bounce beats anything the classifier said', () => {
  assertEquals(route({ bounce: true, sentiment: 'afwijzing' }), 'bounce');
});

Deno.test('the other sentiments route as agreed', () => {
  assertEquals(route({ sentiment: 'auto' }), 'ignore');
  assertEquals(route({ sentiment: 'stop' }), 'stop');
  assertEquals(route({ sentiment: 'positief' }), 'review');
  assertEquals(route({ sentiment: 'later' }), 'review');
  assertEquals(route({ sentiment: null }), 'review');
});
