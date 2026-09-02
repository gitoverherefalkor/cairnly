// Dutch labels for the three report charts.
//
// The charts are shared with the dashboard, so they keep English as their
// default and take an optional `lang`. The printed report passes the DOCUMENT's
// language explicitly — the same pattern AIImpactPill and MovePill already use,
// and for the same reason: a PDF's language is decided by the language contract
// (all-or-nothing against content_i18n), not by whatever locale the browser
// happens to be in when the render runs.
//
// These are axis labels, not prose, so they are NOT part of the content
// contract and never go near content_i18n. They are UI chrome.

export type ChartLang = string | null | undefined;

export const isNl = (lang: ChartLang): boolean =>
  String(lang ?? 'en').slice(0, 2).toLowerCase() === 'nl';

/** Look a label up, falling back to the English original. */
const pick = (map: Record<string, string>, label: string, lang: ChartLang): string =>
  isNl(lang) ? (map[label] ?? label) : label;

// ── Compare radar: the working conditions ──────────────────────────────────
const COMPARE_NL: Record<string, string> = {
  Autonomy: 'Autonomie',
  Stability: 'Stabiliteit',
  Schedule: 'Werktijden',
  'Pace & pressure': 'Tempo & druk',
  'Social load': 'Sociale belasting',
};
export const compareAxisLabel = (label: string, lang: ChartLang) =>
  pick(COMPARE_NL, label, lang);

// ── Personality radar ──────────────────────────────────────────────────────
// Keyed on the English label; the \n in the "short" forms is preserved by
// splitting on it at the call site, so the Dutch strings carry their own
// line breaks where the term is long.
const PERSONALITY_NL: Record<string, string> = {
  'Strategic Depth': 'Strategische\ndiepgang',
  'Strategic\nDepth': 'Strategische\ndiepgang',
  Execution: 'Uitvoering',
  'People Intuition': 'Mensen-\nintuïtie',
  'People\nIntuition': 'Mensen-\nintuïtie',
  'Ambiguity Tolerance': 'Omgaan met\nonzekerheid',
  'Ambiguity\nTolerance': 'Omgaan met\nonzekerheid',
  'Recognition Pull': 'Behoefte aan\nerkenning',
  'Recognition\nPull': 'Behoefte aan\nerkenning',
};
export const personalityAxisLabel = (label: string, lang: ChartLang) =>
  pick(PERSONALITY_NL, label, lang);

// ── Career map: quadrant washes and axes ───────────────────────────────────
const MAP_NL: Record<string, string> = {
  'SWEET SPOT': 'SWEET SPOT', // brand term, kept English per the glossary habit
  'WALK AWAY': 'NIET DOEN',
  SAFE: 'VEILIG',
  AUGMENTED: 'ONDERSTEUND',
  'AT RISK': 'RISICO',
  STRONG: 'STERK',
  WEAKER: 'ZWAKKER',
  'AI exposure': 'AI-gevoeligheid',
  'match strength': 'matchsterkte',
};
export const mapLabel = (label: string, lang: ChartLang) => pick(MAP_NL, label, lang);

// The one full sentence the career-map legend carries (screen only — print
// lists every runner-up by name instead, so it never needs this).
export const runnerUpsLegend = (count: number, lang: ChartLang): string =>
  isNl(lang)
    ? `+${count} runner-up${count === 1 ? '' : 's'} (beweeg over de stippen voor namen)`
    : `+${count} runner-up${count === 1 ? '' : 's'} (hover the dots for names)`;
