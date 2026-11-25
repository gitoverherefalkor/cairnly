import { describe, it, expect, beforeEach, vi } from 'vitest';
import { REGION, countryFromSurveyPick, countryNameForPickKey, regionBandKey } from './countryToRegion';

// Minimal localStorage stand-in (tests run in node).
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
});

const ENCORE_REGION_Q = 'c3c3c3c3-0001-4000-a000-000000000003';

describe('country for the profile page', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it('maps picker keys to checkout country names', () => {
    expect(countryNameForPickKey('NL')).toBe('Netherlands');
    expect(countryNameForPickKey('CZ')).toBe('Czech Republic');
    expect(countryNameForPickKey('uk-london')).toBe('United Kingdom');
    expect(countryNameForPickKey('us-low')).toBe('United States');
    expect(countryNameForPickKey('elsewhere')).toBeNull();
  });

  it('uses the remembered pick when it matches the stored band', () => {
    store[`region_pick_${ENCORE_REGION_Q}`] = 'NL';
    expect(countryFromSurveyPick(REGION.nwEurope)).toBe('Netherlands');
  });

  it('ignores a remembered pick from a different band', () => {
    store[`region_pick_${ENCORE_REGION_Q}`] = 'ES';
    expect(countryFromSurveyPick(REGION.nwEurope)).toBeNull();
  });

  it('never guesses a country inside a shared band', () => {
    expect(countryFromSurveyPick(REGION.nwEurope)).toBeNull();
  });

  it('derives single-country bands without a hint', () => {
    expect(countryFromSurveyPick(REGION.switzerland)).toBe('Switzerland');
    expect(countryFromSurveyPick(REGION.ukOther)).toBe('United Kingdom');
  });

  it('finds the translation key for a band', () => {
    expect(regionBandKey('Northern and Western Europe')).toBe('nwEurope');
    expect(regionBandKey('Mars')).toBeNull();
  });
});
