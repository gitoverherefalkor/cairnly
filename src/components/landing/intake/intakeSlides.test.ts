import { describe, expect, it } from 'vitest';
import { intakeShotFor, pitchShotFor, INTAKE_SHOT_SRC, PLANS } from './intakeSlides';
import { beatsFor, VALID_INTENTS } from '../../../../supabase/functions/intake-chat/prompts';

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
    ['default', 'good-at-it', 'ai-worried', 'life-changed', 'understand-myself', 'other', 'nonsense'].forEach((k) =>
      expect(INTAKE_SHOT_SRC[pitchShotFor(k)]).toMatch(/\.jpg$/),
    );
  });
});

describe('PLANS mirrors the server beat plans', () => {
  it('has a matching-length plan for every server intent, and no extras', () => {
    for (const intent of VALID_INTENTS) {
      expect(PLANS[intent], `missing plan for ${intent}`).toBeDefined();
      expect(PLANS[intent].length, `plan length for ${intent}`).toBe(beatsFor(intent).length);
    }
    expect(Object.keys(PLANS).sort()).toEqual([...VALID_INTENTS].sort());
  });
});
