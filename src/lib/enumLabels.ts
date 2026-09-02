// Localized display labels for the enum values the pipeline stores in
// English (language contract: machine tokens stay English in the DB —
// metadata.move, AI-impact levels, feasibility levels — and the DISPLAY
// layer maps them to the viewer's language here).
//
// Deliberately a code-level map rather than i18next JSON: the print/PDF
// components render outside the i18next provider and resolve language by
// prop, so one lang-keyed map serves chat, dashboard and print identically.
// Adding a language: add its block to each map; anything missing falls back
// to English automatically.

type LabelMap = Record<string, Record<string, string>>;

const AI_IMPACT_LABEL: LabelMap = {
  nl: {
    Minimal: 'Minimaal',
    Moderate: 'Gemiddeld',
    High: 'Hoog',
    Severe: 'Ernstig',
    Critical: 'Kritiek',
  },
};

const AI_IMPACT_MEANING_I18N: LabelMap = {
  nl: {
    Minimal: 'De zeldzame uitzondering. Hands-on werk of werk met menselijke aanwezigheid dat AI niet kan overnemen.',
    Moderate: 'Gezonde versterking. AI doet het routinewerk; jouw oordeel blijft essentieel.',
    High: 'De rol verandert van vorm. Veel dagelijks werk verschuift naar het aansturen en controleren van AI.',
    Severe: 'Teams krimpen. Het grootste deel van de rol automatiseert naar minder mensen die AI inzetten.',
    Critical: 'Koerswijziging nodig. De kern van het werk is vandaag al grotendeels te automatiseren.',
  },
};

const MOVE_LABEL: LabelMap = {
  nl: {
    'Ready now': 'Direct inzetbaar',
    Reframe: 'Herpositioneren',
    Upskill: 'Bijscholen',
    Retrain: 'Omscholen',
  },
};

const MOVE_BLURB_I18N: LabelMap = {
  nl: {
    'Ready now': 'je vaardigheden passen al',
    Reframe: 'je ervaring herpositioneren, geen nieuwe vaardigheden',
    Upskill: 'een echte maar overbrugbare leercurve',
    Retrain: 'een grote stap of een nieuw vakgebied',
  },
};

const FEASIBILITY_LABEL: LabelMap = {
  nl: {
    Low: 'Laag',
    'Low - Moderate': 'Laag - Gemiddeld',
    Moderate: 'Gemiddeld',
    'Moderate - High': 'Gemiddeld - Hoog',
    High: 'Hoog',
  },
};

// The small uppercase tag on each pill ("AI IMPACT", "MOVE", …).
const PILL_TAG: LabelMap = {
  nl: {
    'AI Impact': 'AI-impact',
    Move: 'Stap',
    Feasibility: 'Haalbaarheid',
    Match: 'Match',
  },
};

const norm = (lang: string | undefined | null) => String(lang ?? 'en').slice(0, 2).toLowerCase();

const pick = (map: LabelMap, value: string, lang: string | undefined | null): string =>
  map[norm(lang)]?.[value] ?? value;

export const aiImpactLabel = (level: string, lang?: string | null) =>
  pick(AI_IMPACT_LABEL, level, lang);
export const aiImpactMeaning = (level: string, meaningEn: string, lang?: string | null) =>
  AI_IMPACT_MEANING_I18N[norm(lang)]?.[level] ?? meaningEn;
export const moveLabel = (level: string, lang?: string | null) => pick(MOVE_LABEL, level, lang);
export const moveBlurb = (level: string, blurbEn: string, lang?: string | null) =>
  MOVE_BLURB_I18N[norm(lang)]?.[level] ?? blurbEn;
export const feasibilityLabel = (level: string, lang?: string | null) =>
  pick(FEASIBILITY_LABEL, level, lang);
export const pillTag = (tag: string, lang?: string | null) => pick(PILL_TAG, tag, lang);

// ── Pill chrome that is a phrase rather than an enum value ────────────────
// Same contract as the maps above: keyed by language, English is the fallback,
// and adding a language means adding its line here. These render on the
// dashboard, the printed report AND the landing page, so they cannot come
// from a react-i18next hook alone.
const NL = (lang?: string | null) => norm(lang) === 'nl';

/** Match pill body, e.g. "Match · 87%". */
export const matchPillLabel = (pct: number, lang?: string | null) =>
  `${pillTag('Match', lang)} · ${pct}%`;

/** Match pill hover tooltip. */
export const matchPillTitle = (pct: number, lang?: string | null) =>
  NL(lang) ? `${pct}% match met jouw profiel` : `${pct}% fit against your profile`;

/** Salary pill prefix — it is an estimate, never a sourced figure. */
export const salaryPillPrefix = (lang?: string | null) => (NL(lang) ? 'ca.' : 'est.');

/** Salary pill hover tooltip. */
export const salaryPillTitle = (lang?: string | null) =>
  NL(lang)
    ? 'Door AI geschatte range voor jouw regio. Echte gepubliceerde ranges vind je bij Zoek open rollen.'
    : 'AI-estimated range for your region. See real posted ranges in Find Open Roles.';
