import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

// Returns the access code claimed by the calling user, identified from their
// JWT. Lets the Dashboard and Assessment page recover a logged-in user's
// assessment with no localStorage — e.g. a fresh browser or incognito.
serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );

    // Identify the caller from their JWT (gateway verify_jwt is off; we
    // validate the token here so an anon/publishable key simply yields no user).
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ found: false });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ found: false });

    // All access codes claimed by this user, newest first.
    const { data: codes } = await supabase
      .from('access_codes')
      .select('id, code, survey_type, max_usage, usage_count, is_active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!codes || codes.length === 0) return json({ found: false });

    // Which of those codes have an in-progress (draft) survey? We must prefer a
    // code that holds the user's unfinished assessment, otherwise a user with
    // more than one code (e.g. a second purchase, a comp code on top of a paid
    // one, a re-issue) would be handed the NEWEST code — which may be empty —
    // and the dashboard would show "Start" as if their progress vanished.
    const codeIds = codes.map((c) => c.id);
    const { data: drafts } = await supabase
      .from('answers')
      .select('access_code_id')
      .in('access_code_id', codeIds)
      .eq('status', 'draft');
    const draftCodeIds = new Set((drafts ?? []).map((d) => d.access_code_id));

    // Preference order: newest code with a draft → newest active code → newest.
    // (`codes` is already sorted newest-first, so `.find` yields the newest match.)
    const chosen =
      codes.find((c) => draftCodeIds.has(c.id)) ??
      codes.find((c) => c.is_active !== false) ??
      codes[0];

    return json({
      found: true,
      accessCode: {
        id: chosen.id,
        code: chosen.code,
        survey_type: chosen.survey_type,
        remaining_uses: chosen.max_usage - chosen.usage_count,
      },
    });
  } catch (error) {
    console.error('Error in get-my-access-code:', error);
    return json({ found: false, error: 'Lookup failed' }, 500);
  }
});
