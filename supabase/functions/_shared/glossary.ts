// Brand glossary + per-language voice rules for AI translation calls.
//
// ⚠ MIRROR of scripts/i18n-glossary.json — that file is the editable source of
// truth (it drives scripts/i18n-sync.ts for UI strings). Edge functions can't
// import files outside supabase/functions/, so the values are mirrored here.
// A vitest drift test (src/lib/translationGlossary.test.ts) fails the build
// the moment the two diverge, so edit BOTH files together.

export const DO_NOT_TRANSLATE: readonly string[] = [
  'Cairnly',
  'Atlas Assessments',
  'outside-the-box',
  'runner-up',
  'career card',
  'AI',
  'API',
  'WF1',
  'WF2',
  'WF3',
  'WF4',
  'WF5',
];

export const PREFERRED: Record<string, Record<string, string>> = {
  'en->nl': {
    career: 'loopbaan',
    personality: 'persoonlijkheid',
    assessment: 'assessment',
    report: 'rapport',
    skills: 'vaardigheden',
    achievements: 'prestaties',
    values: 'waarden',
    strengths: 'sterke punten',
    growth: 'groei',
    feedback: 'feedback',
    chat: 'chat',
    dashboard: 'dashboard',
    profile: 'profiel',
    'sign up': 'registreren',
    'sign in': 'inloggen',
    'log out': 'uitloggen',
    resume: 'cv',
    'cover letter': 'begeleidende brief',
  },
};

export const RULES: Record<string, readonly string[]> = {
  nl: [
    'Use je-form (informal Dutch), never u',
    "Tone: casual, modern, conversational — the way a friendly Dutch colleague actually talks, not a formal questionnaire. Avoid stiff, old-fashioned, or 'dusty' phrasing. Prefer everyday words over bookish ones.",
    "Concrete tone examples (apply the spirit, not just these literals): 'I thrive on interaction' -> 'Ik krijg er energie van' (not 'Ik fleur ervan op'); 'I enjoy it, but have a limit' -> 'Ik vind het leuk, maar tot op zekere hoogte' (not the stiff 'Ik vind het fijn'); 'enjoying daily tasks' -> 'plezier hebben in je dagelijkse werk' (not 'genieten van dagelijkse taken').",
    'Dutch number formatting: €59,00 not €59.00; €1.500 not €1,500',
    'Keep Markdown structure intact (headers, bullets, bold, links)',
    'Date format: dd-mm-yyyy',
    'No em-dashes (—) — use commas, periods, colons, parentheses, or sentence breaks instead',
    "Translate interjections/CTAs naturally (e.g. 'Let's go!' -> 'Aan de slag!'), not literally",
    'Preserve placeholders exactly: {{variable}}, {count}, %s, etc.',
    'When translating button labels or short UI strings, prefer the shorter Dutch equivalent (UI space matters)',
    'AI-impact rating labels translate to EXACTLY these fixed Dutch terms (they must match the UI badge labels): Minimal -> Minimaal, Moderate -> Gemiddeld, High -> Hoog, Severe -> Ernstig, Critical -> Kritiek. This applies wherever these words appear as the rating under an AI-impact heading.',
  ],
  de: [
    'Use Sie-form (formal German) for product copy; du-form only in marketing where appropriate',
    'German number formatting: €59,00 not €59.00',
    'Keep Markdown structure intact',
    'Date format: dd.mm.yyyy',
    "Compound nouns are fine — don't fear long words",
    'Preserve placeholders exactly',
  ],
};

/** Voice rules for Encore reports (older readers, formal Dutch "u"). Used
 *  by translate-section instead of RULES when the report is an Encore one. */
export const ENCORE_RULES: Record<string, readonly string[]> = {
  nl: [
    'Use the formal u-form throughout: u, uw, bent u, heeft u, kunt u. Never je, jij, jou or jouw, also not in headings or quotes of advice. Write "u" in lowercase inside a sentence.',
    'Tone: warm and plain, the way a respectful Dutch adviser talks to someone of 60 or 70. Not stiff or bureaucratic: short sentences, no officialese (middels, inzake, teneinde, dienen te).',
    'Never use age labels for the reader: no "senior", "oudere", "pensionado", "vitaal ouder worden".',
    'Dutch number formatting: €59,00 not €59.00; €1.500 not €1,500',
    'Keep Markdown structure intact (headers, bullets, bold, links)',
    'Date format: dd-mm-yyyy',
    'No em-dashes (—): use commas, periods, colons, parentheses, or sentence breaks instead',
    'Preserve placeholders exactly: {{variable}}, {count}, %s, etc.',
    'AI-impact rating labels translate to EXACTLY these fixed Dutch terms (they must match the UI badge labels): Minimal -> Minimaal, Moderate -> Gemiddeld, High -> Hoog, Severe -> Ernstig, Critical -> Kritiek. This applies wherever these words appear as the rating under an AI-impact heading.',
  ],
};

/** Human-readable language names for prompt text. */
export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  nl: 'Dutch',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
};
