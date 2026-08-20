// render-report-pdf — orchestrates PDF generation for one report.
//
//   1. verify the caller owns the report
//   2. mint a single-use render token
//   3. ask the Vercel renderer to print /report/print?rt=<token>
//   4. store the PDF in the private report-pdfs bucket
//   5. upsert a report_pdfs row and return a signed download URL
//
// Input:  { report_id: string (uuid), force?: boolean }
// Output: { storage_path, signed_url, cached }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
  checkRateLimit,
} from '../_shared/cors.ts';

/** Filename the browser saves the PDF as.
 *
 *  Passed to createSignedUrl as `download`, which makes Storage serve the file
 *  with `Content-Disposition: attachment`. That is what lets the dashboard just
 *  navigate to the URL: the browser downloads it and STAYS on the page, so
 *  there is no popup to be blocked and no tab to lose the dashboard in.
 *  Without it the URL serves inline and the user gets navigated into a PDF
 *  viewer. Stripped to ASCII word characters — a signed URL is not the place to
 *  discover how a browser handles a diacritic in a header. */
function downloadName(firstName: string | null | undefined): string {
  const who = (firstName ?? '').replace(/[^A-Za-z0-9]+/g, '');
  return who ? `Cairnly-career-report-${who}.pdf` : 'Cairnly-career-report.pdf';
}

// Cache key for a stored PDF. A render is reused only while this matches, so
// BUMP IT WHENEVER THE PRINTED LAYOUT CHANGES — otherwise every user who has
// already downloaded keeps being served the old design forever, and no amount
// of front-end work will show through. Same discipline as PRINT_BUILD in the
// SPA; this one is the one that decides what a *user* gets.
//   1 -> the original layout
//   2 -> the 2026-08 redesign (new cover, chapter openers, closing page)
const LAYOUT_VERSION = 2;

