import { describe, it, expect } from 'vitest';
import { defaultJobsCountry } from './jobsCountryDefault';

const supported = ['nl', 'de', 'be', 'gb', 'us', 'ca', 'ch', 'es', 'au', 'fr'];

describe('defaultJobsCountry', () => {
  it('uses a recognised checkout country first', () => {
    expect(defaultJobsCountry({ supported, profileCountry: 'de', regionBand: 'Northern and Western Europe' })).toBe('de');
    expect(defaultJobsCountry({ supported, profileCountry: 'The Netherlands' })).toBe('nl');
  });
  it('live test: no checkout country, NW Europe band, English UI → Netherlands, not US', () => {
    expect(defaultJobsCountry({ supported, profileCountry: null, regionBand: 'Northern and Western Europe', browserLocales: ['en-US'], uiLanguage: 'en' })).toBe('nl');
  });
  it('uses the exact survey pick when present', () => {
    expect(defaultJobsCountry({ supported, surveyPickKey: 'BE', regionBand: 'Northern and Western Europe' })).toBe('be');
    expect(defaultJobsCountry({ supported, surveyPickKey: 'uk-london' })).toBe('gb');
  });
  it('maps single-country bands', () => {
    expect(defaultJobsCountry({ supported, regionBand: 'United States (Average-Cost Regions)' })).toBe('us');
    expect(defaultJobsCountry({ supported, regionBand: 'Switzerland' })).toBe('ch');
  });
  it('uses a browser locale that fits the band', () => {
    expect(defaultJobsCountry({ supported, regionBand: 'Northern and Western Europe', browserLocales: ['de-DE'] })).toBe('de');
    expect(defaultJobsCountry({ supported, regionBand: 'Northern and Western Europe', browserLocales: ['es-ES'] })).toBe('nl');
  });
  it('falls back to US with nothing to go on', () => {
    expect(defaultJobsCountry({ supported })).toBe('us');
    expect(defaultJobsCountry({ supported, uiLanguage: 'nl' })).toBe('nl');
  });
});
