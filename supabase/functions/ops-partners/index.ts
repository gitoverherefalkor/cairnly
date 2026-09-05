// ops-partners — partner onboarding for the Ops console.
//
// Everything a partner needs to go live, without touching the Supabase console:
// create the partner, upload their logo, mint a batch of codes, read back how
// far each batch got. Admin-gated, all writes via the service role.
//
// The browser never touches the `partner-logos` bucket. That bucket is private
// with RLS and zero policies, so only the service role can write to it; the file
// comes in here as base64 on the JSON body and is decoded and uploaded here.
//
// Actions: list | save | mint | setActive

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';
import { isAdminEmail } from '../_shared/admins.ts';

const BUCKET = 'partner-logos';
const MAX_LOGO_BYTES = 256 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/svg+xml']);

// The slug becomes a storage path segment and, later, the /p/:slug landing
// route. Keep it to what is safe in both.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

const SITE = 'https://cairnly.io';

type Json = Record<string, unknown>;

const ok = (body: Json, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Decode base64 to bytes, tolerating a `data:...;base64,` prefix. */
function decodeBase64(input: string): Uint8Array {
  const comma = input.indexOf(',');
  const raw = input.startsWith('data:') && comma > -1 ? input.slice(comma + 1) : input;
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// The link a bureau hands to a candidate: the branded landing page /p/:slug,
// which shows the bureau's logo once and then forwards to the normal signup
// with the code pre-filled. Mirrors partnerLandingPath in src/lib/partnerLinks.ts.
// Links minted before the landing page existed (/auth?flow=signup&code=…)
// keep working; the landing page hands over to exactly that URL.
const candidateLink = (slug: string, code: string, lang: string) =>
  `${SITE}/p/${slug}?code=${encodeURIComponent(code)}&lang=${lang === 'nl' ? 'nl' : 'en'}`;

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
    if (action === 'list') {
      const { data: stats, error: statsErr } = await supabase
        .from('partner_code_status')
        .select('*')
        .order('slug');
      if (statsErr) throw statsErr;

      const { data: rows, error: rowsErr } = await supabase
        .from('partners')
        .select('id, slug, name, logo_path, logo_mime, powered_by_text, is_active, created_at');
      if (rowsErr) throw rowsErr;

      const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
      const partners = (stats ?? []).map((s) => ({
        ...s,
        ...(byId.get(s.partner_id as string) ?? {}),
        has_logo: Boolean(byId.get(s.partner_id as string)?.logo_path),
      }));
      return ok({ partners }, corsHeaders);
    }

    // ── save ────────────────────────────────────────────────────────────────
    if (action === 'save') {
      const slug = String(body.slug ?? '').trim().toLowerCase();
      const name = String(body.name ?? '').trim();
      const poweredByText = body.poweredByText ? String(body.poweredByText).trim() : null;

      if (!SLUG_RE.test(slug)) {
        return errorResponse(
          'Slug may only contain lowercase letters, numbers and dashes (2-40 characters).',
          400,
          corsHeaders,
        );
      }
      if (!name || name.length > 80) {
        return errorResponse('Name is required and must be 80 characters or fewer.', 400, corsHeaders);
      }

      // Upload the logo first: a partner row pointing at a file that failed to
      // upload is worse than no row at all.
      let logoPath: string | null = null;
      let logoMime: string | null = null;

      if (body.logoBase64) {
        const mime = String(body.logoMime ?? '');
        if (!ALLOWED_MIME.has(mime)) {
          return errorResponse('Logo must be a PNG or an SVG.', 400, corsHeaders);
        }
        let bytes: Uint8Array;
        try {
          bytes = decodeBase64(String(body.logoBase64));
        } catch {
          return errorResponse('Could not read the logo file.', 400, corsHeaders);
        }
        if (bytes.byteLength > MAX_LOGO_BYTES) {
          return errorResponse(
            `Logo is ${Math.round(bytes.byteLength / 1024)} KB. The limit is 256 KB, ask the partner for a smaller file or an SVG.`,
            400,
            corsHeaders,
          );
        }
        logoPath = `${slug}/logo.${mime === 'image/svg+xml' ? 'svg' : 'png'}`;
        logoMime = mime;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(logoPath, bytes, { contentType: mime, upsert: true });
        if (upErr) throw upErr;
      }

      const patch: Json = { slug, name, powered_by_text: poweredByText };
      // Only overwrite the logo columns when a new file came in, so saving a
      // name change does not silently unbrand an existing partner.
      if (logoPath) {
        patch.logo_path = logoPath;
        patch.logo_mime = logoMime;
      }

      const { data: saved, error: saveErr } = await supabase
        .from('partners')
        .upsert(patch, { onConflict: 'slug' })
        .select('id, slug, name, logo_path, powered_by_text, is_active')
        .single();
      if (saveErr) throw saveErr;

      return ok({ partner: saved }, corsHeaders);
    }

    // ── mint ────────────────────────────────────────────────────────────────
    if (action === 'mint') {
      const slug = String(body.slug ?? '').trim().toLowerCase();
      const count = Number(body.count ?? 0);
      const lang = String(body.lang ?? 'nl');
      const expiresAt = body.expiresAt ? String(body.expiresAt) : null;

      if (!SLUG_RE.test(slug)) return errorResponse('Unknown partner.', 400, corsHeaders);
      if (!Number.isInteger(count) || count < 1 || count > 500) {
        return errorResponse('Choose a number of codes between 1 and 500.', 400, corsHeaders);
      }

      const { data, error } = await supabase.rpc('mint_partner_codes', {
        p_partner_slug: slug,
        p_count: count,
        p_expires_at: expiresAt,
      });
      if (error) throw error;

      const codes = (data ?? []).map((r: { code: string }) => r.code);
      return ok(
        { codes, links: codes.map((c: string) => candidateLink(slug, c, lang)) },
        corsHeaders,
      );
    }

    // ── setActive ───────────────────────────────────────────────────────────
    if (action === 'setActive') {
      const slug = String(body.slug ?? '').trim().toLowerCase();
      const isActive = Boolean(body.isActive);
      if (!SLUG_RE.test(slug)) return errorResponse('Unknown partner.', 400, corsHeaders);

      const { error } = await supabase
        .from('partners')
        .update({ is_active: isActive })
        .eq('slug', slug);
      if (error) throw error;
      return ok({ slug, isActive }, corsHeaders);
    }

    return errorResponse(`Unknown action: ${action}`, 400, corsHeaders);
  } catch (e) {
    console.error('[ops-partners]', action, e);
    return errorResponse('Something went wrong. Check the function logs.', 500, corsHeaders);
  }
});
