// track-view — public, unauthenticated page-view beacon for first-party
// analytics. Records path + a random per-tab session id (no IP, no PII) into
// page_views via the service role. Rate-limited; failures never surface to the
// visitor (the frontend fires this fire-and-forget).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  checkRateLimit,
} from '../_shared/cors.ts';

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

  let body: { path?: string; session_id?: string; referrer?: string; engaged?: boolean };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id.slice(0, 100) : '';
  if (!sessionId) {
    return errorResponse('session_id required', 400, corsHeaders);
  }

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

  const path = typeof body.path === 'string' ? body.path.slice(0, 300) : '';
  let referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 300) : null;
  // Drop same-site referrers — only external sources are interesting.
  if (referrer && /(^https?:\/\/)?(www\.)?cairnly\.io/i.test(referrer)) referrer = null;

  if (!path) {
    return errorResponse('path required', 400, corsHeaders);
  }

  const { error } = await supabase
    .from('page_views')
    .insert({ path, session_id: sessionId, referrer });

  if (error) {
    console.error('[track-view] insert error:', error);
    return errorResponse('Failed to record view', 500, corsHeaders);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
