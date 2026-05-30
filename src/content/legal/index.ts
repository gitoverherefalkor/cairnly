// Legal document content registry.
// Markdown source lives beside this file as <slug>.<lang>.md and is generated
// from the .docx originals in public/terms via scripts/docx-to-md.py.
// To update: replace the .docx, re-run the script, rebuild.
//
// Vite inlines these as raw strings at build time (?raw), so no runtime fetch.

import termsEn from './terms-of-service.en.md?raw';
import termsNl from './terms-of-service.nl.md?raw';
import privacyEn from './privacy-policy.en.md?raw';
import privacyNl from './privacy-policy.nl.md?raw';
import referralEn from './referral-terms.en.md?raw';
import referralNl from './referral-terms.nl.md?raw';

export type LegalSlug = 'terms-of-service' | 'privacy-policy' | 'referral-terms';

const DOCS: Record<LegalSlug, Record<string, string>> = {
  'terms-of-service': { en: termsEn, nl: termsNl },
  'privacy-policy': { en: privacyEn, nl: privacyNl },
  'referral-terms': { en: referralEn, nl: referralNl },
};

/** Return the markdown for a doc in the active language, falling back to English. */
export function getLegalDoc(slug: LegalSlug, lang: string): string {
  const byLang = DOCS[slug];
  return byLang[lang] ?? byLang.en;
}
