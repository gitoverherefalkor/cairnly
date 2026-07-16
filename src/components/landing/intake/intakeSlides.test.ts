import { describe, expect, it } from 'vitest';
import { intakeShotFor, INTAKE_SHOT_SRC, PLANS } from './intakeSlides';
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
  it('opens default and life-changed on the dashboard close-up', () => {
    expect(intakeShotFor('default', 1)).toBe('dashboard');
    expect(intakeShotFor('life-changed', 1)).toBe('dashboard');
    expect(intakeShotFor('nonsense', 1)).toBe('dashboard'); // falls back to the default plan
  });
  it('leaves the carousel alone (null) on beats without a specific screen', () => {
    expect(intakeShotFor('good-at-it', 1)).toBeNull(); // grounding beat keeps the pill slide
    expect(intakeShotFor('other', 2)).toBeNull();
    expect(intakeShotFor('good-at-it', 4)).toBeNull(); // dream beat: no capture yet
    expect(intakeShotFor('good-at-it', 99)).toBeNull(); // out of range
  });
  it('has an image path for every shot', () => {
    Object.values(INTAKE_SHOT_SRC).forEach((src) => expect(src).toMatch(/^\/images\/live\/landing\/intake\/.+\.jpg$/));
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
