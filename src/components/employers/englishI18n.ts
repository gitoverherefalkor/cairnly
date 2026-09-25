import i18next from 'i18next';
import HttpBackend from 'i18next-http-backend';

/**
 * A separate, English-only i18next instance for /employers.
 *
 * The page copy only exists in English, but the nav, trust bar and footer
 * follow the site language, so a visitor with Dutch saved got a Dutch chrome
 * around English copy. Wrapping the page in its own instance renders all of
 * it in English.
 *
 * A separate instance rather than i18n.cloneInstance({ lng: 'en' }): a clone
 * shares the language detector, and changeLanguage() caches the language to
 * localStorage, which would silently overwrite a Dutch visitor's saved
 * choice for the rest of the site. This instance has no detector at all.
 *
 * Delete this (and the provider in EmployersIndex) once nl/employers.json
 * exists.
 */
const englishI18n = i18next.createInstance();

englishI18n.use(HttpBackend).init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'nl'],
  ns: ['common', 'landing', 'employers', 'partners', 'dashboard'],
  defaultNS: 'common',
  backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default englishI18n;
