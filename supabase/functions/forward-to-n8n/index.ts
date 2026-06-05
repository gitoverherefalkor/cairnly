
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, errorResponse, getAuthenticatedUser } from "../_shared/cors.ts";
import { deliverToN8n } from "./n8n-delivery.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Authenticate the caller. user_id is derived from the JWT — never from
    // the request body — to prevent attackers from creating reports under
    // another user's account.
    const authed = await getAuthenticatedUser(req, corsHeaders);
    if (authed instanceof Response) return authed;
    const { userId } = authed;

    // Get the request body
    const requestBody = await req.json();

    // Optional retry path: the dashboard can ask us to re-run generation for an
    // existing report that previously failed, instead of submitting fresh answers.
    const retryReportId =
      typeof requestBody.retry_report_id === 'string' ? requestBody.retry_report_id : null;

    // Initialize Supabase client (service role)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );

    // surveyData and reportData are resolved differently for a fresh submit vs a retry.
    let surveyData: unknown;
    let reportData: { id: string };

    if (retryReportId) {
      // Retry: reuse the caller's existing report row and its stored answers.
      // Ownership check is mandatory — JWT auth alone only proves SOME user is
      // logged in (see _shared/cors.ts). Never act on a report_id from the body
      // without confirming it belongs to this user.
      const { data: existing, error: fetchErr } = await supabase
        .from('reports')
        .select('id, user_id, payload')
        .eq('id', retryReportId)
        .maybeSingle();

      if (fetchErr) {
        console.error('Error loading report for retry:', fetchErr);
        return errorResponse('Failed to load report', 500, corsHeaders);
      }
      if (!existing || existing.user_id !== userId) {
        // Don't reveal whether the id exists — same response for missing/not-owned.
        return errorResponse('Report not found', 404, corsHeaders);
      }
      if (!existing.payload) {
        return errorResponse('No saved answers to retry', 400, corsHeaders);
      }

      surveyData = existing.payload;

      // Flip the same row back to processing so the UI stops showing the failed
      // state and starts polling again. No new row — avoids stale/duplicate reports.
      const { data: updated, error: updateErr } = await supabase
        .from('reports')
        .update({ status: 'processing' })
        .eq('id', retryReportId)
        .select()
        .single();

      if (updateErr || !updated) {
        console.error('Error resetting report for retry:', updateErr);
        return errorResponse('Failed to restart report', 500, corsHeaders);
      }
      reportData = updated;
    } else {
      // Fresh submit: the payload comes from the request body.
      surveyData = requestBody.payload || requestBody;

      if (!surveyData) {
        return errorResponse('No survey data provided', 400, corsHeaders);
      }

      const { data: created, error: reportError } = await supabase.from('reports').insert({
        user_id: userId,
        title: 'Career Assessment Report (N8N)',
        status: 'processing',
        payload: surveyData
      }).select().single();

      if (reportError || !created) {
        console.error('Error creating report:', reportError);
        return errorResponse('Failed to create report record', 500, corsHeaders);
      }
      reportData = created;
    }

    // Look up the user's preferred language so n8n workflows can generate
    // language-aware report content. Defaults to 'en' if the column is null
    // or the profile row is missing. See LOCALIZATION_PLAN.md Phase 2.
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', userId)
      .maybeSingle();
    const preferredLanguage = profileRow?.preferred_language || 'en';

    // Step 2: Build the N8N request body
    const n8nData = {
      user_id: userId,
      report_id: reportData.id,
      preferred_language: preferredLanguage,
      survey_responses: surveyData,
      created_at: new Date().toISOString(),
      processing_status: 'started'
    };

    // Get N8N webhook URL from environment and validate it
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");

    if (!n8nWebhookUrl) {
      console.error('N8N_WEBHOOK_URL environment variable not set');

      // Update report status to failed
      await supabase
        .from('reports')
        .update({ status: 'failed' })
        .eq('id', reportData.id);

      return errorResponse('Assessment processing is temporarily unavailable. Please try again later.', 500, corsHeaders);
    }

    // Validate webhook URL at runtime
    try {
      const parsed = new URL(n8nWebhookUrl);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      console.error('N8N_WEBHOOK_URL is not a valid URL:', n8nWebhookUrl);
      await supabase
        .from('reports')
        .update({ status: 'failed' })
        .eq('id', reportData.id);
      return errorResponse('Assessment processing is temporarily unavailable.', 500, corsHeaders);
    }

    // POST to the N8N webhook. The webhook responds immediately (onReceived
    // mode), so this is a fast hand-off; n8n does the heavy AI work async and
    // writes results back to the report row.
    //
    // We retry on ANY failure — non-2xx (including a 404 "webhook not
    // registered"), network error, or timeout — because that 404 is exactly
    // what n8n.cloud returns for a few seconds while a sleeping/restarting
    // instance brings its webhooks back up. Each attempt has its own timeout so
    // a hung instance can't block the request. See n8n-delivery.ts.
    const delivery = await deliverToN8n(n8nWebhookUrl, n8nData, {
      log: (msg) => console.warn(`[forward-to-n8n] report ${reportData.id}: ${msg}`),
    });

    if (!delivery.ok) {
      // All retries exhausted — mark the report failed so the UI stops polling.
      // The survey responses remain saved in reports.payload, so the user can
      // safely re-submit once n8n is healthy again.
      console.error(
        `[forward-to-n8n] giving up on report ${reportData.id} after ${delivery.attemptsMade} attempt(s). ` +
        `Last status: ${delivery.status}, body: ${delivery.body.slice(0, 300)}`,
      );

      await supabase
        .from('reports')
        .update({ status: 'failed' })
        .eq('id', reportData.id);

      return errorResponse('Assessment processing failed. Please try again later.', 502, corsHeaders);
    }

    return new Response(JSON.stringify({
      success: true,
      report_id: reportData.id,
      message: 'Assessment submitted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in forward-to-n8n function:', error);
    return errorResponse('An error occurred submitting your assessment. Please try again.', 500, corsHeaders);
  }
});
