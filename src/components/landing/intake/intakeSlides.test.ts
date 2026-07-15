import { describe, expect, it } from 'vitest';
import { intakeShotFor, PITCH_SHOT_SRC, INTAKE_SHOT_SRC } from './intakeSlides';

describe('intakeShotFor', () => {
  it('pins the jobs-avoids screen on the good-at-it avoid beat', () => {
    expect(intakeShotFor('good-at-it', 3)).toBe('jobs-avoids');
  });
  it('pins the AI-impact screen on the ai-worried fluency beat', () => {
    expect(intakeShotFor('ai-worried', 2)).toBe('ai-impact');
  });
  it('pins salary/steps on the life-changed schedule beat', () => {
    expect(intakeShotFor('life-changed', 3)).toBe('salary-steps');
  });
  it('pins the key-insight screen on the understand-myself archetypes beat', () => {
    expect(intakeShotFor('understand-myself', 3)).toBe('key-insight');
  });
  it('falls back to the dashboard for unknown intents and out-of-range beats', () => {
    expect(intakeShotFor('other', 2)).toBe('dashboard');
    expect(intakeShotFor('nonsense', 1)).toBe('dashboard');
    expect(intakeShotFor('good-at-it', 99)).toBe('dashboard');
  });
  it('has an image path for every shot and every pitch intent', () => {
    Object.values(INTAKE_SHOT_SRC).forEach((src) => expect(src).toMatch(/^\/images\/live\/landing\/intake\/.+\.jpg$/));
    ['default', 'good-at-it', 'ai-worried', 'life-changed', 'understand-myself'].forEach((k) =>
      expect(PITCH_SHOT_SRC[k]).toBeTruthy(),
    );
  });
});
