import { supabase } from '@/integrations/supabase/client';

// Shared first-party analytics primitives. Cookieless, no PII: a random
// per-tab sessionStorage id + a country code derived server-side from
// Vercel's geo header. Every caller (page views, scroll depth, CTA clicks)
// goes through the same session id so page_views and analytics_events join
// cleanly on session_id.

const SESSION_KEY = 'cairnly_analytics_session';
const COUNTRY_KEY = 'cairnly_analytics_country';
// Survives tab closes on purpose: an opt-out that only lasted one tab would
// be useless for the person it exists for.
const OPTOUT_KEY = 'cairnly_analytics_optout';

// The only host whose traffic is real. Everything else that can run this
// bundle writes into the same production tables and pollutes every number:
//   localhost / 127.0.0.1   `npm run dev` points at the production Supabase
//   *.vercel.app            preview deploys of every branch
const PRODUCTION_HOST = 'cairnly.io';

/**
 * `?internal=1` marks this browser as ours and stops every beacon until
 * `?internal=0` clears it. Read on each call rather than once at boot, so it
 * takes effect on the view that carries the parameter.
 */
function readInternalFlag(): void {
  try {
    const value = new URLSearchParams(window.location.search).get('internal');
    if (value === null) return;
    if (value === '0' || value === 'false') {
      localStorage.removeItem(OPTOUT_KEY);
      console.info('[analytics] internal flag cleared — this browser is counted again');
    } else {
      localStorage.setItem(OPTOUT_KEY, new Date().toISOString());
      console.info('[analytics] internal flag set — nothing from this browser is tracked');
    }
  } catch {
    /* private mode / storage disabled: nothing to remember */
  }
}

/**
 * True when this visit must not be recorded at all. Three reasons, in order
 * of how much junk each one keeps out:
 *   1. not the production host (dev servers and preview deploys)
 *   2. automation — headless Chrome runs JavaScript, so puppeteer checks
 *      DID write real rows; `navigator.webdriver` is the flag that catches
 *      them. Real crawlers never execute this code at all, which is why
 *      user-agent filtering is not worth it.
 *   3. the internal opt-out flag above
 */
export function shouldSuppressTracking(input: {
  hostname: string;
  webdriver: boolean;
  optedOut: boolean;
}): boolean {
  if (!input.hostname.endsWith(PRODUCTION_HOST)) return true;
  if (input.webdriver) return true;
  return input.optedOut;
}

export function isTrackingSuppressed(): boolean {
  try {
    readInternalFlag();
    return shouldSuppressTracking({
      hostname: window.location.hostname,
      webdriver: navigator.webdriver === true,
      optedOut: localStorage.getItem(OPTOUT_KEY) !== null,
    });
  } catch {
    // Storage blocked or no window: record rather than silently lose a real
    // visitor. The three reasons above are all "we know this is not one".
    return false;
  }
}

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
  if (isTrackingSuppressed()) return;
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

// Sample-report view. Fired once on mount by /partners/sample-report so we
// can tell which prospect opened the specimen: `?p=<slug>` is the per-prospect
// tag baked into the link we send, and any utm_* params riding along are kept
// so an outreach campaign can be told apart from a direct share.
//
// Values come straight off the URL, so they're visitor-controlled. They get
// squeezed to a conservative slug charset here and sliced again server-side.
const TAG_MAX = 64;

function sanitizeTag(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, TAG_MAX);
  return cleaned || null;
}

export async function trackSampleView(
  path: string,
  search: string,
  persona?: string | null,
): Promise<void> {
  const params = new URLSearchParams(search);
  const country = await getCountry();
  sendBeacon({
    session_id: getSessionId(),
    event_type: 'sample_view',
    path,
    // The persona the page actually resolved to. page_views keeps pathname
    // only, so without this /demo reads the same for Marcel and Emma. Passed
    // in by the page (language + ?persona= already applied) rather than read
    // off the URL, which is blank on a language-based pick.
    persona: sanitizeTag(persona ?? params.get('persona')),
    prospect: sanitizeTag(params.get('p')),
    utm_source: sanitizeTag(params.get('utm_source')),
    utm_medium: sanitizeTag(params.get('utm_medium')),
    utm_campaign: sanitizeTag(params.get('utm_campaign')),
    country,
  });
}


// ─── Keyed events: fired at most once per session ────────────────────────────
//
// Depth inside the demo and the two conversion steps are "did this happen in
// this session" flags, not counts, so a repeated scroll past the same moment
// or a reloaded success page must not inflate them. Guarded here in
// sessionStorage; the DB has a matching unique index as the backstop.

const FIRED_KEY = 'cairnly_analytics_fired';

function firedAlready(key: string): boolean {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    const fired: string[] = raw ? JSON.parse(raw) : [];
    if (fired.includes(key)) return true;
    fired.push(key);
    sessionStorage.setItem(FIRED_KEY, JSON.stringify(fired));
    return false;
  } catch {
    // No storage: fire anyway. The unique index still de-dupes server-side.
    return false;
  }
}

/**
 * One of the seven annotated moments in the chat replay was scrolled past.
 * `moment` is the curation key (pushback, kept, pillTag, movePill, radar,
 * askRole, dictated) — how far into the conversation people actually get.
 */
export async function trackDemoMoment(moment: string, persona: string, path: string): Promise<void> {
  const key = `demo_moment:${moment}`;
  if (firedAlready(key)) return;
  const country = await getCountry();
  sendBeacon({
    session_id: getSessionId(),
    event_type: 'demo_moment',
    path,
    event_key: moment,
    persona: sanitizeTag(persona),
    country,
  });
}

/**
 * A funnel step completed: the intake chat was started, or a purchase went
 * through. Deliberately carries the session id and nothing else — the row
 * that identifies the person lives in `intake_sessions` / `purchases` and
 * stays unlinked, so the pageview history remains non-identifiable.
 */
export async function trackConversion(step: 'intake_started' | 'purchase'): Promise<void> {
  const key = `conversion:${step}`;
  if (firedAlready(key)) return;
  const country = await getCountry();
  sendBeacon({
    session_id: getSessionId(),
    event_type: 'conversion',
    path: window.location.pathname,
    event_key: step,
    country,
  });
}
