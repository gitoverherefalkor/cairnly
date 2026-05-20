// wrap-up-save — persist the user-approved Discussion Highlights to
// `report_sections` so they land in the formal report. The user just
// reviewed the extracted bullets in the WrapUpCard and optionally added
// an addendum (a "anything else you want flagged?" free-text field) plus
// any specific bot responses they bookmarked during the session for
// verbatim preservation.
//
// Inputs:
//   {
//     report_id: string (uuid),
//     highlights: string,        // markdown bullets from wrap-up-extract,
//                                // possibly edited by the user
//     addendum?: string | null,  // optional free-text the user added
//     saved_responses?: Array<{  // bot replies the user bookmarked inline
//       content: string,         // markdown body of the message
//       saved_at?: string | null // ISO timestamp the bookmark was set
//     }>,
//   }
//
// Output: { ok: true }
//
// Idempotent: if a `chat_highlights` row already exists for this report,
// the new submission overwrites it. Lets users hit "Save & Close" twice
// without producing a duplicate row in the report.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  const { userId: authUserId } = authed;

  interface SavedResponseInput {
    content?: string;
    saved_at?: string | null;
  }

  let body: {
    report_id?: string;
    highlights?: string;
    addendum?: string | null;
    saved_responses?: SavedResponseInput[];
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const { report_id, highlights, addendum, saved_responses } = body;
  if (!report_id || typeof report_id !== 'string') {
    return errorResponse('report_id required', 400, corsHeaders);
  }
  if (!highlights || typeof highlights !== 'string' || highlights.trim().length === 0) {
    return errorResponse('highlights required', 400, corsHeaders);
  }

  const trimmedHighlights = highlights.trim().slice(0, 8_000);
  const trimmedAddendum =
    typeof addendum === 'string' && addendum.trim().length > 0
      ? addendum.trim().slice(0, 4_000)
      : null;

  // Sanitize the saved-responses list. Each one is a verbatim bot reply
  // the user bookmarked in-chat. Cap individual length AND total count
  // so a runaway client can't blow up the row.
  const cleanedSaved: { content: string; saved_at: string | null }[] = [];
  if (Array.isArray(saved_responses)) {
    for (const entry of saved_responses.slice(0, 50)) {
      if (!entry || typeof entry.content !== 'string') continue;
      const c = entry.content.trim();
      if (!c) continue;
      cleanedSaved.push({
        content: c.slice(0, 8_000),
        saved_at:
          typeof entry.saved_at === 'string' && entry.saved_at.trim().length > 0
            ? entry.saved_at.trim().slice(0, 64)
            : null,
      });
    }
  }

  // Compose the final markdown stored on the section row. Order:
  //   1. Auto-extracted highlights (the LLM bullets).
  //   2. "Saved Responses" subsection — verbatim bot replies the user
  //      bookmarked inline. Preserves the deep-dive recipes that the
  //      summarizer would otherwise compress to a theme.
  //   3. Addendum — the user's own typed note from the wrap-up card.
  const parts: string[] = [trimmedHighlights];
  if (cleanedSaved.length > 0) {
    parts.push('\n\n##### Saved Responses\n');
    cleanedSaved.forEach((s, i) => {
      parts.push(`\n\n**Saved response ${i + 1}**\n\n${s.content}`);
    });
  }
  if (trimmedAddendum) {
    parts.push(`\n\n##### Also flagged by you\n\n${trimmedAddendum}`);
  }
  const content = parts.join('');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Ownership check: confirm the report belongs to the authenticated user.
  const { data: reportRow, error: reportLookupErr } = await supabase
    .from('reports')
    .select('user_id')
    .eq('id', report_id)
    .maybeSingle();

  if (reportLookupErr) {
    console.error('[wrap-up-save] report ownership lookup failed:', reportLookupErr);
    return errorResponse('Failed to verify report access', 500, corsHeaders);
  }
  if (!reportRow || reportRow.user_id !== authUserId) {
    return errorResponse('Forbidden', 403, corsHeaders);
  }

  // Upsert: drop any existing chat_highlights for this report, then write
  // a fresh one. Same delete-then-insert pattern submit-chapter-feedback
  // uses; lets the user re-run wrap-up if they want to redo it.
  const { error: delErr } = await supabase
    .from('report_sections')
    .delete()
    .eq('report_id', report_id)
    .eq('section_type', 'chat_highlights');

  if (delErr) {
    console.error('[wrap-up-save] delete error:', delErr);
    return errorResponse('Failed to clear previous highlights', 500, corsHeaders);
  }

  const { error: insErr } = await supabase.from('report_sections').insert({
    report_id,
    section_type: 'chat_highlights',
    title: '<h3>Discussion Highlights</h3>',
    content,
    fb_status: true,
  });

  if (insErr) {
    console.error('[wrap-up-save] insert error:', insErr);
    return errorResponse('Failed to save highlights', 500, corsHeaders);
  }

  // Flip the report from pending_review → completed so the dashboard
  // surfaces the Career Signature / Career Map / Personality Radar and
  // ReportDisplay, instead of the "Resume Chat" card. Scoped to the
  // pending_review state so we don't accidentally overwrite a 'failed'
  // or already-'completed' status (e.g. on a second wrap-up).
  const { error: statusErr } = await supabase
    .from('reports')
    .update({ status: 'completed' })
    .eq('id', report_id)
    .eq('status', 'pending_review');

  if (statusErr) {
    // Non-fatal: highlights are saved, the user can still see them on
    // the dashboard. Log and move on rather than blocking the response.
    console.error('[wrap-up-save] status update error:', statusErr);
  }

  // Mark the chat as completed in user_engagement_tracking so the reminder
  // cron stops sending "your chat is incomplete" / "your report is ready"
  // emails. The frontend trackChatComplete() hook only fires on the legacy
  // ClosingCard path, not the WrapUpCard path used today, so without this
  // every wrap-up user gets a stale reminder 24h later. Guarded on NULL so
  // a re-run of wrap-up preserves the original completion time.
  const nowIso = new Date().toISOString();
  const { error: engagementErr } = await supabase
    .from('user_engagement_tracking')
    .update({
      chat_completed_at: nowIso,
      chat_last_activity_at: nowIso,
      chat_last_section_index: 10,
      updated_at: nowIso,
    })
    .eq('user_id', authUserId)
    .is('chat_completed_at', null);

  if (engagementErr) {
    // Non-fatal: highlights are saved. A stale reminder email is annoying
    // but the user can still use the product.
    console.error('[wrap-up-save] engagement tracking update error:', engagementErr);
  }

  // Kick off the executive summary now that the wrap-up content is in the
  // DB. This is the surefire trigger point: the chat_highlights row is
  // written and the session is closed, so the ExecSummary n8n workflow can
  // pull every section (including chat_highlights) and generate the
  // exec_summary section. Previously the exec summary was chained off an
  // n8n feedback workflow that depended on the chat agent calling a tool,
  // which the rebuilt wrap-up flow never does, so it never fired.
  //
  // Delete any prior exec_summary first so re-running wrap-up doesn't leave
  // a duplicate row. Both steps are non-fatal: highlights are already saved
  // and the report is marked complete, so on failure we log and still
  // return success, since the summary can be regenerated.
  const EXEC_SUMMARY_WEBHOOK =
    'https://falkoratlas.app.n8n.cloud/webhook/exec-summary-6508dd5f8e79419599dc8fff32fb6703';
  try {
    const { error: execDelErr } = await supabase
      .from('report_sections')
      .delete()
      .eq('report_id', report_id)
      .eq('section_type', 'exec_summary');
    if (execDelErr) {
      console.error('[wrap-up-save] exec_summary cleanup error:', execDelErr);
    }

    const execRes = await fetch(EXEC_SUMMARY_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id }),
    });
    if (!execRes.ok) {
      console.error(
        '[wrap-up-save] exec summary trigger failed:',
        execRes.status,
        await execRes.text().catch(() => ''),
      );
    }
  } catch (err) {
    console.error('[wrap-up-save] exec summary trigger threw:', err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
