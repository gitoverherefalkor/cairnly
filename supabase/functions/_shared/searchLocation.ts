// Job-search location rules. Pure logic, no Deno imports, so vitest can cover
// every branch (see vite.config.ts `test.include`).
//
// Two jobs:
//  1. Turn the distance the user picked (km or miles, depending on their
//     country) into the value LinkedIn's `distance` URL parameter understands
//     (miles, fixed steps).
//  2. Build the part of the job_search_cache key that depends on WHERE the
//     search is. Before this existed, the cache key ignored the city entirely,
//     so an Amsterdam search and a Berlin search of the same career within 24h
//     shared one cached result.

export type DistanceUnit = 'km' | 'mi';

/** Distance choices offered in the UI. Same numbers in both units. 0 = none. */
export const DISTANCE_OPTIONS = [10, 25, 50, 100] as const;

// LinkedIn's `distance` parameter only accepts these mileage steps.
const LINKEDIN_MILE_STEPS = [5, 10, 25, 50, 100] as const;
const KM_PER_MILE = 1.609344;

/** Anything other than an explicit 'mi' is treated as km (the default). */
export function normalizeDistanceUnit(raw: unknown): DistanceUnit {
  return raw === 'mi' ? 'mi' : 'km';
}

/**
 * Validate the raw request value. Anything that isn't one of the UI's options
 * (typo, tampered request, older client) becomes 0 = "no distance".
 */
export function normalizeDistance(raw: unknown): number {
  const n = Number(raw);
  return (DISTANCE_OPTIONS as readonly number[]).includes(n) ? n : 0;
}

/**
 * The distance to send to LinkedIn, in miles. Returns 0 (= send nothing) when
 * no distance was chosen OR no city was given: a distance around a whole
 * country is meaningless, so it must not reach the URL or the cache key.
 *
 * Miles map straight through (all four options are valid LinkedIn steps).
 * Kilometres snap to the nearest step: 10 km -> 5 mi, 25 km -> 10 mi,
 * 50 km -> 25 mi, 100 km -> 50 mi.
 */
export function linkedInDistanceMiles(distance: number, unit: DistanceUnit, city: string): number {
  if (!distance || !city.trim()) return 0;
  const miles = unit === 'mi' ? distance : distance / KM_PER_MILE;
  return LINKEDIN_MILE_STEPS.reduce((best, step) =>
    Math.abs(step - miles) < Math.abs(best - miles) ? step : best,
  );
}

/**
 * Location part of the cache key. Empty string when the search has no city, so
 * those keys stay exactly as they were. City is lowercased and whitespace
 * collapsed so "Amsterdam" and " amsterdam " share a result. Keyed on the
 * LinkedIn miles value, so 50 km and 25 mi (both -> 25 mi) share a result.
 */
export function locationCacheSuffix(city: string, distanceMiles: number): string {
  const normalized = city.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
  if (!normalized) return '';
  return `:city=${normalized}` + (distanceMiles ? `:mi=${distanceMiles}` : '');
}
