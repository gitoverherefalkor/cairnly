import { describe, it, expect } from 'vitest';
import { mapExtractedDataToSurvey } from './resumeDataMapper';

const REGION_Q = '11111111-1111-1111-1111-111111111114';

describe('mapExtractedDataToSurvey region from CV country', () => {
  it('derives the band from a single-band country', () => {
    expect(mapExtractedDataToSurvey({ country: 'NL' })[REGION_Q]).toBe('Northern and Western Europe');
    expect(mapExtractedDataToSurvey({ country: 'ch' })[REGION_Q]).toBe('Switzerland');
  });
  it('uses the parser band for US/UK, which need a city', () => {
    expect(
      mapExtractedDataToSurvey({ country: 'US', region: 'United States (High-Cost Regions)' })[REGION_Q],
    ).toBe('United States (High-Cost Regions)');
  });
  it('leaves region empty for a country we cannot price', () => {
    expect(mapExtractedDataToSurvey({ country: 'IN', region: 'Northern and Western Europe' })[REGION_Q]).toBeUndefined();
  });
  it('falls back to the band when no country is returned', () => {
    expect(mapExtractedDataToSurvey({ region: 'Canada' })[REGION_Q]).toBe('Canada');
  });
});
