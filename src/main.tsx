import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { i18nReady } from './i18n'
import { waitForTranslations } from './lib/waitForTranslations'
import App from './App.tsx'
import './index.css'
import { initSentry, Sentry } from './lib/sentry'
import { GlobalErrorFallback } from './components/GlobalErrorFallback'

initSentry();

// Remove the crawler-facing static SEO tags injected at build time by
// scripts/inject-meta.mjs. They exist so non-JS scrapers (LinkedIn, Slack,
// WhatsApp) see correct per-route meta; once React mounts, react-helmet-async
// owns the head, and leaving the static copies in place would create
// duplicate, potentially conflicting tags.
document.querySelectorAll('[data-static-seo]').forEach((el) => el.remove());

// Hold the first render until the translations have loaded (react-i18next runs
// with useSuspense: false, so rendering earlier shows raw translation keys).
// Capped so a slow or failed locale fetch can never leave the page blank: after
// the cap we render anyway, and react-i18next re-renders when the JSON lands.
const I18N_WAIT_CAP_MS = 4000;
waitForTranslations(i18nReady, I18N_WAIT_CAP_MS).then(() => createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={({ resetError }) => <GlobalErrorFallback resetError={resetError} />}
  >
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </Sentry.ErrorBoundary>
));
