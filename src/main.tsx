import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './i18n'
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

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={({ resetError }) => <GlobalErrorFallback resetError={resetError} />}
  >
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </Sentry.ErrorBoundary>
);
