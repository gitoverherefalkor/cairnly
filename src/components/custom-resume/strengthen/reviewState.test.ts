import { describe, it, expect } from 'vitest';
import { initReviewState, reviewReducer, buildApplyPayload, projectedScore } from './reviewState';
import type { StrengthIssue, StrengthReview } from './types';

const issue = (id: string, over: Partial<StrengthIssue> = {}): StrengthIssue => ({
  id, flag: 'jargon', card_type: 'one_tap', impact: 5,
  target: { section: 'summary' }, original_text: 'orig', suggested_text: 'better',
  status: 'pending', ...over,
});

const review: StrengthReview = {
  status: 'ready', score: 62, score_base: 62, score_potential: 84,
  language: 'en', generated_at: 'x',
  issues: [issue('a', { impact: 8 }), issue('b', { impact: 6, card_type: 'needs_input', question: 'q', suggested_text: undefined }), issue('c', { impact: 4 })],
};

describe('reviewReducer', () => {
  it('starts at the first pending issue', () => {
    const s = initReviewState(review);
    expect(s.cursor).toBe('a');
  });

  it('accept stages the decision and advances', () => {
    let s = initReviewState(review);
    s = reviewReducer(s, { type: 'accept', id: 'a' });
    expect(s.staged['a']).toEqual({ action: 'apply' });
    expect(s.cursor).toBe('b');
  });

  it('accept with input stages user_input', () => {
    let s = initReviewState(review);
    s = reviewReducer(s, { type: 'accept', id: 'a' });
    s = reviewReducer(s, { type: 'accept', id: 'b', user_input: 'the detail' });
    expect(s.staged['b']).toEqual({ action: 'apply', user_input: 'the detail' });
    expect(s.cursor).toBe('c');
  });

  it('needs_input without text cannot be accepted', () => {
    let s = initReviewState(review);
    s = reviewReducer(s, { type: 'accept', id: 'a' });
    const before = s;
    s = reviewReducer(s, { type: 'accept', id: 'b', user_input: '  ' });
    expect(s).toBe(before); // no-op
  });

  it('skip stages skip and advances; undo restores', () => {
    let s = initReviewState(review);
    s = reviewReducer(s, { type: 'skip', id: 'a' });
    expect(s.staged['a']).toEqual({ action: 'skip' });
    s = reviewReducer(s, { type: 'undo', id: 'a' });
    expect(s.staged['a']).toBeUndefined();
    expect(s.cursor).toBe('a');
  });

  it('cursor null when all handled', () => {
    let s = initReviewState(review);
    for (const id of ['a', 'c']) s = reviewReducer(s, { type: 'accept', id });
    s = reviewReducer(s, { type: 'accept', id: 'b', user_input: 'd' });
    expect(s.cursor).toBeNull();
  });

  it('already-applied issues are never in the queue', () => {
    const r = { ...review, issues: [issue('a', { status: 'applied' }), issue('b')] };
    const s = initReviewState(r);
    expect(s.cursor).toBe('b');
    expect(s.queue).toEqual(['b']);
  });
});

describe('buildApplyPayload / projectedScore', () => {
  it('builds only staged decisions, applies before skips', () => {
    let s = initReviewState(review);
    s = reviewReducer(s, { type: 'accept', id: 'a' });
    s = reviewReducer(s, { type: 'skip', id: 'b' });
    expect(buildApplyPayload(s)).toEqual([
      { id: 'a', action: 'apply' },
      { id: 'b', action: 'skip' },
    ]);
  });

  it('projectedScore adds staged apply impacts, capped at potential', () => {
    let s = initReviewState(review);
    s = reviewReducer(s, { type: 'accept', id: 'a' });
    expect(projectedScore(review, s)).toBe(70);
    s = reviewReducer(s, { type: 'accept', id: 'b', user_input: 'd' });
    s = reviewReducer(s, { type: 'accept', id: 'c' });
    expect(projectedScore(review, s)).toBe(80);
  });
});
