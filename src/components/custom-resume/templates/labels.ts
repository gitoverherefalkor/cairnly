/**
 * Section headings and skill-group labels for the generated résumé.
 *
 * These are NOT app chrome, so they deliberately do not go through i18next:
 * they are baked into a PDF/DOCX the user sends to an employer, and the
 * react-pdf renderer and the docx builder both run outside the React tree that
 * i18next provides. A plain map keyed by language keeps both paths on one
 * source of truth.
 *
 * WF9 writes the résumé BODY in the candidate's `preferred_language` (its
 * "single language, never mix" lock), so leaving these headings hard-coded in
 * English produced Dutch bullets under "Professional Summary". Callers pass the
 * same language WF9 used.
 *
 * Any language not listed here falls back to English, which is exactly the
 * behaviour every caller had before this file existed.
 */
// Templates deliberately do not share one wording: the ATS-classic and
// executive layouts say "Professional Summary", the compact ones say
// "Summary", and BoldResume calls its certifications block "Recognition". Each
// keeps its own key so the English output of every template is unchanged.
export interface ResumeLabels {
  summary: string;
  summaryShort: string;
  experience: string;
  experienceContinued: string;
  skills: string;
  education: string;
  certifications: string;
  recognition: string;
  areasOfPractice: string;
  highlights: string;
  technical: string;
  tools: string;
  strengths: string;
  languages: string;
}

const EN: ResumeLabels = {
  summary: 'Professional Summary',
  summaryShort: 'Summary',
  experience: 'Experience',
  experienceContinued: 'Experience, continued',
  skills: 'Skills',
  education: 'Education',
  certifications: 'Certifications',
  recognition: 'Recognition',
  areasOfPractice: 'Areas of Practice',
  highlights: 'Highlights',
  technical: 'Technical',
  tools: 'Tools',
  strengths: 'Strengths',
  languages: 'Languages',
};

// Conventional Dutch CV section names. "Werkervaring" and "Opleiding" are the
// standard headings on a Dutch CV; "Profiel" is the usual label for the
// summary paragraph at the top.
const NL: ResumeLabels = {
  summary: 'Profiel',
  summaryShort: 'Profiel',
  experience: 'Werkervaring',
  experienceContinued: 'Werkervaring, vervolg',
  skills: 'Vaardigheden',
  education: 'Opleiding',
  certifications: 'Certificeringen',
  recognition: 'Erkenning',
  areasOfPractice: 'Expertisegebieden',
  highlights: 'Hoogtepunten',
  technical: 'Technisch',
  tools: 'Tools',
  strengths: 'Sterke punten',
  languages: 'Talen',
};

const BY_LANG: Record<string, ResumeLabels> = { en: EN, nl: NL };

/** Résumé labels for a language code ('nl', 'nl-NL', …). Falls back to English. */
export function resumeLabels(lang?: string | null): ResumeLabels {
  if (!lang) return EN;
  return BY_LANG[lang.split('-')[0].toLowerCase()] ?? EN;
}
