import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseRequest } from './request.ts';

Deno.test('rejects missing action', () => {
  assertEquals(parseRequest({}).ok, false);
});

Deno.test('rejects bad action', () => {
  assertEquals(parseRequest({ action: 'delete', custom_resume_id: 'x' }).ok, false);
});

Deno.test('accepts analyze', () => {
  const r = parseRequest({ action: 'analyze', custom_resume_id: 'abc' });
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.value.action, 'analyze');
});

Deno.test('apply requires non-empty decisions with valid shape', () => {
  assertEquals(parseRequest({ action: 'apply', custom_resume_id: 'x', decisions: [] }).ok, false);
  assertEquals(parseRequest({ action: 'apply', custom_resume_id: 'x', decisions: [{ id: 'a', action: 'nope' }] }).ok, false);
  const r = parseRequest({
    action: 'apply', custom_resume_id: 'x',
    decisions: [{ id: 'a', action: 'apply', user_input: 'detail' }, { id: 'b', action: 'skip' }],
  });
  assertEquals(r.ok, true);
});

Deno.test('caps decisions at 10', () => {
  const decisions = Array.from({ length: 11 }, (_, i) => ({ id: `i${i}`, action: 'skip' }));
  assertEquals(parseRequest({ action: 'apply', custom_resume_id: 'x', decisions }).ok, false);
});

Deno.test('rejects duplicate decision ids', () => {
  assertEquals(parseRequest({ action: 'apply', custom_resume_id: 'x', decisions: [{ id: 'a', action: 'apply' }, { id: 'a', action: 'skip' }] }).ok, false);
});
