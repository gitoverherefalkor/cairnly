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
      // Priority: .nl domain → localStorage → browser language
      order: ['domainDetector', 'localStorage', 'navigator'],
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
