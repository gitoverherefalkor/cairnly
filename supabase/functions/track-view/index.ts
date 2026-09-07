// track-view — public, unauthenticated analytics beacon for first-party
// tracking. Records into page_views (page loads, engage pings) or
// analytics_events (scroll-depth milestones, CTA clicks) via the service
// role, keyed on the same per-tab session id (no IP, no PII, no cookies).
// Rate-limited; failures never surface to the visitor (the frontend fires
// this fire-and-forget).
//
// `country` on every event is server-derived: the frontend gets it from
// /api/geo (a same-origin Vercel Edge Function reading x-vercel-ip-country)
// and just passes it through here — this function does not trust it as
// anything other than a plain string, but it's never user-typed input.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  checkRateLimit,
} from '../_shared/cors.ts';

type Body = {
  path?: string;
  session_id?: string;
  referrer?: string;
  engaged?: boolean;
  country?: string;
  event_type?: 'scroll_depth' | 'cta_click' | 'sample_view' | 'demo_moment' | 'conversion';
  event_key?: string;
  persona?: string;
  milestone?: number;
  cta_id?: string;
  prospect?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

// Attribution tags (?p= and utm_*) are visitor-controlled strings off the URL.
// The frontend already squeezes them to a slug charset; this is the backstop.
const tag = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 64) : null;

const VALID_MILESTONES = new Set([25, 50, 75, 100]);

/**
 * Insert an event, and if the database does not know one of the newer
 * columns yet (42703, i.e. this function shipped ahead of its migration),
 * retry once without them rather than lose the row.
 *
 * Learned the hard way on 2026-09-06: `persona` was added to the sample_view
 * payload while the column did not exist yet, the error was swallowed as
 * "harmless", and every demo visit in that window recorded nothing at all.
 * Losing one optional field is acceptable; losing the event is not.
 */
