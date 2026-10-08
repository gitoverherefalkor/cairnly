import { describe, expect, it } from 'vitest';
import { blockedFromTop3, designLabel, ownershipOf } from './aiImpactRules';

const ans = (score: number, physical = 0.1, orchestrator = 0.1) => ({
  physical_role: { noul: physical },
  orchestrator_role: { noul: orchestrator },
  ai_impact: { score },
});

describe('designLabel (2.3b)', () => {
  it('physical role is Minimal regardless of score', () => {
    expect(designLabel(ans(3.8, 0.81))).toEqual({ label: 'Minimal', rule: 'physical' });
  });

  it('0.8 exactly is not physical', () => {
    expect(designLabel(ans(0.2, 0.8)).label).toBe('Moderate');
  });

  it('floor: low scores become Moderate for normal roles', () => {
    expect(designLabel(ans(0.3))).toEqual({ label: 'Moderate', rule: 'floor' });
    expect(designLabel(ans(1.49)).label).toBe('Moderate');
  });

  it('High from 1.5 up to 2.99', () => {
    expect(designLabel(ans(1.5)).label).toBe('High');
    expect(designLabel(ans(2.49)).label).toBe('High');
    expect(designLabel(ans(2.5)).label).toBe('High');
    expect(designLabel(ans(2.99)).label).toBe('High');
  });

  it('Severe only from 3.0, Critical only from 4.0', () => {
    expect(designLabel(ans(3.0)).label).toBe('Severe');
    expect(designLabel(ans(3.5)).label).toBe('Severe');
    expect(designLabel(ans(3.99)).label).toBe('Severe');
    expect(designLabel(ans(4.0)).label).toBe('Critical');
  });

  it('orchestrator is a ceiling of Moderate, Minimal allowed', () => {
    expect(designLabel(ans(3.6, 0.1, 0.9))).toEqual({ label: 'Moderate', rule: 'orchestrator' });
    expect(designLabel(ans(0.2, 0.1, 0.9))).toEqual({ label: 'Minimal', rule: 'orchestrator' });
  });

  it('physical wins over orchestrator', () => {
    expect(designLabel(ans(2, 0.9, 0.9)).rule).toBe('physical');
  });
});

describe('ownershipOf', () => {
  it('founder and freelance_fractional are own work', () => {
    expect(ownershipOf({ path_type: 'founder' })).toBe('own_work');
    expect(ownershipOf({ path_type: 'freelance_fractional' })).toBe('own_work');
  });

  it('"Own Company" size type is own work', () => {
    expect(ownershipOf({ path_type: 'traditional', company_size_type: 'Own Company (solo)' })).toBe('own_work');
  });

  it('missing path_type counts as employee', () => {
    expect(ownershipOf({ path_type: null, company_size_type: null })).toBe('employee');
    expect(ownershipOf({})).toBe('employee');
  });

  it('other paths are employee', () => {
    expect(ownershipOf({ path_type: 'traditional', company_size_type: 'Large Enterprise' })).toBe('employee');
  });
});

describe('blockedFromTop3', () => {
  it('employees with Severe or Critical are blocked', () => {
    expect(blockedFromTop3('Severe', 'employee')).toBe(true);
    expect(blockedFromTop3('Critical', 'employee')).toBe(true);
  });

  it('High is not an alarm', () => {
    expect(blockedFromTop3('High', 'employee')).toBe(false);
  });

  it('own work is never blocked', () => {
    expect(blockedFromTop3('Critical', 'own_work')).toBe(false);
  });
});
