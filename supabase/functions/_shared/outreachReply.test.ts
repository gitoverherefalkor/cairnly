import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseClassification, statusForSentiment } from './outreachReply.ts';

const resp = (input: unknown) => ({ content: [{ type: 'tool_use', name: 'classify_reply', input }] });

Deno.test('an unsubscribe request never carries a concept', () => {
  const c = parseClassification(resp({ sentiment: 'stop', samenvatting: 'Wil geen mail meer.', concept: 'Beste X, jammer.' }));
  assertEquals(c?.sentiment, 'stop');
  assertEquals(c?.concept, null);
});

Deno.test('stop and rejection both close the agency', () => {
  assertEquals(statusForSentiment('stop'), 'afgewezen');
  assertEquals(statusForSentiment('afwijzing'), 'afgewezen');
  assertEquals(statusForSentiment('auto'), null);
});
