import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, errorResponse, getAuthenticatedUser } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Derive user_id from JWT. Body user_id is ignored — would let an
    // attacker overwrite another user's parsed-resume profile.
    const authed = await getAuthenticatedUser(req, corsHeaders);
    if (authed instanceof Response) return authed;
    const { userId: user_id } = authed;

    const { file_url } = await req.json();

    if (!file_url || typeof file_url !== 'string') {
      return errorResponse('file_url is required', 400, corsHeaders);
    }

    // Verify the file_url points into this user's storage prefix. The frontend
    // uploads to `<user_id>/<filename>` in the resumes bucket, so the URL path
    // must contain `/${user_id}/`. Blocks an attacker from sending a victim's
    // file_url through n8n.
    if (!file_url.includes(`/${user_id}/`)) {
      console.error('[forward-resume-to-n8n] file_url does not match authenticated user prefix', { user_id });
      return errorResponse('file_url does not belong to authenticated user', 403, corsHeaders);
    }

    // Look up the user's preferred language so n8n's resume-parsing prompt
    // can handle Dutch CV conventions (dd-mm-yyyy dates, "Heden", section
    // headers). See LOCALIZATION_PLAN.md Phase 2.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', user_id)
      .maybeSingle();
    const preferred_language = profileRow?.preferred_language || 'en';

    const n8nWebhookUrl = Deno.env.get("N8N_RESUME_WEBHOOK_URL");
    if (!n8nWebhookUrl) {
      console.error('N8N_RESUME_WEBHOOK_URL not set');
      return errorResponse('Resume processing is temporarily unavailable.', 500, corsHeaders);
    }

    // POST to n8n with 60-second timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let resp: Response;
    try {
      resp = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url, user_id, preferred_language }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error('n8n webhook timed out after 60s');
        return errorResponse('Resume processing timed out. Please try again.', 504, corsHeaders);
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('n8n webhook error:', resp.status, errText);
      return errorResponse('Resume processing failed. Please try again.', 502, corsHeaders);
    }

    const result = await resp.json();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in forward-resume-to-n8n:', error);
    return errorResponse('An error occurred processing your resume. Please try again.', 500, corsHeaders);
  }
});
