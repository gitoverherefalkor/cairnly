import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { templateRejection } from './outreachRejection.ts';

const count = (s: string, ch: string) => s.split(ch).length - 1;

Deno.test('a rejection before any code leaves the door open and asks nothing', () => {
  const body = templateRejection({ bureau: 'WerkMOED BV', replierName: 'Lydia de Groot', codeIssued: false });
  assert(body.startsWith('Hoi Lydia,'), body);
  assertStringIncludes(body, 'gratis testcode');
  assertEquals(count(body, '?'), 0);
  assert(body.endsWith('Groet,\nSjoerd'));
  assert(!/[—–]/.test(body));
});

Deno.test('a rejection after a code asks why, once, with four choices', () => {
  const body = templateRejection({ bureau: 'WerkMOED BV', replierName: null, codeIssued: true });
  assert(body.startsWith('Beste team van WerkMOED,'), body);
  assertEquals(count(body, '?'), 1);
  assertStringIncludes(body, '(a) te weinig tijd, (b) past niet bij onze aanpak, (c) prijs, (d) anders');
  assert(!body.includes('testcode'), 'no second code offer');
});

Deno.test('initials in the display name fall back to the team salutation', () => {
  const body = templateRejection({ bureau: 'Caparis NV', replierName: 'A. Bonnema', codeIssued: false });
  assert(body.startsWith('Beste team van Caparis,'), body);
});
