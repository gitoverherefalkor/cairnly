// Job-search location rules. Pure logic, no Deno imports, so vitest can cover
// every branch (see vite.config.ts `test.include`).
//
// Two jobs:
//  1. Turn the radius the user picked (km, what the UI shows) into the value
//     LinkedIn's `distance` URL parameter understands (miles, fixed steps).
//  2. Build the part of the job_search_cache key that depends on WHERE the
//     search is. Before this existed, the cache key ignored the city entirely,
//     so an Amsterdam search and a Berlin search of the same career within 24h
//     shared one cached result.

/** Radius choices offered in the UI, in km. 0 = no radius (LinkedIn's default). */
export const DISTANCE_KM_OPTIONS = [10, 25, 50, 100] as const;

// LinkedIn's `distance` parameter only accepts these mileage steps.
const LINKEDIN_MILE_STEPS = [5, 10, 25, 50, 100] as const;
const KM_PER_MILE = 1.609344;

/**
 * Validate the raw request value. Anything that isn't one of the UI's options
 * (typo, tampered request, older client) becomes 0 = "no radius".
 */
export function normalizeDistanceKm(raw: unknown): number {
  const n = Number(raw);
  return (DISTANCE_KM_OPTIONS as readonly number[]).includes(n) ? n : 0;
}

/**
 * The radius to send to LinkedIn, in miles. Returns 0 (= send nothing) when no
 * radius was chosen OR no city was given: a radius around a whole country is
 * meaningless, so it must not reach the URL or the cache key.
 *
 * LinkedIn only offers 5/10/25/50/100 miles, so the km choice snaps to the
 * nearest step (10 km -> 5 mi, 25 km -> 10 mi, 50 km -> 25 mi, 100 km -> 50 mi).
 */
export function linkedInDistanceMiles(distanceKm: number, city: string): number {
  if (!distanceKm || !city.trim()) return 0;
  const miles = distanceKm / KM_PER_MILE;
  return LINKEDIN_MILE_STEPS.reduce((best, step) =>
    Math.abs(step - miles) < Math.abs(best - miles) ? step : best,
  );
}

/**
 * Location part of the cache key. Empty string when the search has no city, so
 * those keys stay exactly as they were. City is lowercased and whitespace
 * collapsed so "Amsterdam" and " amsterdam " share a result.
 */
export function locationCacheSuffix(city: string, distanceMiles: number): string {
  const normalized = city.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
  if (!normalized) return '';
  return `:city=${normalized}` + (distanceMiles ? `:mi=${distanceMiles}` : '');
}
