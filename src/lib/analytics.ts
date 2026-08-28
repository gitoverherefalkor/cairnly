import { supabase } from '@/integrations/supabase/client';

// Shared first-party analytics primitives. Cookieless, no PII: a random
// per-tab sessionStorage id + a country code derived server-side from
// Vercel's geo header. Every caller (page views, scroll depth, CTA clicks)
// goes through the same session id so page_views and analytics_events join
// cleanly on session_id.

const SESSION_KEY = 'cairnly_analytics_session';
const COUNTRY_KEY = 'cairnly_analytics_country';

export function getSessionId(): string {
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

let countryPromise: Promise<string | null> | null = null;

// Country is only available via Vercel's x-vercel-ip-country header, which
// never reaches track-view directly (that call goes browser → Supabase,
// bypassing Vercel entirely). /api/geo is a same-origin hop through Vercel's
// edge that hands it back. Fetched once per tab session and cached — every
// event after the first reuses the cached value instead of re-fetching.
export function getCountry(): Promise<string | null> {
  if (countryPromise) return countryPromise;

  try {
    const cached = sessionStorage.getItem(COUNTRY_KEY);
    if (cached !== null) {
      countryPromise = Promise.resolve(cached === '' ? null : cached);
      return countryPromise;
    }
  } catch {
    /* fall through to fetch */
  }

  countryPromise = fetch('/api/geo')
    .then((res) => (res.ok ? res.json() : { country: null }))
    .then((data: { country?: string | null }) => {
      const country = data.country ?? null;
      try {
        sessionStorage.setItem(COUNTRY_KEY, country ?? '');
      } catch {
        /* ignore */
      }
      return country;
    })
    .catch(() => null);

  return countryPromise;
}

// Fire-and-forget beacon to the track-view edge function. Analytics must
// never break the app or surface an error to the visitor.
function sendBeacon(body: Record<string, unknown>): void {
  supabase.functions.invoke('track-view', { body }).catch(() => {
    /* swallow — analytics failures are invisible to the visitor */
  });
}

// Scroll-depth milestone (25/50/75/100). Callers are responsible for firing
// each milestone at most once per session — see useScrollDepthTracking,
// which tracks that in sessionStorage; the DB also de-dupes on
// (session_id, milestone) as a backstop.
export async function trackScrollDepth(path: string, milestone: 25 | 50 | 75 | 100): Promise<void> {
  const country = await getCountry();
  sendBeacon({
    session_id: getSessionId(),
    event_type: 'scroll_depth',
    path,
    milestone,
    country,
  });
}

// CTA click. `id` is a short stable identifier for the button (e.g. 'hero',
// 'pricing', 'footer') — pair it with `path` (defaults to the current route)
// to tell flavors apart (e.g. hero on '/' vs hero on '/starter') without
// needing flavor-prefixed ids. Every click is recorded, not deduped —
// repeat clicks on the same button are a real signal (hesitation/friction).
export async function trackCtaClick(id: string, path: string = window.location.pathname): Promise<void> {
  const country = await getCountry();
  sendBeacon({
    session_id: getSessionId(),
    event_type: 'cta_click',
    path,
    cta_id: id,
    country,
  });
}
