// Dutch rendering for `report_sections.company_size_type`.
//
// ⚠️ MIRROR of src/lib/companyContext.ts — edge functions can't import from
// src/, so the map lives twice. Keep the two files in sync when adding
// values or languages (same pattern as the price constants).
//
// This field is NOT an enum. It is free prose from WF4, and production holds 64
// distinct values across ~250 rows: mostly the tidy "Large (201-1000) /
// Corporate" shape, with a long tail of sentences like "Freelance / Own
// practice, serving municipalities and mid-size developers".
//
// So it is translated at the DISPLAY boundary, not in content_i18n. Two reasons:
// it is metadata rather than prose, and putting it through the translator would
// mean re-translating every existing report to fix a label. The trade-off is
// that this covers the structured majority and leaves the prose tail in English,
// which is the honest failure mode: an untranslated sentence still reads, a
// mangled one does not.
//
// The real fix is upstream — pin WF4's prompt to a fixed vocabulary so this
// becomes the enum it always should have been. Then this file collapses to a
// lookup and nothing has a tail. Until then, unknown input passes through
// unchanged.

/** Whole-string matches, which cover roughly three quarters of production. */
const EXACT_NL: Record<string, string> = {
  'Medium (51-200) / Scale-up': 'Middelgroot (51-200) / Scale-up',
  'Large (201-1000) / Corporate': 'Groot (201-1000) / Corporate',
  'Own Company / Boutique': 'Eigen bedrijf / Boutique',
  'Enterprise (1000+) / Corporate': 'Zeer groot (1000+) / Corporate',
  'Medium (51-200) / Nonprofit': 'Middelgroot (51-200) / Non-profit',
  'Large (201-1000) / Nonprofit': 'Groot (201-1000) / Non-profit',
  'Medium (51-200) / Agency / Consultancy': 'Middelgroot (51-200) / Bureau of consultancy',
  'Large (201-1000) / Public Sector / Gov': 'Groot (201-1000) / Publieke sector of overheid',
  'Medium (51-200) / Mid-Market': 'Middelgroot (51-200) / Middenmarkt',
  'Medium (51-200) / Corporate': 'Middelgroot (51-200) / Corporate',
  'Small (11-50) / Nonprofit': 'Klein (11-50) / Non-profit',
  'Large (201-1000) / Scale-up': 'Groot (201-1000) / Scale-up',
  'Medium (51-200) / Public Sector / Gov': 'Middelgroot (51-200) / Publieke sector of overheid',
  'Small (11-50) / Startup': 'Klein (11-50) / Startup',
  'Small (11-50) / Boutique': 'Klein (11-50) / Boutique',
  'Small (11-50) / Agency / Consultancy': 'Klein (11-50) / Bureau of consultancy',
  'Small (11-50) / Scale-up': 'Klein (11-50) / Scale-up',
  'Micro (1-10) / Boutique Consulting': 'Micro (1-10) / Boutique consultancy',
  'Own Company / Solo Practice': 'Eigen bedrijf / Eigen praktijk',
  // Emma's (demo) report, 2026-09-03: agency-shaped values WF4 also emits.
  'Large agency / consultancy (201-1000)': 'Groot bureau of consultancy (201-1000)',
  'Large (201-1000) / Agency / Consultancy': 'Groot (201-1000) / Bureau of consultancy',
  'Own company / boutique practice': 'Eigen bedrijf / Boutiquepraktijk',
};

/** Per-segment fallback for anything not matched whole. */
const SIZE_NL: Record<string, string> = {
  Micro: 'Micro',
  Small: 'Klein',
  Medium: 'Middelgroot',
  Large: 'Groot',
  Enterprise: 'Zeer groot',
  Startup: 'Startup',
  'Scale-up': 'Scale-up',
  Boutique: 'Boutique',
  Freelance: 'Freelance',
  'Own Company': 'Eigen bedrijf',
};

const TYPE_NL: Record<string, string> = {
  Corporate: 'Corporate',
  Nonprofit: 'Non-profit',
  'Non-profit': 'Non-profit',
  'Scale-up': 'Scale-up',
  Startup: 'Startup',
  Boutique: 'Boutique',
  'Mid-Market': 'Middenmarkt',
  Media: 'Media',
  Hospitality: 'Horeca',
  Education: 'Onderwijs',
  Manufacturing: 'Productie',
  Manufacturer: 'Producent',
  Entertainment: 'Entertainment',
  Creative: 'Creatief',
  'Production Company': 'Productiebedrijf',
  'Sports & Recreation': 'Sport & recreatie',
  'Sports Organization': 'Sportorganisatie',
  'Sports Academy': 'Sportacademie',
  Sports: 'Sport',
  'Franchise Group': 'Franchiseformule',
  Agribusiness: 'Agribusiness',
  Consumer: 'Consumenten',
  'Impact-Driven': 'Impactgedreven',
  Gaming: 'Gaming',
  Agency: 'Bureau',
  Consultancy: 'Consultancy',
  Gov: 'Overheid',
  'Public Sector': 'Publieke sector',
  'Solo Practice': 'Eigen praktijk',
};

const isNl = (lang: string | null | undefined) =>
  String(lang ?? 'en').slice(0, 2).toLowerCase() === 'nl';

/** Translate one " / "-separated segment, size words first then type words.
 *  A segment like "Large (201-1000)" keeps its parenthetical untouched. */
function segment(part: string): string {
  const trimmed = part.trim();
  const m = trimmed.match(/^([A-Za-z][A-Za-z-]*(?:\s[A-Za-z]+)?)(\s*\(.*\))?$/);
  if (m) {
    const word = m[1].trim();
    const paren = m[2] ?? '';
    const hit = SIZE_NL[word] ?? TYPE_NL[word];
    if (hit) return hit + paren;
  }
  return TYPE_NL[trimmed] ?? SIZE_NL[trimmed] ?? trimmed;
}

/** Company size / type in the document's language. Unknown input is returned
 *  unchanged rather than half-translated. */
export function companyContext(raw: string | null | undefined, lang: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value || !isNl(lang)) return value;
  const exact = EXACT_NL[value];
  if (exact) return exact;
  // Only attempt the segment pass on the structured shape. A sentence with a
  // comma in it is prose, and prose is left alone.
  if (value.includes(',') || value.split('/').length > 4) return value;
  return value.split('/').map(segment).join(' / ');
}
