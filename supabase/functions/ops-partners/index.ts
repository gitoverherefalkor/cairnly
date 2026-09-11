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
//
// Outreach hand-off: `save` may carry a `prospectSlug` (the bureau in the
// Outreach tab this partner is for). The prospect is then linked to the
// partner and its status moves to partner_aangemaakt; `mint` moves a linked
// prospect to codes_gemint. Both go through outreach_advance_status, which
// never lowers a status.

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
// JPEG is allowed even though it has no transparency: both places a partner
// logo is rendered sit on pure white (the white band on the report cover and
// the white plate on /p/:slug), so a logo exported on a white background is
// indistinguishable from a transparent PNG there. A logo drawn on a DARK
// background will show as a dark rectangle; that is the one case to send back.
// 'image/jpg' is not a real MIME type but some browsers report it, so accept
// it and normalise below.
const ALLOWED_MIME = new Set(['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg']);

/** Canonical MIME + file extension per accepted upload. */
const MIME_CANON: Record<string, { mime: string; ext: string }> = {
  'image/png': { mime: 'image/png', ext: 'png' },
  'image/svg+xml': { mime: 'image/svg+xml', ext: 'svg' },
  'image/jpeg': { mime: 'image/jpeg', ext: 'jpg' },
  'image/jpg': { mime: 'image/jpeg', ext: 'jpg' },
};

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
          return errorResponse('Logo must be a PNG, SVG or JPG.', 400, corsHeaders);
        }
        const canon = MIME_CANON[mime];
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
        // Switching format leaves the previous logo.<ext> orphaned in the
        // bucket. Harmless: nothing points at it any more, and the row below
        // is what every reader resolves.
        logoPath = `${slug}/logo.${canon.ext}`;
        logoMime = canon.mime;

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(logoPath, bytes, { contentType: canon.mime, upsert: true });
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

      // Came from "Partner aanmaken" on an outreach row: link and advance.
      const prospectSlug = body.prospectSlug ? String(body.prospectSlug).trim() : '';
      let prospect: Json | null = null;
      if (prospectSlug) {
        const { data: linked, error: linkErr } = await supabase
          .from('outreach_prospects')
          .update({ partner_slug: slug, updated_at: new Date().toISOString() })
          .eq('slug', prospectSlug)
          .select('slug')
          .maybeSingle();
        if (linkErr) throw linkErr;
        if (linked) {
          const { data: status, error: advErr } = await supabase.rpc('outreach_advance_status', {
            p_slug: prospectSlug,
            p_status: 'partner_aangemaakt',
            p_at: new Date().toISOString(),
          });
          if (advErr) throw advErr;
          prospect = { slug: prospectSlug, status };
        }
      }

      return ok({ partner: saved, prospect }, corsHeaders);
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

      // Any outreach bureau linked to this partner now has codes.
      const { data: linked } = await supabase
        .from('outreach_prospects')
        .select('slug')
        .eq('partner_slug', slug);
      for (const p of linked ?? []) {
        const { error: advErr } = await supabase.rpc('outreach_advance_status', {
          p_slug: p.slug,
          p_status: 'codes_gemint',
          p_at: new Date().toISOString(),
        });
        if (advErr) console.error('[ops-partners] advance codes_gemint failed', p.slug, advErr);
      }

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
