// Cover Letter generation kickoff.
//
// Unlike custom résumés (one per career *type*), cover letters are per
// application — keyed to a specific scraped job posting (org, role, JD).
// The caller passes:
//   - report_id: ownership scope
//   - job: a JobListing snapshot from the "Find Open Roles" scrape
//   - source_resume_id (optional): a custom_resumes row to anchor the
//     letter's voice / tone consistency
//
// The function:
//   1. Verifies the caller owns the report (and the resume, if provided).
//   2. Inserts a `cover_letters` row in 'processing' status.
//   3. Fires the n8n cover-letter webhook with the job snapshot + résumé
//      JSON + profile context.
//   4. Returns the new row id immediately; the frontend subscribes via
//      Realtime to flip the modal from "Generating…" to ready.
//
// The async pattern mirrors generate-custom-resume — generation runs ~20–30s
// (LLM call + JD analysis), too long for a synchronous HTTP request.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
  checkRateLimit,
} from '../_shared/cors.ts';

interface JobSnapshot {
  id?: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  apply_url?: string;
  source?: string;
}

interface RequestBody {
  report_id: string;
  job: JobSnapshot;
  source_resume_id?: string | null;
}

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Rate limit: generation is LLM-backed, cap per-IP.
    const rateLimitResponse = checkRateLimit(req, 10, corsHeaders, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    const authed = await getAuthenticatedUser(req, corsHeaders);
    if (authed instanceof Response) return authed;
    const { userId } = authed;

    const body = (await req.json()) as RequestBody;
    const { report_id, job, source_resume_id = null } = body ?? ({} as RequestBody);

    if (!report_id || typeof report_id !== 'string') {
      return errorResponse('report_id is required', 400, corsHeaders);
    }
    if (!job || typeof job !== 'object') {
      return errorResponse('job is required', 400, corsHeaders);
    }
    if (!job.title || !job.company) {
      return errorResponse('job.title and job.company are required', 400, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
      return errorResponse('Server misconfigured', 500, corsHeaders);
    }
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Verify the report belongs to this user.
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

    // If a source résumé was passed, verify it exists, belongs to this user,
    // and is in a usable state. The letter's voice is anchored to it.
    let sourceResume:
      | { id: string; resume_json: unknown; career_title: string; status: string }
      | null = null;
    if (source_resume_id) {
      const { data: resumeRow, error: resumeError } = await sb
        .from('custom_resumes')
        .select('id, user_id, resume_json, career_title, status')
        .eq('id', source_resume_id)
        .maybeSingle();
      if (resumeError || !resumeRow) {
        return errorResponse('Selected résumé not found', 404, corsHeaders);
      }
      if (resumeRow.user_id !== userId) {
        return errorResponse('Résumé does not belong to authenticated user', 403, corsHeaders);
      }
      if (resumeRow.status !== 'completed') {
        return errorResponse(
          'Selected résumé is still generating or failed — pick a completed one.',
          409,
          corsHeaders,
        );
      }
      sourceResume = resumeRow as typeof sourceResume;
    }

    // Insert the cover_letters row in processing state. Frontend subscribes
    // to this row by id via Realtime.
    const { data: inserted, error: insertError } = await sb
      .from('cover_letters')
      .insert({
        user_id: userId,
        report_id,
        source_resume_id: source_resume_id ?? null,
        job_external_id: job.id ?? null,
        job_company: job.company,
        job_title: job.title,
        job_location: job.location ?? null,
        job_apply_url: job.apply_url ?? null,
        job_description: job.description ?? null,
        status: 'processing' as const,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('Failed to insert cover_letters row:', insertError);
      return errorResponse('Could not start cover letter generation.', 500, corsHeaders);
    }

    const n8nWebhookUrl = Deno.env.get('N8N_COVER_LETTER_WEBHOOK_URL');
    const n8nSharedSecret = Deno.env.get('N8N_SHARED_SECRET');

    if (!n8nWebhookUrl) {
      console.error('N8N_COVER_LETTER_WEBHOOK_URL not set');
      await sb
        .from('cover_letters')
        .update({ status: 'failed', error_message: 'Generation service not configured.' })
        .eq('id', inserted.id);
      return errorResponse('Cover letter generation is temporarily unavailable.', 503, corsHeaders);
    }

    // Lookup preferred_language so the n8n cover-letter workflow can generate
    // the letter in the user's language. See LOCALIZATION_PLAN.md Phase 2.
    const { data: profileForLang } = await sb
      .from('profiles')
      .select('preferred_language')
      .eq('id', userId)
      .maybeSingle();
    const preferred_language = profileForLang?.preferred_language || 'en';

    const n8nPayload = {
      user_id: userId,
      report_id,
      cover_letter_id: inserted.id,
      preferred_language,
      job,
      source_resume: sourceResume
        ? {
            id: sourceResume.id,
            career_title: sourceResume.career_title,
            resume_json: sourceResume.resume_json,
          }
        : null,
    };

    // Bound the kickoff POST to ~8s; n8n's "Respond to Webhook" can answer
    // immediately or hold open — both are fine, we just want to know the
    // workflow accepted the job. Realtime carries the actual completion.
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
        console.error('n8n cover-letter webhook returned non-OK:', resp.status, await resp.text());
        webhookOk = false;
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        console.error('n8n cover-letter webhook fetch failed:', e);
        webhookOk = false;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!webhookOk) {
      await sb
        .from('cover_letters')
        .update({ status: 'failed', error_message: 'Generation service rejected the request.' })
        .eq('id', inserted.id);
      return errorResponse('Could not start cover letter generation. Please try again.', 502, corsHeaders);
    }

    return new Response(
      JSON.stringify({
        cover_letter_id: inserted.id,
        status: 'processing',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in generate-cover-letter:', error);
    return errorResponse('An error occurred. Please try again.', 500, corsHeaders);
  }
});
