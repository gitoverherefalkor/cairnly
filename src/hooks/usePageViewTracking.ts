import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// First-party page-view tracking. Fires a fire-and-forget beacon to the
// track-view edge function on every route change. Privacy-light: a random
// per-tab session id (sessionStorage, cleared when the tab closes), no cookies,
// no PII. Analytics must NEVER break the app, so every failure is swallowed.

const SESSION_KEY = 'cairnly_analytics_session';
const FIRST_KEY = 'cairnly_analytics_first_done';

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

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

    supabase.functions
      .invoke('track-view', {
        body: { path: location.pathname, session_id: sessionId, referrer },
      })
      .catch(() => {
        /* analytics must never surface an error to the visitor */
      });
  }, [location.pathname]);
}
