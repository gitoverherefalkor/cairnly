import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// Custom detector: check if we're on a .nl domain → force Dutch
const domainDetector = {
  name: 'domainDetector',
  lookup(): string | undefined {
    const hostname = window.location.hostname;
    if (hostname.endsWith('.nl')) return 'nl';
    if (hostname.endsWith('.de')) return 'de'; // future-proofing
    return undefined;
  },
};

const languageDetector = new LanguageDetector();
languageDetector.addDetector(domainDetector);

i18n
  .use(HttpBackend)
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    // Dutch (nl) is live as of the Phase 1.5 launch (2026-05-28).
    // See LOCALIZATION_PLAN.md for the rollout history.
    supportedLngs: ['en', 'nl'],
    ns: ['common', 'auth', 'landing', 'survey', 'chat', 'report', 'dashboard', 'payment', 'support'],
    defaultNS: 'common',

    detection: {
      // Language authority: an explicit choice only. We deliberately do NOT
      // fall back to the browser's language ('navigator') — a Dutch-locale
      // browser was silently forcing the whole UI into Dutch even for users
      // (e.g. expats in NL) who want English. Now the language comes only from:
      //   1. domainDetector — a real .nl/.de site forces that language
      //      (currently a no-op; we're on cairnly.io, no such domain exists yet)
      //   2. localStorage — the user's saved flag choice
      // If neither is set, we fall through to fallbackLng ('en'). So the app is
      // English by default and Dutch ONLY when someone actively picks the flag.
      order: ['domainDetector', 'localStorage'],
      lookupLocalStorage: 'cairnly_language',
      caches: ['localStorage'],
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
