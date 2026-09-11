import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  addressesOf,
  classifyOutbound,
  directionOf,
  looksAutomatic,
  matchProspect,
  normaliseGmailItem,
  replyBodyOnly,
  slugFromBody,
} from './outreachMail.ts';

const prospects = [
  { slug: 'vierl', to_email: 'info@vierl.nl', domain: 'vierl.nl', alt_domain: null },
  { slug: 'talenta', to_email: 'lydia@talentawerkt.nl', domain: 'talentawerkt.nl', alt_domain: 'talenta.nl' },
];

Deno.test('slugFromBody survives Gmail double-encoding of the demo link', () => {
  const raw =
    'https://www.google.com/url?q=https://www.google.com/url?q%3Dhttps://cairnly.io/demo?p%253Dpartners%2526persona%253Dmarcel%2526utm_content%253Dvierl%26source%3Dgmail';
  assertEquals(slugFromBody(raw), 'vierl');
  assertEquals(slugFromBody('plain https://cairnly.io/demo?p=partners&utm_content=talenta'), 'talenta');
  assertEquals(slugFromBody('no link here'), null);
});

Deno.test('addressesOf handles strings, mailparser objects and arrays', () => {
  assertEquals(addressesOf('Sjoerd <Sjoerd@Cairnly.io>, x@y.nl'), ['sjoerd@cairnly.io', 'x@y.nl']);
  assertEquals(addressesOf({ value: [{ address: 'A@B.nl', name: 'A' }], text: 'A <A@B.nl>' }), ['a@b.nl']);
  assertEquals(addressesOf([{ address: 'q@w.nl' }, 'e@r.nl']), ['q@w.nl', 'e@r.nl']);
});

Deno.test('normaliseGmailItem: n8n full mode (mailparser shape)', () => {
  const m = normaliseGmailItem({
    id: 'm1',
    threadId: 't1',
    labelIds: ['SENT'],
    from: { value: [{ address: 'sjoerd@cairnly.io', name: 'Sjoerd' }] },
    to: { value: [{ address: 'info@vierl.nl' }] },
    cc: { value: [{ address: 'x@vierl.nl' }] },
    subject: 'Vraagje',
    date: '2026-09-11T08:39:00.000Z',
    html: '<p>Hallo<br>daar <a href="https://cairnly.io/demo?utm_content=vierl">demo</a></p>',
  });
  assertEquals(m?.from, 'sjoerd@cairnly.io');
  assertEquals(m?.to, ['info@vierl.nl', 'x@vierl.nl']);
  assertEquals(m?.text.includes('utm_content=vierl'), true);
  assertEquals(directionOf(m!), 'out');
});

Deno.test('normaliseGmailItem: n8n simple mode', () => {
  const m = normaliseGmailItem({
    id: 'm2',
    threadId: 't2',
    labels: [{ id: 'INBOX', name: 'INBOX' }],
    From: 'Lydia <lydia@talentawerkt.nl>',
    To: 'sjoerd@cairnly.io',
    Subject: 'RE: Vraagje',
    internalDate: '1788974640000',
    snippet: 'Dank voor je mail, wij hebben geen interesse.',
  });
  assertEquals(m?.date, '2026-09-09T17:24:00.000Z');
  assertEquals(m?.labelIds, ['INBOX']);
  assertEquals(directionOf(m!), 'in');
  assertEquals(m?.text, 'Dank voor je mail, wij hebben geen interesse.');
});

Deno.test('matchProspect: body slug, then address, then domain, then thread', () => {
  const base = { id: 'x', threadId: 'tt', subject: '', date: '2026-09-11T00:00:00Z', snippet: '', labelIds: [] as string[] };
  const threads = new Map([['known', 'vierl']]);
  // outbound with link
  assertEquals(
    matchProspect({ ...base, from: 'sjoerd@cairnly.io', to: ['nobody@else.nl'], text: 'utm_content=talenta' }, 'out', prospects, threads),
    'talenta',
  );
  // inbound from exact address
  assertEquals(
    matchProspect({ ...base, from: 'lydia@talentawerkt.nl', to: ['sjoerd@cairnly.io'], text: 'geen interesse' }, 'in', prospects, threads),
    'talenta',
  );
  // inbound from the alt domain
  assertEquals(
    matchProspect({ ...base, from: 'johan@talenta.nl', to: ['sjoerd@cairnly.io'], text: '' }, 'in', prospects, threads),
    'talenta',
  );
  // known thread, unknown address
  assertEquals(
    matchProspect({ ...base, threadId: 'known', from: 'someone@gmail.com', to: ['sjoerd@cairnly.io'], text: '' }, 'in', prospects, threads),
    'vierl',
  );
  // nothing
  assertEquals(
    matchProspect({ ...base, from: 'someone@gmail.com', to: ['sjoerd@cairnly.io'], text: '' }, 'in', prospects, threads),
    null,
  );
});

Deno.test('classifyOutbound: first, follow-ups, and replies after theirs', () => {
  const t = (n: number) => `2026-09-${String(n).padStart(2, '0')}T10:00:00Z`;
  assertEquals(classifyOutbound({ threadId: 'a', date: t(9) }, []), { kind: 'eerste', status: 'verzonden' });
  const prior = [{ gmail_thread_id: 'a', direction: 'out' as const, kind: 'eerste', sent_at: t(9) }];
  assertEquals(classifyOutbound({ threadId: 'b', date: t(12) }, prior), { kind: 'opvolging', status: 'opvolging_1' });
  const prior2 = [...prior, { gmail_thread_id: 'b', direction: 'out' as const, kind: 'opvolging', sent_at: t(12) }];
  assertEquals(classifyOutbound({ threadId: 'c', date: t(16) }, prior2), { kind: 'opvolging', status: 'opvolging_2' });
  const replied = [...prior, { gmail_thread_id: 'a', direction: 'in' as const, kind: 'reactie', sent_at: t(10) }];
  assertEquals(classifyOutbound({ threadId: 'a', date: t(11) }, replied), { kind: 'antwoord', status: null });
  // a reply that arrives AFTER our mail does not make ours an answer
  assertEquals(classifyOutbound({ threadId: 'a', date: t(9) }, replied), { kind: 'eerste', status: 'verzonden' });
});

Deno.test('looksAutomatic and replyBodyOnly', () => {
  assertEquals(looksAutomatic({ subject: 'Automatisch antwoord: Vraagje', from: 'x@y.nl' }), true);
  assertEquals(looksAutomatic({ subject: 'RE: Vraagje', from: 'noreply@y.nl' }), true);
  assertEquals(looksAutomatic({ subject: 'RE: Vraagje', from: 'x@y.nl' }), false);
  const body = 'Dag Sjoerd,\n\nWe hebben interesse.\n\nGroet, M\n\nOp do 11 sep 2026 om 10:52 schreef Sjoerd <sjoerd@cairnly.io>:\n> Beste Monique,\n> ...';
  assertEquals(replyBodyOnly(body), 'Dag Sjoerd,\n\nWe hebben interesse.\n\nGroet, M');
});
