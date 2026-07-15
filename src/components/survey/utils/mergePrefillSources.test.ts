import { describe, it, expect } from 'vitest';
import { mergePrefillSources } from './mergePrefillSources';

describe('mergePrefillSources', () => {
  it('returns null when both sources are missing', () => {
    expect(mergePrefillSources(null, null)).toBeNull();
  });

  it('passes resume data through when there is no intake data', () => {
    const resume = { name: 'Mark', education: "Bachelor's degree" };
    expect(mergePrefillSources(resume, null)).toEqual(resume);
  });

  it('passes intake data through when there is no resume data', () => {
    const intake = { name: 'Mark', goals: 'I want work that feels mine.' };
    expect(mergePrefillSources(null, intake)).toEqual(intake);
  });

  it('resume wins per key, but intake keys survive when resume lacks them', () => {
    const resume = { name: 'Mark Janssen', years_experience: 12 };
    const intake = { name: 'Mark', goals: 'I want work that feels mine.', years_experience: 11 };
    expect(mergePrefillSources(resume, intake)).toEqual({
      name: 'Mark Janssen',
      years_experience: 12,
      goals: 'I want work that feels mine.',
    });
  });

  it('ignores empty values in resume data so intake can fill them', () => {
    const resume = { name: '', goals: null };
    const intake = { name: 'Mark', goals: 'Clarity on direction.' };
    expect(mergePrefillSources(resume, intake)).toEqual({
      name: 'Mark',
      goals: 'Clarity on direction.',
    });
  });
});
