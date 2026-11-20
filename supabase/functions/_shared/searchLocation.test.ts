import { describe, it, expect } from 'vitest';
import {
  normalizeDistance,
  normalizeDistanceUnit,
  linkedInDistanceMiles,
  locationCacheSuffix,
} from './searchLocation';

describe('normalizeDistance', () => {
  it('keeps the four UI options', () => {
    expect([10, 25, 50, 100].map(normalizeDistance)).toEqual([10, 25, 50, 100]);
  });
  it('accepts numeric strings', () => {
    expect(normalizeDistance('25')).toBe(25);
  });
  it('turns anything else into 0', () => {
    for (const bad of [undefined, null, '', 'abc', 7, -5, 9999, NaN]) {
      expect(normalizeDistance(bad)).toBe(0);
    }
  });
});

describe('normalizeDistanceUnit', () => {
  it('only accepts mi explicitly, everything else is km', () => {
    expect(normalizeDistanceUnit('mi')).toBe('mi');
    expect(normalizeDistanceUnit('km')).toBe('km');
    for (const other of [undefined, null, '', 'miles', 5]) {
      expect(normalizeDistanceUnit(other)).toBe('km');
    }
  });
});

describe('linkedInDistanceMiles', () => {
  it('snaps each km choice to the nearest LinkedIn step', () => {
    expect(linkedInDistanceMiles(10, 'km', 'Amsterdam')).toBe(5);
    expect(linkedInDistanceMiles(25, 'km', 'Amsterdam')).toBe(10);
    expect(linkedInDistanceMiles(50, 'km', 'Amsterdam')).toBe(25);
    expect(linkedInDistanceMiles(100, 'km', 'Amsterdam')).toBe(50);
  });
  it('passes miles straight through', () => {
    for (const mi of [10, 25, 50, 100]) {
      expect(linkedInDistanceMiles(mi, 'mi', 'Austin')).toBe(mi);
    }
  });
  it('is 0 without a distance', () => {
    expect(linkedInDistanceMiles(0, 'km', 'Amsterdam')).toBe(0);
    expect(linkedInDistanceMiles(0, 'mi', 'Austin')).toBe(0);
  });
  it('is 0 without a city, even when a distance was sent', () => {
    expect(linkedInDistanceMiles(50, 'km', '')).toBe(0);
    expect(linkedInDistanceMiles(50, 'mi', '   ')).toBe(0);
  });
});

describe('locationCacheSuffix', () => {
  it('is empty without a city, so old no-city keys are unchanged', () => {
    expect(locationCacheSuffix('', 0)).toBe('');
    expect(locationCacheSuffix('  ', 10)).toBe('');
  });
  it('separates different cities (the original bug)', () => {
    expect(locationCacheSuffix('Amsterdam', 0)).not.toBe(locationCacheSuffix('Berlin', 0));
  });
  it('separates different distances around the same city', () => {
    expect(locationCacheSuffix('Utrecht', 10)).not.toBe(locationCacheSuffix('Utrecht', 25));
    expect(locationCacheSuffix('Utrecht', 10)).not.toBe(locationCacheSuffix('Utrecht', 0));
  });
  it('ignores case and extra whitespace', () => {
    expect(locationCacheSuffix('  New   York ', 0)).toBe(locationCacheSuffix('new york', 0));
  });
});
