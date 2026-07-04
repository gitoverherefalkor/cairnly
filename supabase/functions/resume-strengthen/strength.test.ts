import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  selectIssues,
  computeScore,
  getLineAtTarget,
  setLineAtTarget,
  applyDecisions,
  reviewInFlight,
  REVIEW_STALE_MS,
  type StrengthReview,
  type StrengthIssue,
} from './strength.ts';

const resume = {
  contact: { name: 'Test' },
  summary: 'A generic summary.',
  experience: [
    { title: 'PM', company: 'Acme', bullets: ['Did stuff', 'Managed $630,000 in Q2.'] },
    { title: 'Analyst', company: 'Beta', bullets: ['Excellent communication.'] },
  ],
  skills_grouped: { technical: ['Excel'], tools: [], soft: ['Team player'], languages: [] },
  education: [],
  highlights: ['Owned the Atlas migration via the FRED pipeline.'],
};

const iss = (over: Partial<StrengthIssue>): StrengthIssue => ({
  id: 'iss_1', flag: 'jargon', card_type: 'one_tap', impact: 5,
  target: { section: 'summary' }, original_text: 'A generic summary.',
  suggested_text: 'Better.', status: 'pending', ...over,
});

Deno.test('selectIssues caps at 5 for baseline >= 40, sorted by impact desc', () => {
  const cands = [3, 9, 1, 7, 5, 8, 2].map((impact, i) =>
    iss({ id: `iss_${i}`, impact }));
  const r = selectIssues(62, cands, resume);
  assertEquals(r.issues.length, 5);
  assertEquals(r.issues.map((x) => x.impact), [9, 8, 7, 5, 3]);
  assertEquals(r.score, 62);
  assertEquals(r.score_potential, Math.min(100, 62 + 9 + 8 + 7 + 5 + 3));
});

Deno.test('selectIssues caps at 7 when baseline < 40', () => {
  const cands = Array.from({ length: 9 }, (_, i) => iss({ id: `iss_${i}`, impact: i + 1 }));
  const r = selectIssues(35, cands, resume);
  assertEquals(r.issues.length, 7);
});

Deno.test('selectIssues drops candidates whose target does not resolve', () => {
  const bad = iss({ id: 'iss_bad', target: { section: 'experience', exp_index: 9, bullet_index: 0 } });
  const good = iss({ id: 'iss_ok' });
  const r = selectIssues(50, [bad, good], resume);
  assertEquals(r.issues.map((x) => x.id), ['iss_ok']);
});

Deno.test('score_potential never exceeds 100', () => {
  const cands = [iss({ impact: 10 }), iss({ id: 'iss_2', impact: 10, target: { section: 'highlights', index: 0 } })];
  const r = selectIssues(95, cands, resume);
  assertEquals(r.score_potential, 100);
});

Deno.test('getLineAtTarget resolves every target shape', () => {
  assertEquals(getLineAtTarget(resume, { section: 'summary' }), 'A generic summary.');
  assertEquals(getLineAtTarget(resume, { section: 'experience', exp_index: 0, bullet_index: 1 }), 'Managed $630,000 in Q2.');
  assertEquals(getLineAtTarget(resume, { section: 'highlights', index: 0 }), 'Owned the Atlas migration via the FRED pipeline.');
  assertEquals(getLineAtTarget(resume, { section: 'skills', group: 'soft', index: 0 }), 'Team player');
  assertEquals(getLineAtTarget(resume, { section: 'experience', exp_index: 5, bullet_index: 0 }), null);
});

Deno.test('setLineAtTarget replaces exactly one line and does not mutate input', () => {
  const next = setLineAtTarget(resume, { section: 'experience', exp_index: 1, bullet_index: 0 }, 'Proved it.');
  assertEquals(next.experience[1].bullets[0], 'Proved it.');
  assertEquals(resume.experience[1].bullets[0], 'Excellent communication.'); // untouched
  assertEquals(next.experience[0].bullets, resume.experience[0].bullets);   // other lines identical
});

Deno.test('computeScore = base + applied impacts, capped at potential', () => {
  const review: StrengthReview = {
    status: 'ready', score: 0, score_base: 60, score_potential: 80,
    language: 'en', generated_at: 'x',
    issues: [
      iss({ id: 'a', impact: 8, status: 'applied' }),
      iss({ id: 'b', impact: 5, status: 'skipped' }),
      iss({ id: 'c', impact: 30, status: 'applied' }), // absurd impact still capped
    ],
  };
  assertEquals(computeScore(review), 80);
});

