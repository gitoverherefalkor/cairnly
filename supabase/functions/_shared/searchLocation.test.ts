import { describe, it, expect } from 'vitest';
import {
  normalizeDistanceKm,
  linkedInDistanceMiles,
  locationCacheSuffix,
} from './searchLocation';

describe('normalizeDistanceKm', () => {
  it('keeps the four UI options', () => {
    expect([10, 25, 50, 100].map(normalizeDistanceKm)).toEqual([10, 25, 50, 100]);
  });
  it('accepts numeric strings', () => {
    expect(normalizeDistanceKm('25')).toBe(25);
  });
  it('turns anything else into 0', () => {
    for (const bad of [undefined, null, '', 'abc', 7, -5, 9999, NaN]) {
      expect(normalizeDistanceKm(bad)).toBe(0);
    }
  });
});

describe('linkedInDistanceMiles', () => {
  it('snaps each km choice to the nearest LinkedIn step', () => {
    expect(linkedInDistanceMiles(10, 'Amsterdam')).toBe(5);
    expect(linkedInDistanceMiles(25, 'Amsterdam')).toBe(10);
    expect(linkedInDistanceMiles(50, 'Amsterdam')).toBe(25);
    expect(linkedInDistanceMiles(100, 'Amsterdam')).toBe(50);
  });
  it('is 0 without a radius', () => {
    expect(linkedInDistanceMiles(0, 'Amsterdam')).toBe(0);
  });
  it('is 0 without a city, even when a radius was sent', () => {
    expect(linkedInDistanceMiles(50, '')).toBe(0);
    expect(linkedInDistanceMiles(50, '   ')).toBe(0);
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
  it('separates different radii around the same city', () => {
    expect(locationCacheSuffix('Utrecht', 10)).not.toBe(locationCacheSuffix('Utrecht', 25));
    expect(locationCacheSuffix('Utrecht', 10)).not.toBe(locationCacheSuffix('Utrecht', 0));
  });
  it('ignores case and extra whitespace', () => {
    expect(locationCacheSuffix('  New   York ', 0)).toBe(locationCacheSuffix('new york', 0));
  });
});
