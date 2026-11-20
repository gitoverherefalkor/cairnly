import { describe, it, expect } from 'vitest';
import { distanceUnitForCountry } from './distanceUnit';

describe('distanceUnitForCountry', () => {
  it('uses miles for the US and UK', () => {
    expect(distanceUnitForCountry('us')).toBe('mi');
    expect(distanceUnitForCountry('gb')).toBe('mi');
    expect(distanceUnitForCountry('GB')).toBe('mi');
  });
  it('uses km everywhere else', () => {
    for (const c of ['nl', 'de', 'ie', 'ca', 'au', 'fr']) {
      expect(distanceUnitForCountry(c)).toBe('km');
    }
  });
});
