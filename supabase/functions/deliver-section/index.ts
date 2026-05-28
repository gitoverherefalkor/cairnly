// deliver-section — fast path for chat section delivery.
//
// Replaces the WF5.2 Atlas Agent for the most common turn type: a clean
// "Continue to next section" advance with no preceding discussion. Pulls the
// section content from `report_sections`, renders it deterministically with
// the same boilerplate the agent uses, writes the message to
// `n8n_chat_histories` so the agent's memory stays in sync, and (optionally)
// closes feedback for the section being left behind.
//
// Inputs:
//   {
//     report_id:      string (uuid),
//     section_type:   one of approach|strengths|development|values|
//                     top_career_1|top_career_2|top_career_3|
//                     runner_ups|outside_box|dream_jobs,
//     previous_section_type?: same set — if provided, the row(s) for that
//                     section get fb_unified-equivalent text written
//                     (only when fb_status IS NOT TRUE).
//   }
//
// Output: { content: string }   — the rendered markdown shown in chat
//
// Auth: same loose pattern as other Atlas edge functions. CORS is locked
// down via _shared/cors.ts.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';
import {
  renderSection,
  buildAiChatMessage,
  buildHumanChatMessage,
  type ReportSectionRow,
} from './renderer.ts';
import type { SectionType } from './boilerplate.ts';

const VALID_SECTION_TYPES = new Set<SectionType>([
  'approach',
  'strengths',
  'development',
  'values',
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
  'dream_jobs',
]);

const CANONICAL_NO_DISCUSSION_FEEDBACK =
  'User confirmed accuracy, no changes needed.';

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  // Auth: derive userId from JWT. Body-supplied user_id is ignored — it
  // would let an attacker write chat messages under another user's account.
  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  const { userId: authUserId } = authed;

  let body: {
    report_id?: string;
    section_type?: string;
    previous_section_type?: string;
    user_message?: string;
    session_id?: string;
    user_id?: string;
    skip_history_user_write?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const {
    report_id,
    section_type,
    previous_section_type,
    user_message,
    session_id,
    skip_history_user_write,
  } = body;
  // Body user_id is intentionally NOT destructured — we use authUserId only.
  const user_id = authUserId;

  if (!report_id || typeof report_id !== 'string') {
    return errorResponse('report_id required', 400, corsHeaders);
  }
  if (!section_type || !VALID_SECTION_TYPES.has(section_type as SectionType)) {
    return errorResponse(
      `Invalid section_type. Must be one of: ${[...VALID_SECTION_TYPES].join(', ')}`,
      400,
      corsHeaders,
    );
  }
  if (
    previous_section_type !== undefined &&
    !VALID_SECTION_TYPES.has(previous_section_type as SectionType)
  ) {
    return errorResponse(
      'Invalid previous_section_type',
      400,
      corsHeaders,
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Ownership check: confirm the report belongs to the authenticated user.
  // Service role bypasses RLS, so we must enforce ownership in app code.
  const { data: reportRow, error: reportLookupErr } = await supabase
    .from('reports')
    .select('user_id')
    .eq('id', report_id)
    .maybeSingle();

  if (reportLookupErr) {
    console.error('[deliver-section] report ownership lookup failed:', reportLookupErr);
    return errorResponse('Failed to verify report access', 500, corsHeaders);
  }
  if (!reportRow || reportRow.user_id !== authUserId) {
    return errorResponse('Forbidden', 403, corsHeaders);
  }

  // Look up the user's preferred_language so the renderer can pick the right
  // boilerplate map. Defaults to 'en' if the column is null or the row missing.
  // See LOCALIZATION_PLAN.md Phase 2.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', authUserId)
    .maybeSingle();
  const preferredLanguage = profileRow?.preferred_language || 'en';

  // 1. Fetch the section row(s) we need to render.
  const { data: rows, error: fetchErr } = await supabase
    .from('report_sections')
    .select(
      'section_type, order_number, title, alternate_titles, company_size_type, content, score',
    )
    .eq('report_id', report_id)
    .eq('section_type', section_type)
    .order('order_number', { ascending: true });

  if (fetchErr) {
    console.error('[deliver-section] fetch error:', fetchErr);
    return errorResponse('Failed to load section content', 500, corsHeaders);
  }
  if (!rows || rows.length === 0) {
    return errorResponse(
      `No content found for section_type=${section_type}`,
      404,
      corsHeaders,
    );
  }

  // 2. Render to markdown.
  let rendered: string;
  try {
    rendered = renderSection(
      section_type as SectionType,
      rows as ReportSectionRow[],
      preferredLanguage,
    );
  } catch (e) {
    console.error('[deliver-section] render error:', e);
    return errorResponse('Failed to render section', 500, corsHeaders);
  }

  // 3a. Write user + AI messages to n8n_chat_histories (agent memory).
  //     session_id here = bare report_id (what the agent's Postgres memory
  //     node uses). When the agent is handling this advance in parallel
  //     (post-discussion case), it'll write the user msg itself via
  //     langchain — skip our write to avoid a duplicate.
  const histRows: Array<{ session_id: string; message: unknown }> = [];
  if (user_message && typeof user_message === 'string' && !skip_history_user_write) {
    histRows.push({
      session_id: report_id,
      message: buildHumanChatMessage(user_message),
    });
  }
  histRows.push({
    session_id: report_id,
    message: buildAiChatMessage(rendered),
  });

  const { error: writeErr } = await supabase
    .from('n8n_chat_histories')
    .insert(histRows);

  if (writeErr) {
    console.error('[deliver-section] history write failed:', writeErr);
  }

  // 3b. Write user + AI messages to chat_messages (UI persistence).
  //     This is the table the frontend reads on page load. Server-side
  //     write here makes persistence atomic with the API response — if
  //     the user refreshes mid-flight, they still see the bot delivery
  //     after reload. session_id and user_id required for the row.
  if (session_id && user_id) {
    const chatRows: Array<{
      session_id: string;
      report_id: string;
      user_id: string;
      sender: 'user' | 'bot';
      content: string;
    }> = [];
    if (user_message && typeof user_message === 'string') {
      chatRows.push({
        session_id,
        report_id,
        user_id,
        sender: 'user',
        content: user_message,
      });
    }
    chatRows.push({
      session_id,
      report_id,
      user_id,
      sender: 'bot',
      content: rendered,
    });

    const { error: chatWriteErr } = await supabase.from('chat_messages').insert(chatRows);
    if (chatWriteErr) {
      console.error('[deliver-section] chat_messages write failed:', chatWriteErr);
    }
  }

  // 4. Close feedback for the section being left behind, if any.
  //    Equivalent to fb_unified writing the canonical "no discussion"
  //    string. Skip rows where the agent has already written real
  //    feedback (fb_status = true). Match NULL or FALSE explicitly:
  //    `.neq('fb_status', true)` does NOT match NULL rows because
  //    Postgres NULL comparisons always return NULL (falsy), so the
  //    initial NULL state would be silently skipped.
  if (previous_section_type) {
    const { error: fbErr } = await supabase
      .from('report_sections')
      .update({
        feedback: CANONICAL_NO_DISCUSSION_FEEDBACK,
        fb_status: true,
      })
      .eq('report_id', report_id)
      .eq('section_type', previous_section_type)
      .or('fb_status.is.null,fb_status.eq.false');

    if (fbErr) {
      // Same policy: log, don't fail the request.
      console.error('[deliver-section] fb_unified write failed:', fbErr);
    }
  }

  return new Response(JSON.stringify({ content: rendered }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
