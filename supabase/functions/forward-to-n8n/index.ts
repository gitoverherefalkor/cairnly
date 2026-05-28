
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, errorResponse, getAuthenticatedUser } from "../_shared/cors.ts";

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

    // Extract the payload from the request body - preserve exact order
    const surveyData = requestBody.payload || requestBody;

    if (!surveyData) {
      return errorResponse('No survey data provided', 400, corsHeaders);
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );

    // Look up the user's preferred language so n8n workflows can generate
    // language-aware report content. Defaults to 'en' if the column is null
    // or the profile row is missing. See LOCALIZATION_PLAN.md Phase 2.
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', userId)
      .maybeSingle();
    const preferredLanguage = profileRow?.preferred_language || 'en';

    // Step 1: Create a report record first
    const { data: reportData, error: reportError } = await supabase.from('reports').insert({
      user_id: userId,
      title: 'Career Assessment Report (N8N)',
      status: 'processing',
      payload: surveyData
    }).select().single();

    if (reportError) {
      console.error('Error creating report:', reportError);
      return errorResponse('Failed to create report record', 500, corsHeaders);
    }

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

    // POST to N8N webhook with retry logic for transient failures (e.g. OOM)
    const MAX_RETRIES = 1;
    const RETRY_DELAY_MS = 30_000; // 30 seconds - gives n8n time to free memory

    let resp: Response | null = null;
    let lastError = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        resp = await fetch(n8nWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(n8nData),
        });

        if (resp.ok) {
          break; // Success, exit retry loop
        }

        lastError = await resp.text();
        const isRetryable = resp.status >= 500; // Only retry on 5xx (server errors like OOM)

        if (isRetryable && attempt < MAX_RETRIES) {
          console.warn(`N8N webhook attempt ${attempt + 1} failed (${resp.status}), retrying in ${RETRY_DELAY_MS / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }

        // Non-retryable error or final attempt failed
        console.error("N8N webhook error:", resp.status, lastError);
        break;
      } catch (fetchError) {
        // Network-level error (timeout, DNS, etc.)
        lastError = String(fetchError);
        if (attempt < MAX_RETRIES) {
          console.warn(`N8N webhook attempt ${attempt + 1} network error, retrying in ${RETRY_DELAY_MS / 1000}s...`, lastError);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          continue;
        }
        console.error("N8N webhook network error after retries:", lastError);
      }
    }

    if (!resp || !resp.ok) {
      // Update report status to failed after all retries exhausted
      await supabase
        .from('reports')
        .update({ status: 'failed' })
        .eq('id', reportData.id);

      return errorResponse('Assessment processing failed. Please try again later.', 502, corsHeaders);
    }

    const result = await resp.json();

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
