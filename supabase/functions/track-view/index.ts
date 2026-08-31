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
  event_type?: 'scroll_depth' | 'cta_click' | 'sample_view';
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
    const { error } = await supabase.from('analytics_events').insert({
      session_id: sessionId,
      event_type: 'sample_view',
      path: samplePath,
      prospect: tag(body.prospect),
      utm_source: tag(body.utm_source),
      utm_medium: tag(body.utm_medium),
      utm_campaign: tag(body.utm_campaign),
      country,
    });
    if (error) {
      console.error('[track-view] sample_view insert error:', error);
      return errorResponse('Failed to record event', 500, corsHeaders);
    }
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
