// Default country for the Jobs search form.
//
// It used to read only `profiles.country`, which is filled at Stripe checkout.
// Users who sign up with a free/access code never pass checkout, so the field
// is null and the form fell back to "United States" even when the survey said
// Netherlands (live test 2026-11-07). The survey's location question stores a
// salary region band, not a country, so we combine every signal we have,
// most specific first.

import { KEY_TO_OPTION, REGION } from '@/lib/countryToRegion';

/** Survey question "where are you based" (region-band answer). */
export const REGION_QUESTION_ID = '11111111-1111-1111-1111-111111111114';

interface Inputs {
  /** Country codes the Jobs form supports (lowercase ISO, e.g. 'nl'). */
  supported: string[];
  /** profiles.country, a display name or code from checkout. */
  profileCountry?: string | null;
  /** The exact picker key remembered by the survey on this device ('NL', 'uk-london'). */
  surveyPickKey?: string | null;
  /** The stored survey answer (a REGION band string). */
  regionBand?: string | null;
  /** navigator.languages, e.g. ['nl-NL', 'en']. */
  browserLocales?: readonly string[];
  /** Current UI language ('en' | 'nl'). */
  uiLanguage?: string | null;
}

function pickKeyToCode(key: string): string | null {
  if (key.startsWith('uk-')) return 'gb';
  if (key.startsWith('us-')) return 'us';
  if (/^[A-Z]{2}$/.test(key)) return key.toLowerCase();
  return null;
}

function bandOfCode(code: string): string | null {
  return KEY_TO_OPTION[code.toUpperCase()]?.region ?? null;
}

export function defaultJobsCountry(i: Inputs): string {
  const ok = (c: string | null | undefined): boolean => !!c && i.supported.includes(c);

  // 1. Checkout country (explicit, but only when we recognise it).
  const pc = (i.profileCountry ?? '').trim().toLowerCase();
  if (pc) {
    if (ok(pc)) return pc;
    if (pc.includes('netherlands') || pc.includes('holland')) return 'nl';
    if (pc.includes('united kingdom') || pc === 'uk' || pc.includes('britain')) return 'gb';
    if (pc.includes('united states') || pc === 'usa') return 'us';
  }

  // 2. The exact country they picked in the survey (same device only).
  const fromPick = i.surveyPickKey ? pickKeyToCode(i.surveyPickKey) : null;
  if (fromPick && ok(fromPick)) return fromPick;

  // 3. Bands that name a single country.
  switch (i.regionBand) {
    case REGION.ukLondon:
    case REGION.ukOther: return 'gb';
    case REGION.usHigh:
    case REGION.usAvg:
    case REGION.usLow: return 'us';
    case REGION.canada: return 'ca';
    case REGION.switzerland: return 'ch';
  }

  // 4. Browser locale country, if it fits the band (or there is no band).
  for (const loc of i.browserLocales ?? []) {
    const region = loc.split('-')[1]?.toLowerCase();
    if (!region || !ok(region)) continue;
    if (!i.regionBand || bandOfCode(region) === i.regionBand) return region;
  }

  // 5. Broad bands: fall back to the most common country for that band.
  if (i.regionBand === REGION.nwEurope) return 'nl';
  if (i.regionBand === REGION.seEurope) return 'es';
  if (i.regionBand === REGION.ausNz) return 'au';

  // 6. Dutch UI → Netherlands; otherwise the old default.
  if ((i.uiLanguage ?? '').startsWith('nl')) return 'nl';
  return 'us';
}
