// Vercel Edge Middleware: server-side outreach click logging for /demo.
//
// Outreach emails to bureaus link to
//   /demo?p=partners&persona=marcel&utm_source=outreach&utm_medium=email
//        &utm_campaign=bureaus-sep26&utm_content=<slug>
// and utm_content is the per-bureau key. The site is a Vite SPA, so nothing
// of ours runs on the server when that URL is opened. This middleware is the
// one hook Vercel gives a static SPA that sees the GET with its query string
// BEFORE the HTML is served, which buys two things the browser beacon in
// src/lib/analytics.ts cannot:
//
//   1. It logs even when the visitor blocks JavaScript.
//   2. It logs the email link scanners (Outlook SafeLinks, Google proxies)
//      that fetch the URL without ever running JS. Those are exactly the
//      hits the is_bot flag exists to separate from real opens, and they
//      have to be recorded to be recognised.
//
// It never slows the page: the POST to the outreach-click function is
// handed to waitUntil() and not awaited, every branch is wrapped so an
// exception cannot turn into a 500, and the response is always "continue".
// Without utm_content nothing is sent at all: those are ordinary visitors.
//
// No IP is forwarded; only the utm fields, persona, p, user-agent and
// referer. The env vars are the same public Supabase URL and publishable key
// the frontend build already uses.
//
// Not covered by `npm run dev` (Vite does not run middleware); verify on a
// Vercel preview or production with curl and a browser, then check
// outreach_clicks (see docs/handoff/cairnly-ops-outreach-fase2-prompt.md §6).

export const config = {
  matcher: ['/demo', '/demo/'],
};

type EdgeContext = { waitUntil?: (promise: Promise<unknown>) => void };

const pick = (params: URLSearchParams, key: string): string | null => {
  const v = params.get(key);
  return v && v.trim() ? v.trim().slice(0, 200) : null;
};

export default function middleware(request: Request, context?: EdgeContext): Response {
  try {
    const url = new URL(request.url);
    const slug = pick(url.searchParams, 'utm_content');
    const base = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (slug && base && key) {
      const payload = {
        utm_content: slug,
        utm_campaign: pick(url.searchParams, 'utm_campaign'),
        utm_source: pick(url.searchParams, 'utm_source'),
        utm_medium: pick(url.searchParams, 'utm_medium'),
        persona: pick(url.searchParams, 'persona'),
        p: pick(url.searchParams, 'p'),
        user_agent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
      };

      const send = fetch(`${base}/functions/v1/outreach-click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
        },
        body: JSON.stringify(payload),
      })
        .then(() => undefined)
        .catch(() => undefined);

      if (context?.waitUntil) context.waitUntil(send);
    }
  } catch {
    // Logging must never break the page.
  }

  // "Continue to the requested resource" (what @vercel/edge's next() returns),
  // spelled out so this file has no dependency.
  return new Response(null, { headers: { 'x-middleware-next': '1' } });
}
