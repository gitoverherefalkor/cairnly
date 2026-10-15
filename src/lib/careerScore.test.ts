import { describe, it, expect } from 'vitest';
import { isTopCareerType, visibleCareerScore } from './careerScore';

describe('visibleCareerScore', () => {
  it('shows the score for the Top 3', () => {
    expect(visibleCareerScore({ section_type: 'top_career_1', score: '91' })).toBe(91);
    expect(visibleCareerScore({ section_type: 'top_career_3', score: 78 })).toBe(78);
  });

  it('hides the score for every other career', () => {
    for (const t of ['runner_ups', 'outside_box', 'dream_jobs']) {
      expect(visibleCareerScore({ section_type: t, score: '61' })).toBeNull();
    }
  });

  it('returns null for missing or non-numeric scores', () => {
    expect(visibleCareerScore({ section_type: 'top_career_2', score: null })).toBeNull();
    expect(visibleCareerScore({ section_type: 'top_career_2', score: 'n/a' })).toBeNull();
    expect(visibleCareerScore(undefined)).toBeNull();
  });

  it('recognises only the three top slots', () => {
    expect(isTopCareerType('top_career_2')).toBe(true);
    expect(isTopCareerType('top_career_4')).toBe(false);
    expect(isTopCareerType(null)).toBe(false);
  });
});
