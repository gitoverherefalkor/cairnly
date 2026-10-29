// ops-free-codes — individual free codes for the Ops console.
//
// One code for one named person, handed out by hand (usually over WhatsApp),
// so there is no email involved anywhere. The code row records who it went to
// (issued_to) and when (issued_on). Redeeming it is the normal access-code
// signup: no Stripe checkout.
//
// Actions: list | mint | setActive
// Admin-gated, all reads and writes via the service role.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';
import { isAdminEmail } from '../_shared/admins.ts';

const SITE = 'https://cairnly.io';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Json = Record<string, unknown>;

const ok = (body: Json, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Straight to the signup form with the code filled in; ?lang sets the page
// language (i18n reads it from the querystring).
const signupLink = (code: string, lang: string) =>
  `${SITE}/auth?flow=signup&code=${encodeURIComponent(code)}&lang=${lang === 'nl' ? 'nl' : 'en'}`;

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  if (!isAdminEmail(authed.email)) {
    return errorResponse('Forbidden', 403, corsHeaders);
  }

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const action = String(body.action ?? '');

  try {
    // ── list ────────────────────────────────────────────────────────────────
    // Every individual free code, newest handed out first.
    if (action === 'list') {
      const { data, error } = await supabase
        .from('access_codes')
        .select('id, code, issued_to, issued_on, created_at, is_active, user_id, used_at')
        .not('issued_to', 'is', null)
        .order('issued_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return ok({ codes: data ?? [] }, corsHeaders);
    }

    // ── mint ────────────────────────────────────────────────────────────────
    if (action === 'mint') {
      const issuedTo = String(body.issuedTo ?? '').trim();
      const issuedOn = String(body.issuedOn ?? '').trim();
      const lang = String(body.lang ?? 'nl');

      if (!issuedTo) return errorResponse('Enter the name of who this code is for.', 400, corsHeaders);
      if (issuedTo.length > 120) return errorResponse('That name is too long.', 400, corsHeaders);
      if (issuedOn && !DATE_RE.test(issuedOn)) {
        return errorResponse('Pick a valid date.', 400, corsHeaders);
      }

      const { data: code, error } = await supabase.rpc('mint_individual_code', {
        p_issued_to: issuedTo,
        // Omitted means today (the function's default).
        ...(issuedOn ? { p_issued_on: issuedOn } : {}),
      });
      if (error) throw error;

      return ok({ code, link: signupLink(String(code), lang) }, corsHeaders);
    }

    // ── setActive ───────────────────────────────────────────────────────────
    // Deactivate a code that went to the wrong person (or switch it back on).
    // Only touches individual free codes, never a bought or partner code.
    if (action === 'setActive') {
      const id = String(body.id ?? '');
      const isActive = Boolean(body.isActive);
      if (!id) return errorResponse('Missing code id', 400, corsHeaders);

      const { data, error } = await supabase
        .from('access_codes')
        .update({ is_active: isActive })
        .eq('id', id)
        .not('issued_to', 'is', null)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse('Code not found', 404, corsHeaders);
      return ok({ id, isActive }, corsHeaders);
    }

    return errorResponse(`Unknown action: ${action}`, 400, corsHeaders);
  } catch (e) {
    console.error('[ops-free-codes]', action, e);
    return errorResponse('Something went wrong. Check the function logs.', 500, corsHeaders);
  }
});
