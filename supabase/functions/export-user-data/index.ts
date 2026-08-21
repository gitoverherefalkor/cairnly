import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreFlight, errorResponse } from "../_shared/cors.ts";

// Exports ALL user data as JSON (GDPR Art. 20 - Right to Data Portability)

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Authorization required', 401, corsHeaders);
    }

    // Verify user identity via their JWT
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return errorResponse('Invalid authentication', 401, corsHeaders);
    }

    const userId = user.id;

    // Use service role to read all data
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all user data in parallel
    const [
      profileResult,
      reportsResult,
      reportSectionsResult,
      chatResult,
      engagementResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('reports').select('*').eq('user_id', userId),
      // Get report sections via report IDs
      supabase.from('reports').select('id').eq('user_id', userId),
      supabase.from('chat_messages').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('user_engagement_tracking').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    // Fetch report sections separately (need report IDs first)
    let reportSections: any[] = [];
    const reportIds = reportSectionsResult.data?.map(r => r.id) || [];
    if (reportIds.length > 0) {
      const { data } = await supabase
        .from('report_sections')
        .select('*')
        .in('report_id', reportIds)
        .order('order_number');
      reportSections = data || [];
    }

    // Strip internal system fields that aren't the user's data
    const cleanProfile = profileResult.data ? {
      email: profileResult.data.email,
      first_name: profileResult.data.first_name,
      last_name: profileResult.data.last_name,
      pronouns: profileResult.data.pronouns,
      age_range: profileResult.data.age_range,
      country: profileResult.data.country,
      region: profileResult.data.region,
      resume_parsed_data: profileResult.data.resume_parsed_data,
      created_at: profileResult.data.created_at,
      updated_at: profileResult.data.updated_at,
    } : null;

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: cleanProfile,
      career_reports: (reportsResult.data || []).map(r => ({
        title: r.title,
        status: r.status,
        payload: r.payload,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
      report_sections: reportSections.map(s => ({
        report_id: s.report_id,
        section_type: s.section_type,
        title: s.title,
        content: s.content,
        // Stored translations of the canonical English content, when any —
        // the user may have read the report in another language, so the
        // export carries both (GDPR completeness).
        content_i18n: s.content_i18n ?? {},
        order_number: s.order_number,
      })),
      chat_messages: (chatResult.data || []).map(m => ({
        sender: m.sender,
        content: m.content,
        created_at: m.created_at,
      })),
      engagement: engagementResult.data ? {
        survey_started_at: engagementResult.data.survey_started_at,
        survey_completed_at: engagementResult.data.survey_completed_at,
        chat_started_at: engagementResult.data.chat_started_at,
        chat_completed_at: engagementResult.data.chat_completed_at,
      } : null,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cairnly-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error) {
    console.error('[export-user-data] Error:', error);
    return errorResponse('An error occurred while exporting your data. Please try again.', 500, corsHeaders);
  }
});
