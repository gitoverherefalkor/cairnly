// Country → salary "region band" mapping.
//
// The survey used to ask people to self-select one of 10 cost-of-living bands
// ("Northern and Western Europe", "United States (High-Cost Regions)", …),
// which early users found confusing. This lets them pick a familiar COUNTRY
// (US/UK split by area, since those span several bands) while the stored answer
// stays one of the exact band strings the n8n salary pipeline (WF2's
// AI_region1) already expects — so n8n is completely untouched. We only make
// the *picking* friendlier.

export const REGION = {
  nwEurope: 'Northern and Western Europe',
  seEurope: 'Southern and Eastern Europe',
  ukLondon: 'United Kingdom (London)',
  ukOther: 'United Kingdom (Other)',
  usHigh: 'United States (High-Cost Regions)',
  usAvg: 'United States (Average-Cost Regions)',
  usLow: 'United States (Lower-Cost Regions)',
  canada: 'Canada',
  ausNz: 'Australia and New Zealand',
  switzerland: 'Switzerland',
} as const;

export type RegionBand = (typeof REGION)[keyof typeof REGION];

export interface RegionOption {
  /** Stable, unique key — the <Select> value and the localStorage restore hint. */
  key: string;
  /** Friendly display label. */
  label: string;
  /** The band string stored as the answer + sent to n8n. */
  region: RegionBand;
}

// Rendered top-to-bottom. Ordered so it reads grouped (Europe, then UK, US,
// other) without needing <SelectGroup> chrome.
export const REGION_OPTIONS: RegionOption[] = [
  // Northern & Western Europe
  { key: 'NL', label: 'Netherlands', region: REGION.nwEurope },
  { key: 'DE', label: 'Germany', region: REGION.nwEurope },
  { key: 'FR', label: 'France', region: REGION.nwEurope },
  { key: 'BE', label: 'Belgium', region: REGION.nwEurope },
  { key: 'LU', label: 'Luxembourg', region: REGION.nwEurope },
  { key: 'AT', label: 'Austria', region: REGION.nwEurope },
  { key: 'IE', label: 'Ireland', region: REGION.nwEurope },
  { key: 'DK', label: 'Denmark', region: REGION.nwEurope },
  { key: 'SE', label: 'Sweden', region: REGION.nwEurope },
  { key: 'NO', label: 'Norway', region: REGION.nwEurope },
  { key: 'FI', label: 'Finland', region: REGION.nwEurope },
  { key: 'IS', label: 'Iceland', region: REGION.nwEurope },
  // Switzerland (its own band)
  { key: 'CH', label: 'Switzerland', region: REGION.switzerland },
  // Southern & Eastern Europe
  { key: 'ES', label: 'Spain', region: REGION.seEurope },
  { key: 'IT', label: 'Italy', region: REGION.seEurope },
  { key: 'PT', label: 'Portugal', region: REGION.seEurope },
  { key: 'GR', label: 'Greece', region: REGION.seEurope },
  { key: 'MT', label: 'Malta', region: REGION.seEurope },
  { key: 'CY', label: 'Cyprus', region: REGION.seEurope },
  { key: 'PL', label: 'Poland', region: REGION.seEurope },
  { key: 'CZ', label: 'Czechia', region: REGION.seEurope },
  { key: 'SK', label: 'Slovakia', region: REGION.seEurope },
  { key: 'HU', label: 'Hungary', region: REGION.seEurope },
  { key: 'RO', label: 'Romania', region: REGION.seEurope },
  { key: 'BG', label: 'Bulgaria', region: REGION.seEurope },
  { key: 'HR', label: 'Croatia', region: REGION.seEurope },
  { key: 'SI', label: 'Slovenia', region: REGION.seEurope },
  { key: 'EE', label: 'Estonia', region: REGION.seEurope },
  { key: 'LV', label: 'Latvia', region: REGION.seEurope },
  { key: 'LT', label: 'Lithuania', region: REGION.seEurope },
  // United Kingdom — split by area (spans two bands)
  { key: 'uk-london', label: 'United Kingdom — London & commuter belt', region: REGION.ukLondon },
  { key: 'uk-other', label: 'United Kingdom — rest of the UK', region: REGION.ukOther },
  // United States — split by area (spans three bands), anchored by example cities
  { key: 'us-high', label: 'United States — major metro (SF, NYC, Boston, Seattle, LA, DC)', region: REGION.usHigh },
  { key: 'us-avg', label: 'United States — mid-size city (Chicago, Austin, Denver, Atlanta, Dallas)', region: REGION.usAvg },
  { key: 'us-low', label: 'United States — smaller city / lower-cost area', region: REGION.usLow },
  // Other covered markets
  { key: 'CA', label: 'Canada', region: REGION.canada },
  { key: 'AU', label: 'Australia', region: REGION.ausNz },
  { key: 'NZ', label: 'New Zealand', region: REGION.ausNz },
  // Fallback for markets we can't price yet (defaults to EUR — see the picker's note)
  { key: 'elsewhere', label: 'Elsewhere / not listed', region: REGION.nwEurope },
];

export const KEY_TO_OPTION: Record<string, RegionOption> = Object.fromEntries(
  REGION_OPTIONS.map((o) => [o.key, o]),
);

// Checkout collects a country (see CheckoutForm's list) — use it to pre-fill.
// US/UK are intentionally omitted: they need an area choice, so we let the user
// pick the tier themselves rather than guessing.
const CHECKOUT_COUNTRY_TO_KEY: Record<string, string> = {
  Netherlands: 'NL', Germany: 'DE', France: 'FR', Belgium: 'BE', Luxembourg: 'LU',
  Austria: 'AT', Ireland: 'IE', Denmark: 'DK', Sweden: 'SE', Finland: 'FI',
  Spain: 'ES', Italy: 'IT', Portugal: 'PT', Greece: 'GR', Malta: 'MT', Cyprus: 'CY',
  Poland: 'PL', 'Czech Republic': 'CZ', Slovakia: 'SK', Hungary: 'HU', Romania: 'RO',
  Bulgaria: 'BG', Croatia: 'HR', Slovenia: 'SI', Estonia: 'EE', Latvia: 'LV', Lithuania: 'LT',
  Canada: 'CA', Australia: 'AU', 'New Zealand': 'NZ',
};

export function keyForCheckoutCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  return CHECKOUT_COUNTRY_TO_KEY[country.trim()] ?? null;
}

// Reverse a stored band back to a representative option key, for restoring the
// picker when we have no exact hint. US/UK/CH/CA are 1:1 and recover cleanly;
// the broad European bands and AUS/NZ can't recover the exact country, so we
// return null and the picker shows a "currently set to <band>" confirmation
// instead of showing a country the user didn't pick.
export function keyForRegion(region: string | null | undefined): string | null {
  switch (region) {
    case REGION.ukLondon: return 'uk-london';
    case REGION.ukOther: return 'uk-other';
    case REGION.usHigh: return 'us-high';
    case REGION.usAvg: return 'us-avg';
    case REGION.usLow: return 'us-low';
    case REGION.switzerland: return 'CH';
    case REGION.canada: return 'CA';
    default: return null;
  }
}
