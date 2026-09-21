import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSessionId, getCountry, isTrackingSuppressed } from '@/lib/analytics';

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
    // Dev servers, preview deploys, headless browsers and our own opted-out
    // browsers write nothing at all — not the view, not the engage ping.
    if (isTrackingSuppressed()) return;

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

    // Engaged-view signal: if the visitor is still on this page after 10s, mark
    // it engaged so the session no longer counts as a bounce. The cleanup clears
    // the timer on navigation/unmount, so a quick exit stays a bounce, and the
    // effect is keyed on pathname so each route gets its own 10s window.
    //
    // `path` scopes the update server-side to the view that earned it. Without
    // it, track-view falls back to marking every row in the session.
    const engageTimer = setTimeout(() => {
      supabase.functions
        .invoke('track-view', {
          body: { session_id: sessionId, engaged: true, path: location.pathname },
        })
        .catch(() => {
          /* ignore */
        });
    }, 10_000);

    return () => clearTimeout(engageTimer);
  }, [location.pathname]);
}
