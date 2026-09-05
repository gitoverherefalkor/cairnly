// partner-public — what a candidate is allowed to see about a partner.
//
// Serves the /p/:slug landing page: the bureau's name, its logo and the
// optional credit line. Nothing else from the `partners` row leaves here.
//
// Why a function and not a client-side select: `partners` has RLS on with zero
// policies (admin-seeded, service-role only) and the logo lives in the private
// `partner-logos` bucket. Both are deliberate, so the browser cannot read
// either directly. The logo is handed back as a data: URI for the same reason
// report-print-data does it — the deployed CSP's img-src does not allow
// supabase.co, and a data: URI needs no CSP change.
//
// Anonymous by design (config.toml: verify_jwt = false); the candidate has no
// account yet. The only input is a slug, the only output is marketing-grade
// public info, and inactive or unknown slugs answer 404 with no detail.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  checkRateLimit,
} from '../_shared/cors.ts';

const BUCKET = 'partner-logos';
const MAX_LOGO_BYTES = 262_144; // mirrors the bucket cap
// Same rule ops-partners applies when the slug is created.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  // A landing page is opened once per candidate; 60/min per IP is generous
  // and still stops someone enumerating slugs.
  const limited = checkRateLimit(req, 60, corsHeaders);
  if (limited) return limited;

  let slug = '';
  if (req.method === 'GET') {
    slug = new URL(req.url).searchParams.get('slug') ?? '';
  } else if (req.method === 'POST') {
    try {
      const body = await req.json();
      slug = String(body?.slug ?? '');
    } catch {
      return errorResponse('Invalid JSON body', 400, corsHeaders);
    }
  } else {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  slug = slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return errorResponse('Unknown partner', 404, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: p, error } = await supabase
    .from('partners')
    .select('slug, name, logo_path, logo_mime, powered_by_text, is_active')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[partner-public] partner lookup failed:', error);
    return errorResponse('Lookup failed', 500, corsHeaders);
  }
  if (!p || !p.is_active) {
    return errorResponse('Unknown partner', 404, corsHeaders);
  }

  let logoDataUri: string | null = null;
  if (p.logo_path) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(p.logo_path);
      if (dlErr || !blob) throw dlErr ?? new Error('empty logo');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.byteLength > MAX_LOGO_BYTES) {
        console.warn('[partner-public] logo too large, skipping:', bytes.byteLength);
      } else {
        let bin = '';
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
        logoDataUri = `data:${p.logo_mime || 'image/png'};base64,${btoa(bin)}`;
      }
    } catch (e) {
      // A missing logo must not take the page down: the name still renders.
      console.error('[partner-public] logo fetch failed:', e);
    }
  }

  return new Response(
    JSON.stringify({
      partner: {
        slug: p.slug,
        name: p.name,
        logo_data_uri: logoDataUri,
        powered_by_text: p.powered_by_text ?? null,
      },
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        // A logo swap in Ops shows up within five minutes; good enough.
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
});
