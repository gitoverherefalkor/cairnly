import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const COOKIE_CONSENT_KEY = 'cairnly-cookie-consent';

const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner if user hasn't made a choice yet
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = (choice: 'all' | 'essential') => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      choice,
      timestamp: new Date().toISOString(),
    }));

    // Consent Mode v2: gtag-init.js sets these to "denied" by default on every
    // load. Accepting here updates them for the rest of this session; the
    // "denied" default already covers "Essential Only" so no call is needed
    // for that branch, but we send it explicitly so a changed mind mid-session
    // (via the Cookie Policy page, once that control exists) has something to
    // revert to.
    try {
      if (typeof window.gtag === 'function') {
        const state = choice === 'all' ? 'granted' : 'denied';
        window.gtag('consent', 'update', {
          ad_storage: state,
          ad_user_data: state,
          ad_personalization: state,
          analytics_storage: state,
        });
      }
    } catch (err) {
      console.error('Google Ads consent update failed:', err);
    }

    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 text-sm text-gray-700">
          <p>
            We use essential cookies to keep you logged in and make the platform work.
            With your consent, we also use Google Ads cookies to measure whether our
            advertising leads to purchases.{' '}
            <Link to="/cookie-policy" className="text-atlas-blue underline hover:text-atlas-navy">
              Learn more
            </Link>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAccept('essential')}
          >
            Essential Only
          </Button>
          <Button
            size="sm"
            className="bg-atlas-teal hover:bg-atlas-teal/90 text-white"
            onClick={() => handleAccept('all')}
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
