// Custom Résumé generation kickoff.
//
// 1. Verifies the caller owns the report and that a résumé is on file.
// 2. Inserts one `custom_resumes` row per selected career (status='processing').
// 3. Creates a signed URL for the user's stored résumé PDF (5-min expiry).
// 4. Fires the n8n webhook asynchronously and returns immediately with the new
//    row IDs. The frontend subscribes to those rows via Supabase Realtime and
//    flips the UI as each generation completes.
//
// The async design matters: end-to-end generation takes ~30-40s for 3 careers
// (multiple LLM calls), which is too long for a synchronous HTTP request.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
  checkRateLimit,
} from '../_shared/cors.ts';

interface SelectedCareer {
  section_id: string;
  section_type: string;
  career_title: string;
}

interface RequestBody {
  report_id: string;
  selected_careers: SelectedCareer[];
  template_id?: string;
  include_cover_letter?: boolean;
  user_overrides?: Record<string, string>;
}

const MAX_CAREERS = 3;
const SIGNED_URL_TTL_SECONDS = 600; // 10 min — n8n needs longer than the upload flow

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Rate limit: generation is expensive (LLM calls), so cap per-IP.
    const rateLimitResponse = checkRateLimit(req, 10, corsHeaders, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    const authed = await getAuthenticatedUser(req, corsHeaders);
    if (authed instanceof Response) return authed;
    const { userId } = authed;

    const body = (await req.json()) as RequestBody;
    const {
      report_id,
      selected_careers,
      template_id = 'ats-classic',
      include_cover_letter = true,
      user_overrides = {},
    } = body ?? {};

    // Validate inputs
    if (!report_id || typeof report_id !== 'string') {
      return errorResponse('report_id is required', 400, corsHeaders);
    }
    if (!Array.isArray(selected_careers) || selected_careers.length === 0) {
      return errorResponse('At least one career must be selected', 400, corsHeaders);
    }
    if (selected_careers.length > MAX_CAREERS) {
      return errorResponse(`At most ${MAX_CAREERS} careers can be selected`, 400, corsHeaders);
    }
    for (const c of selected_careers) {
      if (!c?.section_id || !c?.career_title) {
        return errorResponse('Each career needs section_id and career_title', 400, corsHeaders);
      }
    }

    // Service-role client for DB writes + storage signing.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
      return errorResponse('Server misconfigured', 500, corsHeaders);
    }
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Verify the report belongs to the authenticated user. JWT alone proves
    // some user is logged in; ownership of report_id must be checked.
    const { data: report, error: reportError } = await sb
      .from('reports')
      .select('id, user_id')
      .eq('id', report_id)
      .maybeSingle();

    if (reportError || !report) {
      return errorResponse('Report not found', 404, corsHeaders);
    }
    if (report.user_id !== userId) {
      return errorResponse('Report does not belong to authenticated user', 403, corsHeaders);
    }

    // Verify the user actually has a résumé on file. The Custom Résumé
    // feature has a hard prerequisite of an uploaded résumé — without one
    // the generation has nothing to tailor from.
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('resume_uploaded_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile?.resume_uploaded_at) {
      return errorResponse(
        'You need to upload a résumé before generating tailored versions.',
        400,
        corsHeaders,
      );
    }

    // Find the most recently uploaded résumé file in this user's storage prefix.
    // We don't store the file path on the profile today, so we list and pick newest.
    const { data: files, error: listError } = await sb.storage
      .from('resumes')
      .list(userId, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (listError || !files?.length) {
      console.error('Could not list resume files:', listError);
      return errorResponse('Could not locate your uploaded résumé. Please re-upload.', 404, corsHeaders);
    }

    const latestFile = files[0];
    const filePath = `${userId}/${latestFile.name}`;

    const { data: signed, error: signError } = await sb.storage
      .from('resumes')
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error('Could not sign resume URL:', signError);
      return errorResponse('Could not prepare résumé for processing.', 500, corsHeaders);
    }

    // Verify each selected career's section_id belongs to this report.
    // Prevents an attacker forging section IDs from other reports.
    const sectionIds = selected_careers.map((c) => c.section_id);
    const { data: sections, error: sectionsError } = await sb
      .from('report_sections')
      .select('id, report_id, section_type, title')
      .in('id', sectionIds);

    if (sectionsError) {
      console.error('Section lookup failed:', sectionsError);
      return errorResponse('Could not validate selected careers.', 500, corsHeaders);
    }
    if (!sections || sections.length !== sectionIds.length) {
      return errorResponse('One or more selected careers were not found.', 404, corsHeaders);
    }
    for (const s of sections) {
      if (s.report_id !== report_id) {
        return errorResponse('Selected career does not belong to this report.', 403, corsHeaders);
      }
    }

    // Resolve each selected career to its enriched_jobs.id (integer PK).
    // n8n filters by this integer instead of career_title — career titles can
    // contain commas, which PostgREST treats as filter separators and chokes on.
    const careerTitles = selected_careers.map((c) => c.career_title);
    const { data: enrichedRows, error: enrichedError } = await sb
      .from('enriched_jobs')
      .select('id, career_title')
      .eq('report_id', report_id)
      .in('career_title', careerTitles);

    if (enrichedError) {
      console.error('enriched_jobs lookup failed:', enrichedError);
      return errorResponse('Could not look up enriched career data.', 500, corsHeaders);
    }

    const enrichedIdByTitle = new Map<string, number>();
    for (const row of enrichedRows ?? []) {
      if (row.career_title) enrichedIdByTitle.set(row.career_title, row.id);
    }

    const missingEnriched = selected_careers
      .map((c) => c.career_title)
      .filter((t) => !enrichedIdByTitle.has(t));
    if (missingEnriched.length) {
      console.error('No enriched_jobs row for:', missingEnriched);
      return errorResponse(
        'Selected careers are not fully enriched yet. Please try again in a moment.',
        409,
        corsHeaders,
      );
    }

    // Insert one row per selected career. Frontend uses these IDs to subscribe
    // to status changes via Realtime.
    const rowsToInsert = selected_careers.map((c) => ({
      user_id: userId,
      report_id,
      career_section_id: c.section_id,
      career_title: c.career_title,
      template_id,
      resume_json: { _pending: true } as Record<string, unknown>,
      status: 'processing' as const,
    }));

    const { data: inserted, error: insertError } = await sb
      .from('custom_resumes')
      .insert(rowsToInsert)
      .select('id, career_section_id');

    if (insertError || !inserted) {
      console.error('Failed to insert custom_resumes rows:', insertError);
      return errorResponse('Could not start résumé generation.', 500, corsHeaders);
    }

    // Build the n8n payload. Each pending row gets joined back to its career.
    const idBySection = new Map<string, string>();
    for (const row of inserted) {
      if (row.career_section_id) idBySection.set(row.career_section_id, row.id);
    }
    const careersForN8n = selected_careers.map((c) => ({
      ...c,
      custom_resume_id: idBySection.get(c.section_id) ?? null,
      enriched_job_id: enrichedIdByTitle.get(c.career_title) ?? null,
    }));

    const n8nWebhookUrl = Deno.env.get('N8N_CUSTOM_RESUME_WEBHOOK_URL');
    const n8nSharedSecret = Deno.env.get('N8N_SHARED_SECRET');

    if (!n8nWebhookUrl) {
      // Mark the rows failed so the UI surfaces a clear error rather than
      // spinning forever. This is a server misconfiguration, not a user error.
      console.error('N8N_CUSTOM_RESUME_WEBHOOK_URL not set');
      await sb
        .from('custom_resumes')
        .update({ status: 'failed', error_message: 'Generation service not configured.' })
        .in(
          'id',
          inserted.map((r) => r.id),
        );
      return errorResponse('Résumé generation is temporarily unavailable.', 503, corsHeaders);
    }

    // Fire-and-forget n8n call. We don't await it — the workflow takes ~30-40s
    // and the frontend will pick up status changes via Realtime. Any failure
    // on the n8n side will mark the affected rows as 'failed'.
    const n8nPayload = {
      user_id: userId,
      report_id,
      resume_file_url: signed.signedUrl,
      selected_careers: careersForN8n,
      include_cover_letter,
      user_overrides,
      template_id,
    };

    // We do still want to know if the webhook is reachable at all — so we
    // await the initial POST but with a short timeout. n8n's "Respond to
    // Webhook" pattern can either respond immediately (recommended) or hold
    // open; we tolerate both up to 8s, then assume the workflow is running
    // and let Realtime handle the rest.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    let webhookOk = true;
    try {
      const resp = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(n8nSharedSecret ? { 'x-shared-secret': n8nSharedSecret } : {}),
        },
        body: JSON.stringify(n8nPayload),
        signal: controller.signal,
      });
      if (!resp.ok && resp.status !== 202) {
        console.error('n8n webhook returned non-OK:', resp.status, await resp.text());
        webhookOk = false;
      }
    } catch (e) {
      // AbortError is fine — n8n is running, just slow to respond.
      if ((e as Error)?.name !== 'AbortError') {
        console.error('n8n webhook fetch failed:', e);
        webhookOk = false;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!webhookOk) {
      await sb
        .from('custom_resumes')
        .update({ status: 'failed', error_message: 'Generation service rejected the request.' })
        .in(
          'id',
          inserted.map((r) => r.id),
        );
      return errorResponse('Could not start résumé generation. Please try again.', 502, corsHeaders);
    }

    return new Response(
      JSON.stringify({
        custom_resume_ids: inserted.map((r) => r.id),
        status: 'processing',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in generate-custom-resume:', error);
    return errorResponse('An error occurred. Please try again.', 500, corsHeaders);
  }
});
