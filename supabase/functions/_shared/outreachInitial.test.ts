import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  categoryWords,
  DEFAULT_BESPOKE,
  initialSubject,
  INITIAL_SUBJECTS,
  parseInitial,
  renderInitial,
  type InitialInput,
} from './outreachInitial.ts';

const base: InitialInput = {
  slug: 'track2',
  bureau: 'Track2 B.V.',
  contactpersoon: null,
  categorie: 'D',
  openingshaak: 'Almeers bureau gespecialiseerd in tweedespoortrajecten en casemanagement (klanttevredenheid 8,5).',
  campaign: 'bureaus-sep26',
  subjectVariant: 'b',
};

Deno.test('the plain skeleton has no opening line and the default voorwerk sentence', () => {
  const body = renderInitial(base);
  assert(!body.includes('Ik zag dat jullie'), body);
  assertStringIncludes(body, DEFAULT_BESPOKE);
  assert(body.startsWith('Beste team van Track2,\n\nIk ben Sjoerd Geurts'), body);
  assert(body.endsWith('Groet,\nSjoerd'), body);
  assert(!/[—–]/.test(body), 'no dashes in outgoing Dutch mail');
});

Deno.test('the demo link carries this agency and its campaign', () => {
  const body = renderInitial(base);
  assertStringIncludes(body, '[Bekijk Marcels sessie (2 minuten)](https://cairnly.io/demo?');
  assertStringIncludes(body, 'utm_content=track2');
  assertStringIncludes(body, 'utm_campaign=bureaus-sep26');
  assertStringIncludes(body, '[cairnly.io/partners](https://cairnly.io/partners)');
});

Deno.test('the personal lines land where the real mail had them', () => {
  const body = renderInitial(base, {
    opening: 'Ik zag dat jullie vanuit Almere werken met een 8,5 van cliënten.',
    bespoke: 'Bij casemanagement scheelt dat vooral uitzoekwerk per kandidaat.',
  });
  assert(body.startsWith('Beste team van Track2,\n\nIk zag dat jullie vanuit Almere'), body);
  assertStringIncludes(body, 'arbeidsdeskundige binnen met richting in plaats van met een leeg vel. Bij casemanagement scheelt');
  assert(!body.includes(DEFAULT_BESPOKE));
});

Deno.test('category decides the trajectory and who the candidate meets', () => {
  assertEquals(categoryWords('D').rol, 'arbeidsdeskundige');
  assertEquals(categoryWords('O'), { traject: 'Voor een outplacementtraject', rol: 'coach', rollen: 'coaches' });
  assertEquals(categoryWords(null).rol, 'adviseur');
  assertStringIncludes(renderInitial({ ...base, categorie: 'O' }), 'wat jullie coaches ervan vinden');
});

Deno.test('salutation traps from the seed carry over', () => {
  assert(renderInitial({ ...base, bureau: 'Rea College Pluryn', contactpersoon: 'A. Bosman' }).startsWith('Beste team van Rea College Pluryn,'));
  assert(renderInitial({ ...base, contactpersoon: 'Robert (achternaam onbekend)' }).startsWith('Beste Robert,'));
  assert(renderInitial({ ...base, contactpersoon: 'Nanya Radema (directie)' }).startsWith('Beste Nanya,'));
});

Deno.test('subject follows the A/B assignment, unassigned gets the original', () => {
  assertEquals(initialSubject(null), INITIAL_SUBJECTS.a);
  assertEquals(initialSubject('b'), INITIAL_SUBJECTS.b);
});

const toolResp = (input: unknown) => ({ content: [{ type: 'tool_use', name: 'write_first_mail', input }] });

Deno.test('parseInitial accepts an empty opening and rejects a dash or a long sentence', () => {
  assertEquals(parseInitial(toolResp({ opening: '', bespoke: 'Dat scheelt voorbereidingstijd.' })), {
    opening: '',
    bespoke: 'Dat scheelt voorbereidingstijd.',
  });
  assertEquals(parseInitial(toolResp({ opening: 'Ik zag dat jullie — heel mooi — werken.', bespoke: 'Kort.' })), null);
  assertEquals(parseInitial(toolResp({ opening: 'Jullie werken landelijk.', bespoke: 'Kort.' })), null);
  const long = Array.from({ length: 25 }, () => 'woord').join(' ') + '.';
  assertEquals(parseInitial(toolResp({ opening: '', bespoke: long })), null);
});
