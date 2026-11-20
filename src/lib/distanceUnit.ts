// Which unit the job-search distance dropdown speaks, by country.
// US and UK people think in miles; everyone else in km.
// The edge function (supabase/functions/_shared/searchLocation.ts) converts
// either one to what LinkedIn wants.

export type DistanceUnit = 'km' | 'mi';

/** Distance choices shown in the dropdown. Same numbers in both units. */
export const DISTANCE_CHOICES = [10, 25, 50, 100];

const MILE_COUNTRIES = new Set(['us', 'gb']);

export function distanceUnitForCountry(countryCode: string): DistanceUnit {
  return MILE_COUNTRIES.has(countryCode.toLowerCase()) ? 'mi' : 'km';
}
