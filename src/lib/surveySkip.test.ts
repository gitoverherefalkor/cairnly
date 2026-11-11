import { describe, it, expect } from 'vitest';
import { isQuestionSkipped } from './surveySkip';

const q52 = {
  label: 'What does your partner hope for in the coming years?',
  config: { show_if: { question_id: 'q51', not_in: ["I don't have a partner"] } },
};

describe('isQuestionSkipped', () => {
  it('hides 5.2 when there is no partner', () => {
    expect(isQuestionSkipped(q52, { q51: "I don't have a partner" })).toBe(true);
  });
  it('shows 5.2 for any other answer or no answer yet', () => {
    expect(isQuestionSkipped(q52, { q51: 'We make plans together' })).toBe(false);
    expect(isQuestionSkipped(q52, {})).toBe(false);
  });
  it('supports multi-select answers and the `in` rule', () => {
    const q = { config: { show_if: { question_id: 'x', in: ['A'] } } };
    expect(isQuestionSkipped(q, { x: ['B', 'A'] })).toBe(false);
    expect(isQuestionSkipped(q, { x: ['B'] })).toBe(true);
  });
  it('still hides license-key questions', () => {
    expect(isQuestionSkipped({ label: 'Enter your access code' }, {})).toBe(true);
  });
});