async function insertEvent(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
  optional: string[],
): Promise<{ code?: string } | null> {
  const { error } = await supabase.from('analytics_events').insert(row);
  if (!error) return null;
  if (error.code === '42703' && optional.some((k) => k in row)) {
    const fallback = { ...row };
    for (const key of optional) delete fallback[key];
    const retry = await supabase.from('analytics_events').insert(fallback);
    if (!retry.error) {
      console.warn('[track-view] recorded without', optional.join('/'), '— migration not applied yet');
      return null;
    }
    return retry.error;
  }
  return error;
}

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  // Generous cap — a single visitor browsing fast shouldn't be blocked, but a
  // script hammering the endpoint is.
  const limited = checkRateLimit(req, 60, corsHeaders);
  if (limited) return limited;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id.slice(0, 100) : '';
  if (!sessionId) {
    return errorResponse('session_id required', 400, corsHeaders);
  }

  const country = typeof body.country === 'string' ? body.country.slice(0, 2).toUpperCase() : null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Engage ping — fired ~10s into a page view. Marks the session as engaged so
  // it no longer counts as a bounce.
  if (body.engaged === true) {
    const { error } = await supabase
      .from('page_views')
      .update({ engaged: true })
      .eq('session_id', sessionId);
    if (error) console.error('[track-view] engage update error:', error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Engagement events — scroll depth / CTA clicks — go to analytics_events.
  if (body.event_type === 'scroll_depth' || body.event_type === 'cta_click') {
    const path = typeof body.path === 'string' ? body.path.slice(0, 300) : '';
    if (!path) {
      return errorResponse('path required', 400, corsHeaders);
    }

    if (body.event_type === 'scroll_depth') {
      if (!VALID_MILESTONES.has(body.milestone as number)) {
        return errorResponse('milestone must be 25, 50, 75 or 100', 400, corsHeaders);
      }
      const { error } = await supabase.from('analytics_events').insert({
        session_id: sessionId,
        event_type: 'scroll_depth',
        path,
        milestone: body.milestone,
        country,
      });
      // 23505 = unique_violation on the (session_id, milestone) dedupe index —
      // this milestone was already recorded for this session. Not an error.
      if (error && error.code !== '23505') {
        console.error('[track-view] scroll_depth insert error:', error);
        return errorResponse('Failed to record event', 500, corsHeaders);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // cta_click
    const ctaId = typeof body.cta_id === 'string' ? body.cta_id.slice(0, 100) : '';
    if (!ctaId) {
      return errorResponse('cta_id required', 400, corsHeaders);
    }
    const { error } = await supabase.from('analytics_events').insert({
      session_id: sessionId,
      event_type: 'cta_click',
      path,
      cta_id: ctaId,
      country,
    });
    if (error) {
      console.error('[track-view] cta_click insert error:', error);
      return errorResponse('Failed to record event', 500, corsHeaders);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Sample-report view — the partner-channel specimen at
  // /partners/voorbeeldrapport, opened from a per-prospect link (?p=<slug>)
  // and sometimes a campaign (utm_*). page_views can't carry this: it records
  // the pathname only and drops the query string.
  if (body.event_type === 'sample_view') {
    const samplePath = typeof body.path === 'string' ? body.path.slice(0, 300) : '';
    if (!samplePath) {
      return errorResponse('path required', 400, corsHeaders);
    }
    const error = await insertEvent(
      supabase,
      {
        session_id: sessionId,
        event_type: 'sample_view',
        path: samplePath,
        persona: tag(body.persona),
        prospect: tag(body.prospect),
        utm_source: tag(body.utm_source),
        utm_medium: tag(body.utm_medium),
        utm_campaign: tag(body.utm_campaign),
        country,
      },
      ['persona'],
    );
    if (error) {
      console.error('[track-view] sample_view insert error:', error);
      return errorResponse('Failed to record event', 500, corsHeaders);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Keyed events, each recorded at most once per session (unique index on
  // (session_id, event_key)):
  //   demo_moment  one of the seven annotated moments in the chat replay was
  //                reached — how deep into the conversation people get
  //   conversion   intake_started / purchase. Carries the session id ONLY.
  //                The identifiable row lives in intake_sessions / purchases
  //                and is deliberately NOT linked to it, so the pageview
  //                history stays non-identifiable.
  if (body.event_type === 'demo_moment' || body.event_type === 'conversion') {
    const keyedPath = typeof body.path === 'string' ? body.path.slice(0, 300) : '';
    const eventKey = tag(body.event_key);
    if (!keyedPath) return errorResponse('path required', 400, corsHeaders);
    if (!eventKey) return errorResponse('event_key required', 400, corsHeaders);

    const error = await insertEvent(
      supabase,
      {
        session_id: sessionId,
        event_type: body.event_type,
        path: keyedPath,
        event_key: eventKey,
        persona: tag(body.persona),
        country,
      },
      ['persona'],
    );
    // 23505 unique_violation — already recorded for this session, which is
    // the point of the index. 23514 check_violation / 42703 undefined_column
    // — the event type itself predates the migration, so there is nowhere to
    // put it; drop it rather than hand the visitor's browser a 500.
    if (error && !['23505', '23514', '42703'].includes(error.code ?? '')) {
      console.error(`[track-view] ${body.event_type} insert error:`, error);
      return errorResponse('Failed to record event', 500, corsHeaders);
    }
    if (error) console.warn(`[track-view] ${body.event_type} dropped:`, error.code);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const path = typeof body.path === 'string' ? body.path.slice(0, 300) : '';
  let referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 300) : null;
  // Drop same-site referrers — only external sources are interesting.
  if (referrer && /(^https?:\/\/)?(www\.)?cairnly\.io/i.test(referrer)) referrer = null;

  if (!path) {
    return errorResponse('path required', 400, corsHeaders);
  }

  const { error } = await supabase
    .from('page_views')
    .insert({ path, session_id: sessionId, referrer, country });

  if (error) {
    console.error('[track-view] insert error:', error);
    return errorResponse('Failed to record view', 500, corsHeaders);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
