import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { templateActivation } from './outreachFollowUp.ts';
import { MAX_WORDS, validateOutgoing } from './outreachValidate.ts';

const input = {
  bureau: 'RegioEffect',
  contactpersoon: 'Monique van Wagenberg',
  link: 'https://cairnly.io/p/regioeffect?code=REGIO-AAAA-BBBB-CCCC&lang=nl',
  expiresAt: '2026-10-23T10:55:04Z',
};

Deno.test('the activation nudge greets, carries the link and the expiry date', () => {
  const body = templateActivation(input);
  assertEquals(body.split('\n')[0], 'Beste Monique,');
  assertStringIncludes(body, input.link);
  assertStringIncludes(body, 'geldig tot 23 oktober');
});

Deno.test('the activation nudge passes the outgoing checks, with and without an expiry', () => {
  for (const i of [input, { ...input, expiresAt: null, contactpersoon: null }]) {
    const v = validateOutgoing(templateActivation(i), { soort: 'activation', expectedSalutation: null, maxWords: MAX_WORDS.activation });
    assertEquals(v, { ok: true, problems: [] });
  }
});