// 5 minutes. A Supabase signed URL is an UNREVOCABLE bearer credential (an HMAC
// over path + expiry) — once issued there is no way to invalidate it short of
// rotating the project JWT secret or deleting the object. The browser fetches
// it immediately, so a long TTL buys nothing and leaves a link that keeps
// serving a full career report from browser history. Matches the 300s used in
// useAIResumeUpload.ts. Re-signing is free via the cached branch below.
const SIGNED_URL_TTL_SECONDS = 300;

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  const rateLimited = checkRateLimit(req, 5, corsHeaders);
  if (rateLimited) return rateLimited;

  // NOTE: getAuthenticatedUser resolves to { userId, email } — not { id }.
  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  const { userId: authUserId } = authed;

  let reportId: string | undefined;
  let force = false;
  try {
    const body = await req.json();
    reportId = body?.report_id;
    force = body?.force === true;
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }
  if (!reportId) return errorResponse('report_id is required', 400, corsHeaders);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Ownership + completion check.
  const { data: report } = await supabase
    .from('reports')
    .select('id, user_id, status')
    .eq('id', reportId)
    .maybeSingle();

  if (!report) return errorResponse('Report not found', 404, corsHeaders);
  if (report.user_id !== authUserId) return errorResponse('Not your report', 403, corsHeaders);
  if (report.status !== 'completed') {
    return errorResponse('Report is not finished yet', 409, corsHeaders);
  }

  // The report's language is stamped on its sections by WF1 (one language per
  // report). NOTE this means "the language the report is stamped as", not "the
  // language of the prose" — WF3/WF4 narrative content is currently hard-forced
  // to English even when sections say 'nl'.
  const { data: langRow } = await supabase
    .from('report_sections')
    .select('language')
    .eq('report_id', reportId)
    .limit(1)
    .maybeSingle();
  const reportLanguage = langRow?.language ?? 'en';

  // Current partner, resolved fresh. A user assigned to a partner after their
  // PDF was generated must not keep receiving the unbranded cached copy.
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('partner_id, first_name')
    .eq('id', report.user_id)
    .maybeSingle();
  const currentPartnerId = ownerProfile?.partner_id ?? null;

  // Reuse an existing PDF unless the layout changed, the branding changed, or
  // force was passed.
  const { data: existing } = await supabase
    .from('report_pdfs')
    .select('storage_path, layout_version, partner_id')
    .eq('report_id', reportId)
    .maybeSingle();

  if (
    existing &&
    existing.layout_version === LAYOUT_VERSION &&
    (existing.partner_id ?? null) === currentPartnerId &&
    !force
  ) {
    const { data: signed } = await supabase.storage
      .from('report-pdfs')
      .createSignedUrl(existing.storage_path, SIGNED_URL_TTL_SECONDS, {
        download: downloadName(ownerProfile?.first_name),
      });
    return new Response(
      JSON.stringify({
        storage_path: existing.storage_path,
        signed_url: signed?.signedUrl ?? null,
        cached: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // 2. Mint the render token.
  const { data: tokenRow, error: tokenError } = await supabase
    .from('report_render_tokens')
    .insert({ report_id: reportId, user_id: report.user_id })
    .select('token')
    .single();

  if (tokenError || !tokenRow) {
    console.error('[render-report-pdf] token mint failed:', tokenError);
    return errorResponse('Could not start render', 500, corsHeaders);
  }

  // 3. Call the renderer.
  //
  // SITE_URL feeds BOTH the endpoint and the print URL on purpose: they must be
  // the same origin, because /report/print and /api/render-report only exist on
  // a deployment that has this branch. When testing on a Vercel preview, point
  // SITE_URL at the preview — do not use RENDER_ENDPOINT_URL for that, since it
  // moves only the endpoint and leaves printUrl on production.
  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://cairnly.io';
  const rendererUrl = Deno.env.get('RENDER_ENDPOINT_URL') ?? `${siteUrl}/api/render-report`;
  const sharedSecret = Deno.env.get('RENDER_SHARED_SECRET');
  if (!sharedSecret) {
    console.error('[render-report-pdf] RENDER_SHARED_SECRET is not set');
    return errorResponse('Renderer is not configured', 500, corsHeaders);
  }

  const printUrl = `${siteUrl}/report/print?rt=${tokenRow.token}`;

  let pdfBytes: Uint8Array;
  try {
    const renderRes = await fetch(rendererUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-render-secret': sharedSecret },
      body: JSON.stringify({ printUrl }),
    });
    const renderJson = await renderRes.json();
    if (!renderRes.ok) {
      // renderJson.error may echo the loaded path for diagnosis; log the status
      // and message only, never printUrl (it carries a live render token).
      console.error('[render-report-pdf] renderer error:', renderRes.status, renderJson?.error);
      return errorResponse(`Renderer failed (${renderRes.status})`, 502, corsHeaders);
    }
    pdfBytes = Uint8Array.from(atob(renderJson.pdfBase64), (c) => c.charCodeAt(0));
  } catch (err) {
    // Deliberately does NOT log printUrl — it carries a live, unburned render
    // token, and edge-function logs are a lower-trust surface than the DB.
    console.error('[render-report-pdf] renderer unreachable:', err);
    return errorResponse('Renderer unreachable', 502, corsHeaders);
  }

  // 4. Store it. Path is namespaced by user so the account-deletion prefix
  //    sweep in delete-user-data can find every object without a DB row.
  const storagePath = `${report.user_id}/${reportId}-v${LAYOUT_VERSION}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('report-pdfs')
    .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    console.error('[render-report-pdf] upload failed:', uploadError);
    return errorResponse('Could not store the PDF', 500, corsHeaders);
  }

  // 5. Record and sign.
  const { error: recordError } = await supabase.from('report_pdfs').upsert(
    {
      report_id: reportId,
      user_id: report.user_id,
      storage_path: storagePath,
      byte_size: pdfBytes.byteLength,
      layout_version: LAYOUT_VERSION,
      language: reportLanguage,
      partner_id: currentPartnerId,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'report_id' },
  );

  if (recordError) {
    console.error('[render-report-pdf] record upsert failed:', recordError);
  }

  const { data: signed } = await supabase.storage
    .from('report-pdfs')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, {
      download: downloadName(ownerProfile?.first_name),
    });

  return new Response(
    JSON.stringify({
      storage_path: storagePath,
      signed_url: signed?.signedUrl ?? null,
      cached: false,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
