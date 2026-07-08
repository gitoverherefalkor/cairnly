import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './i18n'
import App from './App.tsx'
import './index.css'
import { initSentry, Sentry } from './lib/sentry'
import { GlobalErrorFallback } from './components/GlobalErrorFallback'

initSentry();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={({ resetError }) => <GlobalErrorFallback resetError={resetError} />}
  >
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </Sentry.ErrorBoundary>
);
