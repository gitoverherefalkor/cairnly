// One implementation of language-code normalisation for every edge function.
// Lifted from verify-access-code's pickLang so there is a single source of
// truth (verify-access-code now imports from here).
//
// Adding a language to the platform:
//   1. add its code to SUPPORTED below
//   2. add a voice block + stopwords in _shared/glossary.ts / translationGate.ts
//   3. add UI locale files under public/locales/<code>/
// Report content needs NO per-language work: generation is always English and
// translate-section handles the rest (docs/LANGUAGE_CONTRACT_PLAN.md).

export type Lang = 'en' | 'nl' | 'de' | 'fr' | 'es';

// Languages the product actually serves today.
export const SUPPORTED: readonly Lang[] = ['en', 'nl'] as const;

/** Normalise any user/profile/browser value to a supported language code. */
export const resolveLang = (v: unknown): Lang => {
  const c = String(v ?? '')
    .trim()
    .slice(0, 2)
    .toLowerCase();
  return (SUPPORTED as readonly string[]).includes(c) ? (c as Lang) : 'en';
};
