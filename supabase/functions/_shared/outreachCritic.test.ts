import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildCriticMessage, mayAutoApprove, parseCritique } from './outreachCritic.ts';

const resp = (input: unknown) => ({ content: [{ type: 'tool_use', name: 'judge_mail', input }] });

Deno.test('a good verdict carries no reasons', () => {
  assertEquals(parseCritique(resp({ verdict: 'goed', reasons: ['x'], zin: 'y' })), { verdict: 'goed', reasons: [], zin: null });
});

Deno.test('a krom verdict keeps up to three reasons and the sentence', () => {
  const c = parseCritique(resp({ verdict: 'krom', reasons: ['a', 'b', 'c', 'd'], zin: ' Gezien jullie focus. ' }));
  assertEquals(c?.reasons, ['a', 'b', 'c']);
  assertEquals(c?.zin, 'Gezien jullie focus.');
});

Deno.test('anything off-pattern is null, never a silent pass', () => {
  assertEquals(parseCritique(resp({ verdict: 'prima', reasons: [], zin: null })), null);
  assertEquals(parseCritique({ content: [{ type: 'text' }] }), null);
});

Deno.test('only a good verdict or pure template may be auto-approved', () => {
  assert(mayAutoApprove({ verdict: 'goed', reasons: [] }));
  assert(mayAutoApprove({ verdict: 'template', reasons: [] }));
  assert(!mayAutoApprove({ verdict: 'krom', reasons: ['x'] }));
  assert(!mayAutoApprove({ verdict: 'onbekend', reasons: [] }));
  assert(!mayAutoApprove(null));
});

Deno.test('the critic sees the note, the personal sentences and the whole mail', () => {
  const m = buildCriticMessage({ bureau: 'Track2', body: 'Beste Mark,\n\nHoi.', personal: ['Ik zag dat jullie x.'], notitie: 'Almeers bureau.' });
  assertStringIncludes(m, 'ONDERZOEKSNOTITIE: Almeers bureau.');
  assertStringIncludes(m, '- Ik zag dat jullie x.');
  assertStringIncludes(m, 'DE HELE MAIL:\nBeste Mark,');
});
