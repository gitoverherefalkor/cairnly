import { describe, it, expect } from 'vitest';
import { formatSalaryRange } from './formatSalary';

describe('formatSalaryRange', () => {
  it('keeps yearly ranges as they were', () => {
    expect(formatSalaryRange(54000, 72000)).toBe('54–72k');
  });
  it('annualises a monthly range (DHD live-test case)', () => {
    expect(formatSalaryRange(5297, 5757)).toBe('64–69k');
  });
  it('handles one side only', () => {
    expect(formatSalaryRange(null, 60000)).toBe('60k');
    expect(formatSalaryRange(4500, null)).toBe('54k');
  });
  it('hides hourly rates and empties', () => {
    expect(formatSalaryRange(25, 40)).toBe('');
    expect(formatSalaryRange(null, null)).toBe('');
  });
});
