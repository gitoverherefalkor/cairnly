import { describe, it, expect } from 'vitest';
import { splitHoursCeiling, joinHoursCeiling, sanitizeHours } from './hoursCeiling';
import { isQuestionAnswered } from '../questionValidation';

const schedule = { type: 'multiple_choice', required: true, allow_multiple: false };

describe('hoursCeiling', () => {
  it('round-trips a choice with an hours ceiling', () => {
    const stored = joinHoursCeiling('Part-time work', '24');
    expect(stored).toBe('Part-time work (max 24 hours/week)');
    expect(splitHoursCeiling(stored)).toEqual({ choice: 'Part-time work', hours: '24' });
  });

  it('leaves the answer untouched when there are no hours', () => {
    expect(joinHoursCeiling('Flexible hours', '')).toBe('Flexible hours');
    expect(splitHoursCeiling('Flexible hours')).toEqual({ choice: 'Flexible hours', hours: '' });
  });

  it('never writes a suffix without a choice to hang it on', () => {
    expect(joinHoursCeiling('', '24')).toBe('');
  });

  it('keeps the base choice matchable by WF1\'s includes() option filter', () => {
    // WF1's Process Survey Data1 does String(answer).includes(option).
    expect(joinHoursCeiling('Part-time work', '24').includes('Part-time work')).toBe(true);
  });

  it('survives the [NON-NEGOTIABLE] marker WF1 appends after ours', () => {
    const marked = `${joinHoursCeiling('Part-time work', '24')} [NON-NEGOTIABLE]`;
    // The marker is appended after, so the suffix no longer terminates the
    // string — the frontend only ever parses its own pre-submit value.
    expect(marked).toBe('Part-time work (max 24 hours/week) [NON-NEGOTIABLE]');
  });

  it('splits an "Other" answer without swallowing the hours into the text', () => {
    const stored = joinHoursCeiling('Other: Compressed weeks', '30');
    expect(splitHoursCeiling(stored).choice).toBe('Other: Compressed weeks');
  });

  it('sanitizes input to a plausible weekly number', () => {
    expect(sanitizeHours('24')).toBe('24');
    expect(sanitizeHours('2a4')).toBe('24');
    expect(sanitizeHours('008')).toBe('8');
    expect(sanitizeHours('999')).toBe('80');
    expect(sanitizeHours('')).toBe('');
    expect(sanitizeHours('abc')).toBe('');
  });

  it('still blocks a picked-but-empty "Other" when hours are filled in', () => {
    expect(isQuestionAnswered(schedule, joinHoursCeiling('other', '24'))).toBe(false);
    expect(isQuestionAnswered(schedule, joinHoursCeiling('Part-time work', '24'))).toBe(true);
  });
});
