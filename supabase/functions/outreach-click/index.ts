// outreach-click — records one row in outreach_clicks per /demo request that
// carried a utm_content (the per-bureau slug in an outreach email link).
//
// Called server-to-server by the Vercel Edge Middleware (middleware.ts at
// the repo root), which sees the GET /demo?...&utm_content=<slug> before the
// SPA renders and forwards the query fields plus the visitor's user-agent
// and referer. Because the middleware fires this via waitUntil() and never
// awaits it, nothing here can slow /demo down; a failure just loses the row.
//
// Why a separate function instead of a branch in track-view: track-view is
// the browser beacon and is keyed on a client session id; this is a
// server-side hit log with no session and no JavaScript involved (so link
// scanners that never run JS are recorded too, which is the whole point of
// the is_bot column). Keeping it apart also means it could be deployed and
// tested on its own without redeploying the live analytics beacon.
//
// Gate: verify_jwt is off (the middleware has no user JWT). The function is
// public in the same sense track-view is (the anon key is public anyway): it
// only accepts requests that carry utm_content, is rate-limited per IP, and
// the only thing it can do is insert a click row. No IP is stored.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  checkRateLimit,
} from '../_shared/cors.ts';
import { isBotUserAgent } from '../_shared/outreach.ts';

type Body = {
  utm_content?: unknown;
  utm_campaign?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  persona?: unknown;
  p?: unknown;
  user_agent?: unknown;
  referer?: unknown;
};

// utm/persona/p values come off a URL a stranger can type. Same squeeze the
// browser beacon applies: slug charset, 64 chars.
const tag = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 64);
  return cleaned || null;
};

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  // Middleware requests all arrive from Vercel's edge, so the "IP" here is a
  // Vercel PoP rather than the visitor; the limit is a backstop against a
  // script hammering the endpoint directly, not a per-visitor budget.
  const limited = checkRateLimit(req, 120, corsHeaders);
  if (limited) return limited;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const slug = tag(body.utm_content);
  if (!slug) {
    // Not an outreach click. The middleware already filters on this; the
    // check here keeps the table clean if anything else ever posts.
    return errorResponse('utm_content required', 400, corsHeaders);
  }

  const userAgent = text(body.user_agent, 300);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await supabase.from('outreach_clicks').insert({
    slug,
    campaign: tag(body.utm_campaign),
    utm_source: tag(body.utm_source),
    utm_medium: tag(body.utm_medium),
    persona: tag(body.persona),
    p: tag(body.p),
    user_agent: userAgent,
    referer: text(body.referer, 300),
    is_bot: isBotUserAgent(userAgent),
  });

  if (error) {
    console.error('[outreach-click] insert error:', error);
    return errorResponse('Failed to record click', 500, corsHeaders);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
