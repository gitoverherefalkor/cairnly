// report-print-data — exchanges a single-use render token for the report data
// needed by the /report/print route.
//
// This function is intentionally PUBLIC (verify_jwt = false): the caller is
// headless Chromium inside the Vercel renderer, which has no Supabase session.
// Security rests entirely on the render token: single-use, 10-minute lifetime,
// minted only by render-report-pdf for a report the authenticated user owns.
//
// Input:  { token: string (uuid) }
// Output: { report, sections, profile, partner }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, errorResponse } from '../_shared/cors.ts';

const MAX_LOGO_BYTES = 262_144; // mirrors the partner-logos bucket cap

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  let token: string | undefined;
  try {
    const body = await req.json();
    token = body?.token;
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!token || !UUID_RE.test(token)) {
    return errorResponse('Missing or malformed token', 400, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Burn the token atomically: the update only matches an unused, unexpired
  // row, so a replayed request finds nothing and is rejected.
  const { data: burned, error: burnError } = await supabase
    .from('report_render_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('report_id, user_id')
    .maybeSingle();

  if (burnError) {
    console.error('[report-print-data] token burn failed:', burnError);
    return errorResponse('Token validation failed', 500, corsHeaders);
  }
  if (!burned) {
    // Covers unknown, already-used and expired tokens alike — deliberately
    // indistinguishable to the caller.
    return errorResponse('Invalid or expired token', 403, corsHeaders);
  }

  const [{ data: report }, { data: sections }, { data: profile }] = await Promise.all([
    supabase
      .from('reports')
      .select('id, title, status, created_at, updated_at')
      .eq('id', burned.report_id)
      .maybeSingle(),
    supabase
      .from('report_sections')
      .select('*')
      .eq('report_id', burned.report_id)
      .order('order_number', { ascending: true, nullsFirst: false }),
    supabase
      .from('profiles')
      .select('first_name, last_name, country, partner_id')
      .eq('id', burned.user_id)
      .maybeSingle(),
  ]);

  if (!report) {
    return errorResponse('Report not found', 404, corsHeaders);
  }

  // ── Partner white-label (optional) ─────────────────────────────────────────
  // The deployed CSP is `img-src 'self' data: blob: https://images.unsplash.com`
  // (vercel.json), applied to every path on the origin — including the one
  // Chromium loads. A Supabase Storage URL in an <img> is therefore BLOCKED,
  // and it fails SILENTLY: Chromium renders a broken image and page.pdf() still
  // succeeds, so you would ship a PDF with a hole in it and no error anywhere.
  // Downloading here and handing the page a data: URI needs no CSP change, and
  // generalises to partner-hosted logos whose domains can never be enumerated.
  let partner:
    | { name: string; logo_data_uri: string | null; powered_by_text: string | null }
    | null = null;

  if (profile?.partner_id) {
    const { data: p } = await supabase
      .from('partners')
      .select('name, logo_path, logo_mime, powered_by_text, is_active')
      .eq('id', profile.partner_id)
      .maybeSingle();

    if (p && p.is_active) {
      let logoDataUri: string | null = null;
      if (p.logo_path) {
        try {
          const { data: blob, error: dlErr } = await supabase.storage
            .from('partner-logos')
            .download(p.logo_path);
          if (dlErr || !blob) throw dlErr ?? new Error('empty logo');

          const bytes = new Uint8Array(await blob.arrayBuffer());
          // Defence in depth: the bucket caps at 256 KB, but a bucket limit can
          // be relaxed by hand. Drop the logo rather than bloat the payload.
          if (bytes.byteLength > MAX_LOGO_BYTES) {
            console.warn('[report-print-data] partner logo too large, skipping:', bytes.byteLength);
          } else {
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            logoDataUri = `data:${p.logo_mime || 'image/png'};base64,${btoa(bin)}`;
          }
        } catch (e) {
          // Never fail a render over branding — fall back to plain Cairnly.
          console.error('[report-print-data] partner logo fetch failed:', e);
        }
      }
      partner = {
        name: p.name,
        logo_data_uri: logoDataUri,
        powered_by_text: p.powered_by_text ?? null,
      };
    }
  }

  return new Response(
    JSON.stringify({
      report,
      sections: sections ?? [],
      // last_name is used only by the printed cover's "Prepared for …" line.
      profile: {
        first_name: profile?.first_name ?? '',
        last_name: profile?.last_name ?? null,
        country: profile?.country ?? null,
      },
      // null for every user today, so the print page's partner branches never
      // fire and unbranded output is byte-identical to the pre-white-label design.
      partner,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
