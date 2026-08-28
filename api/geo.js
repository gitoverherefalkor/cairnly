// Vercel Edge Function: hands the browser its own two-letter country code.
//
// Vercel populates x-vercel-ip-country on requests that pass through its edge
// network, but the frontend's tracking beacons go straight from the browser
// to Supabase (supabase.functions.invoke) and never touch Vercel — so that
// header is never available on those calls. This same-origin hop is the
// cheapest way to get it: fetched once per session by usePageViewTracking,
// cached in sessionStorage, then sent along on every track-view/analytics
// call from there. No PII, no cookies — just a country code the browser
// already effectively knows from its own network path.

export const config = { runtime: 'edge' };

export default function handler(req) {
  const country = req.headers.get('x-vercel-ip-country') || null;
  return new Response(JSON.stringify({ country }), {
    headers: {
      'Content-Type': 'application/json',
      // Per-request geo, but stable enough within a session to shave repeat
      // lookups off the same edge PoP for a minute.
      'Cache-Control': 'private, max-age=60',
    },
  });
}