Deno.test('applyDecisions: one_tap patches resume, skip persists, unknown id throws', () => {
  const review: StrengthReview = {
    status: 'ready', score: 62, score_base: 62, score_potential: 84,
    language: 'en', generated_at: 'x',
    issues: [
      iss({ id: 'a', card_type: 'one_tap', impact: 8,
        target: { section: 'experience', exp_index: 1, bullet_index: 0 },
        suggested_text: 'Supported bilingual customers for four years.' }),
      iss({ id: 'b', card_type: 'needs_input', impact: 6,
        target: { section: 'experience', exp_index: 0, bullet_index: 1 },
        question: 'Of what?', example: 'ad spend', preview_template: 'Managed {answer}.',
        suggested_text: undefined }),
      iss({ id: 'c', impact: 4, target: { section: 'highlights', index: 0 } }),
    ],
  };
  const out = applyDecisions(resume, review, [
    { id: 'a', action: 'apply' },
    { id: 'b', action: 'apply', user_input: '$630K in ad spend, cutting CPL 18%' },
    { id: 'c', action: 'skip' },
  ]);
  // one_tap applied immediately:
  assertEquals(out.patchedResume.experience[1].bullets[0], 'Supported bilingual customers for four years.');
  // needs_input queued for compose, NOT patched yet:
  assertEquals(out.patchedResume.experience[0].bullets[1], 'Managed $630,000 in Q2.');
  assertEquals(out.composeItems.length, 1);
  assertEquals(out.composeItems[0].id, 'b');
  assertEquals(out.composeItems[0].user_input, '$630K in ad spend, cutting CPL 18%');
  // statuses: a applied, b stays pending until compose lands, c skipped
  const st = Object.fromEntries(out.review.issues.map((i) => [i.id, i.status]));
  assertEquals(st, { a: 'applied', b: 'pending', c: 'skipped' });
  // score reflects only what's actually applied so far:
  assertEquals(out.review.score, 62 + 8);
  // final score precomputed for WF10 to stamp after compose:
  assertEquals(out.finalScoreAfterCompose, Math.min(84, 62 + 8 + 6));

  assertThrows(() => applyDecisions(resume, review, [{ id: 'nope', action: 'apply' }]));
  // needs_input without user_input throws:
  assertThrows(() => applyDecisions(resume, review, [{ id: 'b', action: 'apply' }]));
  // user_input longer than 500 chars throws:
  assertThrows(() => applyDecisions(resume, review, [{ id: 'b', action: 'apply', user_input: 'x'.repeat(501) }]));
});

Deno.test('applyDecisions throws on duplicate decision ids in one payload', () => {
  const review: StrengthReview = {
    status: 'ready', score: 62, score_base: 62, score_potential: 84,
    language: 'en', generated_at: 'x',
    issues: [iss({ id: 'a', impact: 8 })],
  };
  // apply-then-skip for the same id in one payload must be rejected outright,
  // not silently patch the line while leaving status 'skipped':
  assertThrows(() => applyDecisions(resume, review, [
    { id: 'a', action: 'apply' },
    { id: 'a', action: 'skip' },
  ]));
});

Deno.test('applyDecisions throws when the review already marks the issue applied', () => {
  const review: StrengthReview = {
    status: 'ready', score: 70, score_base: 62, score_potential: 84,
    language: 'en', generated_at: 'x',
    issues: [iss({ id: 'a', impact: 8, status: 'applied' })],
  };
  // inter-call replay: a later request re-applying an already-applied issue throws
  assertThrows(() => applyDecisions(resume, review, [{ id: 'a', action: 'apply' }]));
});

Deno.test('selectIssues clamps LLM-authored impacts into 1..10', () => {
  const cands = [
    iss({ id: 'iss_hi', impact: 30 }),
    iss({ id: 'iss_neg', impact: -5, target: { section: 'highlights', index: 0 } }),
    iss({ id: 'iss_nan', impact: NaN, target: { section: 'skills', group: 'soft', index: 0 } }),
  ];
  const r = selectIssues(50, cands, resume);
  const impacts = Object.fromEntries(r.issues.map((x) => [x.id, x.impact]));
  assertEquals(impacts, { iss_hi: 10, iss_neg: 1, iss_nan: 1 });
});

Deno.test('getLineAtTarget rejects non-numeric indices (n8n Code-node slip)', () => {
  // deno-lint-ignore no-explicit-any
  assertEquals(getLineAtTarget(resume, { section: 'experience', exp_index: '0', bullet_index: 0 } as any), null);
  // deno-lint-ignore no-explicit-any
  assertEquals(getLineAtTarget(resume, { section: 'highlights', index: '0' } as any), null);
  // deno-lint-ignore no-explicit-any
  assertEquals(getLineAtTarget(resume, { section: 'skills', group: 'soft', index: 0.5 } as any), null);
});

// --- reviewInFlight: staleness guard for wedged pending/applying reviews ---

const NOW = Date.parse('2026-07-04T12:00:00.000Z');

const flightReview = (over: Partial<StrengthReview>): StrengthReview => ({
  status: 'pending', score: 50, score_base: 50, score_potential: 60,
  language: 'en', generated_at: new Date(NOW - 1_000).toISOString(), issues: [], ...over,
});

Deno.test('reviewInFlight: fresh pending is in flight', () => {
  const r = flightReview({ status: 'pending', status_changed_at: new Date(NOW - 1_000).toISOString() });
  assertEquals(reviewInFlight(r, NOW), true);
  // falls back to generated_at when status_changed_at is absent:
  assertEquals(reviewInFlight(flightReview({ status: 'pending' }), NOW), true);
});

Deno.test('reviewInFlight: applying older than the staleness window is dead', () => {
  const r = flightReview({
    status: 'applying',
    status_changed_at: new Date(NOW - REVIEW_STALE_MS - 1).toISOString(),
  });
  assertEquals(reviewInFlight(r, NOW), false);
});

Deno.test('reviewInFlight: ready is never in flight', () => {
  const r = flightReview({ status: 'ready', status_changed_at: new Date(NOW).toISOString() });
  assertEquals(reviewInFlight(r, NOW), false);
});

Deno.test('reviewInFlight: null review is not in flight', () => {
  assertEquals(reviewInFlight(null, NOW), false);
});

Deno.test('reviewInFlight: missing or garbage timestamp counts as stale', () => {
  // no status_changed_at AND no generated_at → recoverable
  assertEquals(reviewInFlight(flightReview({ generated_at: undefined as unknown as string }), NOW), false);
  // unparseable timestamp → recoverable
  assertEquals(reviewInFlight(flightReview({ generated_at: 'not-a-date' }), NOW), false);
});
