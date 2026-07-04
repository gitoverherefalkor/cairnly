// Résumé Strengthen kickoff + apply.
//
// action=analyze: stamps strength_review={status:'pending'} on the row and
//   fires WF10 (mode=analyze). WF10's LLM finds red-flag issues and writes
//   the finished review back. Frontend picks it up via the existing
//   custom_resumes Realtime subscription (the column rides along on the row).
//
// action=apply: ALL deterministic work happens here, synchronously —
//   one-tap patches, skip persistence, score math (see strength.ts, tested).
//   Only when accepted items need composed lines (needs_input) do we fire
//   WF10 (mode=compose) for the single batched LLM call; the row goes to
//   status:'applying' until WF10 writes the final lines.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
  checkRateLimit,
} from '../_shared/cors.ts';
import { parseRequest } from './request.ts';
import { applyDecisions, reviewInFlight, type StrengthReview } from './strength.ts';

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const rateLimitResponse = checkRateLimit(req, 20, corsHeaders, 60_000);
    if (rateLimitResponse) return rateLimitResponse;

    const authed = await getAuthenticatedUser(req, corsHeaders);
    if (authed instanceof Response) return authed;
    const { userId } = authed;

    const parsed = parseRequest(await req.json());
    if (!parsed.ok) return errorResponse(parsed.error, 400, corsHeaders);
    const request = parsed.value;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
      return errorResponse('Server misconfigured', 500, corsHeaders);
    }
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Ownership + state check. JWT proves a user; the row must be theirs.
    const { data: row, error: rowError } = await sb
      .from('custom_resumes')
      .select('id, user_id, status, resume_json, career_title, keyword_coverage, strength_review, updated_at')
      .eq('id', request.custom_resume_id)
      .maybeSingle();
    if (rowError || !row) return errorResponse('Résumé not found', 404, corsHeaders);
    if (row.user_id !== userId) return errorResponse('Not your résumé', 403, corsHeaders);
    if (row.status !== 'completed') return errorResponse('Résumé is not ready yet', 409, corsHeaders);

    const webhookUrl = Deno.env.get('N8N_STRENGTHEN_WEBHOOK_URL');
    const sharedSecret = Deno.env.get('N8N_SHARED_SECRET');

    const fireWebhook = async (payload: Record<string, unknown>): Promise<boolean> => {
      if (!webhookUrl) {
        console.error('N8N_STRENGTHEN_WEBHOOK_URL not set');
        return false;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sharedSecret ? { 'x-shared-secret': sharedSecret } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        return resp.ok || resp.status === 202;
      } catch (e) {
        return (e as Error)?.name === 'AbortError';
      } finally {
        clearTimeout(timeout);
      }
    };

    const { data: profileForLang } = await sb
      .from('profiles')
      .select('preferred_language')
      .eq('id', userId)
      .maybeSingle();
    const preferred_language = profileForLang?.preferred_language || 'en';

    if (request.action === 'analyze') {
      // A stale pending/applying (WF10 died mid-run) no longer blocks: the new
      // analyze simply proceeds and overwrites the wedged state.
      const previous = row.strength_review as StrengthReview | null;
      if (reviewInFlight(previous, Date.now())) {
        return errorResponse('Analysis already in progress', 409, corsHeaders);
      }
      const nowIso = new Date().toISOString();
      await sb.from('custom_resumes')
        .update({ strength_review: { status: 'pending', generated_at: nowIso, status_changed_at: nowIso } })
        .eq('id', row.id);

      const ok = await fireWebhook({
        mode: 'analyze',
        custom_resume_id: row.id,
        resume_json: row.resume_json,
        career_title: row.career_title,
        keyword_coverage: row.keyword_coverage,
        preferred_language,
      });
      if (!ok) {
        // Don't clobber a perfectly good previous review with a dead-end
        // 'failed' state — restore it (flagged) so the user keeps their cards.
        const fallback = previous?.status === 'ready'
          ? { ...previous, error: 'Analysis failed. Try again.' }
          : { status: 'failed', error: 'Analysis service unavailable.' };
        await sb.from('custom_resumes')
          .update({ strength_review: fallback })
          .eq('id', row.id);
        return errorResponse('Could not start analysis. Please try again.', 502, corsHeaders);
      }
      return new Response(JSON.stringify({ status: 'pending' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // action === 'apply'
    const review = row.strength_review as StrengthReview | null;
    if (!review || (review.status !== 'ready' && review.status !== 'applying')) {
      // null, pending, failed (or garbage) — nothing applicable here.
      return errorResponse('No review ready to apply', 409, corsHeaders);
    }
    if (review.status === 'applying') {
      if (reviewInFlight(review, Date.now())) {
        return errorResponse('Changes still being applied', 409, corsHeaders);
      }
      // Stale 'applying': WF10 died mid-compose. The deterministic progress
      // was persisted before the webhook fired, so self-heal to 'ready' and
      // let this apply proceed over the recovered state.
      review.status = 'ready';
      review.error = 'Some changes needed another try.';
    }

    let result;
    try {
      result = applyDecisions(row.resume_json, review, request.decisions);
    } catch (e) {
      return errorResponse((e as Error).message, 400, corsHeaders);
    }

    if (result.composeItems.length === 0) {
      // Fully deterministic apply — synchronous, no LLM, done right now.
      // Optimistic concurrency: only write if the row hasn't changed since we
      // read it (another tab's apply, or WF10 finishing, bumps updated_at).
      const { data: updRows, error: updError } = await sb.from('custom_resumes')
        .update({
          resume_json: result.patchedResume,
          strength_review: result.review,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('updated_at', row.updated_at)
        .select('id');
      if (updError) {
        console.error('apply update failed:', updError);
        return errorResponse('Could not save changes. Please try again.', 500, corsHeaders);
      }
      if (!updRows || updRows.length === 0) {
        return errorResponse('Résumé changed in another tab. Reload and try again.', 409, corsHeaders);
      }
      return new Response(JSON.stringify({ status: 'ready', score: result.review.score }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Persist deterministic progress FIRST so a compose failure never loses
    // the user's one-tap accepts/skips; then hand the LLM part to WF10.
    const applyingReview: StrengthReview = {
      ...result.review,
      status: 'applying',
      status_changed_at: new Date().toISOString(),
    };
    const { data: stageRows, error: stageError } = await sb.from('custom_resumes')
      .update({
        resume_json: result.patchedResume,
        strength_review: applyingReview,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('updated_at', row.updated_at)
      .select('id');
    if (stageError) {
      console.error('staging update failed:', stageError);
      return errorResponse('Could not save changes. Please try again.', 500, corsHeaders);
    }
    if (!stageRows || stageRows.length === 0) {
      return errorResponse('Résumé changed in another tab. Reload and try again.', 409, corsHeaders);
    }

    const ok = await fireWebhook({
      mode: 'compose',
      custom_resume_id: row.id,
      resume_json: result.patchedResume,
      items: result.composeItems,
      final_score: result.finalScoreAfterCompose,
      // Compose in the language the analysis was written in, not the user's
      // current setting — cards and composed lines must match.
      preferred_language: review.language || preferred_language,
    });
    if (!ok) {
      await sb.from('custom_resumes')
        .update({ strength_review: { ...applyingReview, status: 'ready', error: 'Some changes need another try.' } })
        .eq('id', row.id);
      return errorResponse('Saved your quick fixes, but composing new lines failed. Try again.', 502, corsHeaders);
    }

    return new Response(JSON.stringify({ status: 'applying', score: result.review.score }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in resume-strengthen:', error);
    return errorResponse('An error occurred. Please try again.', 500, corsHeaders);
  }
});
