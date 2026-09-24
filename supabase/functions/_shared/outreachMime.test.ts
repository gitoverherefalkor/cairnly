import { assert, assertEquals, assertMatch, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildMime, newMessageId, quoteHeader, type MimeInput } from './outreachMime.ts';

/** base64url → the RFC 2822 text, with each base64 part decoded in place. */
function decode(raw: string): { headers: string; text: string; html: string } {
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  const msg = new TextDecoder().decode(bytes);
  const [headers] = msg.split('\r\n\r\n');
  const parts = msg.split(/\r\n--occ_[^\r\n]+\r\n/).slice(1);
  const body = (p: string) => {
    const content = p.split('\r\n\r\n')[1].replace(/\r\n/g, '').replace(/--occ_.*$/, '');
    const bin = Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bin);
  };
  return { headers, text: body(parts[0]), html: body(parts[1]) };
}

const base: MimeInput = {
  to: 'info@track2.nl',
  subject: 'Vraagje over jullie spoor 2-trajecten',
  body: 'Beste Mark,\n\nKijk [hier](https://cairnly.io/demo?a=1&b=2).\n\nGroet,\nSjoerd',
  messageId: '<occ.test.1@cairnly.io>',
  signature: false,
  date: new Date('2026-09-29T08:12:00Z'),
};

Deno.test('the raw message is base64url, no +, / or =', () => {
  const raw = buildMime({ ...base, subject: 'Vraagje é?' });
  assert(!/[+/=]/.test(raw), raw.slice(0, 80));
});

Deno.test('headers: sender, recipient, subject, id, no reply headers on a first mail', () => {
  const { headers } = decode(buildMime(base));
  assertStringIncludes(headers, 'From: Sjoerd Geurts <sjoerd@cairnly.io>');
  assertStringIncludes(headers, 'To: info@track2.nl');
  assertStringIncludes(headers, 'Subject: Vraagje over jullie spoor 2-trajecten');
  assertStringIncludes(headers, 'Message-ID: <occ.test.1@cairnly.io>');
  assert(!headers.includes('In-Reply-To'));
  assert(!headers.includes('References'));
});

Deno.test('a non-ASCII subject is RFC 2047 encoded', () => {
  const { headers } = decode(buildMime({ ...base, subject: 'Re: Vraagje over cliënten' }));
  assertMatch(headers, /Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
});

Deno.test('a reply carries In-Reply-To and References', () => {
  const { headers } = decode(buildMime({ ...base, inReplyTo: '<their@x.nl>', references: '<ours@cairnly.io> <their@x.nl>' }));
  assertStringIncludes(headers, 'In-Reply-To: <their@x.nl>');
  assertStringIncludes(headers, 'References: <ours@cairnly.io> <their@x.nl>');
});

Deno.test('the signature appears only when asked for', () => {
  const without = decode(buildMime(base));
  assert(!without.html.includes('gmail_signature'));
  assert(!without.text.includes('career path clarity'));
  const withSig = decode(buildMime({ ...base, signature: true }));
  assertStringIncludes(withSig.html, 'class="gmail_signature"');
  assertStringIncludes(withSig.text, 'cairnly - career path clarity.');
});

Deno.test('links become anchors in HTML and label: url in text', () => {
  const { html, text } = decode(buildMime(base));
  assertStringIncludes(html, '<a href="https://cairnly.io/demo?a=1&amp;b=2">hier</a>');
  assertStringIncludes(text, 'hier: https://cairnly.io/demo?a=1&b=2');
});

Deno.test('a quote is escaped in HTML and prefixed in text', () => {
  const { html, text } = decode(
    buildMime({
      ...base,
      quote: { at: '2026-09-24T08:52:00Z', name: 'Ingrid', email: 'i@x.nl', text: 'Wat kost <b>dat</b>?\nGroet, Ingrid' },
    }),
  );
  assertStringIncludes(html, 'class="gmail_quote"');
  assertStringIncludes(html, 'Wat kost &lt;b&gt;dat&lt;/b&gt;?');
  assertStringIncludes(text, 'Op do 24 sep 2026 om 10:52 schreef Ingrid <i@x.nl>:');
  assertStringIncludes(text, '> Wat kost <b>dat</b>?');
});

Deno.test('quoteHeader writes the Dutch Gmail line in Amsterdam time', () => {
  assertEquals(quoteHeader('2026-09-24T08:52:00Z', 'Ingrid', 'i@x.nl'), 'Op do 24 sep 2026 om 10:52 schreef Ingrid <i@x.nl>:');
  assertEquals(quoteHeader('2026-12-01T08:05:00Z', null, 'i@x.nl'), 'Op di 1 dec 2026 om 09:05 schreef <i@x.nl>:');
});

Deno.test('message ids are unique and on our domain', () => {
  const a = newMessageId();
  const b = newMessageId();
  assert(a !== b);
  assertMatch(a, /^<occ\.[a-z0-9]+\.[a-z0-9]+@cairnly\.io>$/);
});
