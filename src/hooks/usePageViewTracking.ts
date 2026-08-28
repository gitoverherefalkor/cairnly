import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSessionId, getCountry } from '@/lib/analytics';

// First-party page-view tracking. Fires a fire-and-forget beacon to the
// track-view edge function on every route change. Privacy-light: a random
// per-tab session id (sessionStorage, cleared when the tab closes), no cookies,
// no PII. Analytics must NEVER break the app, so every failure is swallowed.

const FIRST_KEY = 'cairnly_analytics_first_done';

export function usePageViewTracking() {
  const location = useLocation();

  useEffect(() => {
    // Never track the internal ops dashboard — it's not real traffic.
    if (location.pathname.startsWith('/ops')) return;

    const sessionId = getSessionId();

    // Only attach the referrer on the first view of the session.
    let referrer: string | null = null;
    try {
      if (!sessionStorage.getItem(FIRST_KEY)) {
        referrer = document.referrer || null;
        sessionStorage.setItem(FIRST_KEY, '1');
      }
    } catch {
      /* ignore */
    }

    getCountry().then((country) => {
      supabase.functions
        .invoke('track-view', {
          body: { path: location.pathname, session_id: sessionId, referrer, country },
        })
        .catch(() => {
          /* analytics must never surface an error to the visitor */
        });
    });

    // Engaged-session signal: if the visitor is still on this page after 10s,
    // mark the session engaged so it no longer counts as a bounce. The cleanup
    // clears the timer on navigation/unmount, so a quick exit stays a bounce.
    const engageTimer = setTimeout(() => {
      supabase.functions
        .invoke('track-view', { body: { session_id: sessionId, engaged: true } })
        .catch(() => {
          /* ignore */
        });
    }, 10_000);

    return () => clearTimeout(engageTimer);
  }, [location.pathname]);
}
