// save-chat-response — persist a coach response the user clicked "Save" on.
//
// Snapshots the response into `saved_chat_responses`, tagged with the report
// section in focus, and generates a short label (gpt-5.4-nano) for the
// collapsed card shown in the dashboard report.
//
// Input:  { report_id: string, content: string, section_type?: string|null }
// Output: { success: true, saved?: {...}, alreadySaved?: true }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You write an ultra-short label for a saved career-coaching message. The label sits on a collapsed card the user expands later, so it must name the concrete topic at a glance. Return 2-3 words, Title Case, no punctuation, no quotes (e.g. "Salary Negotiation", "Portfolio Pivot", "Networking Plan"). Output ONLY the label.`;

function stripFormatting(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Fallback when the LLM call fails — first few words of the content.
function fallbackLabel(text: string): string {
  const words = stripFormatting(text).split(/\s+/).filter(Boolean).slice(0, 3);
  return words.join(' ') || 'Saved Note';
}

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  const { userId } = authed;

  let body: { report_id?: string; content?: string; section_type?: string | null };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const { report_id, content, section_type } = body;
  if (!report_id || typeof report_id !== 'string') {
    return errorResponse('report_id required', 400, corsHeaders);
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return errorResponse('content required', 400, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Ownership: the report must belong to the caller.
  const { data: reportRow, error: reportErr } = await supabase
    .from('reports')
    .select('user_id')
    .eq('id', report_id)
    .maybeSingle();
  if (reportErr) {
    console.error('[save-chat-response] report lookup failed:', reportErr);
    return errorResponse('Failed to verify report access', 500, corsHeaders);
  }
  if (!reportRow || reportRow.user_id !== userId) {
    return errorResponse('Forbidden', 403, corsHeaders);
  }

  // Generate a short label with gpt-5.4-nano. Non-fatal: on any failure we
  // fall back to the first few words so the save still succeeds.
  let label = fallbackLabel(content);
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (openaiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.4-nano',
          temperature: 0.3,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Label this saved coach message:\n\n${stripFormatting(content).slice(0, 4000)}`,
            },
          ],
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        const raw = json?.choices?.[0]?.message?.content?.trim();
        if (raw) {
          // Keep it tight: strip quotes/punctuation, cap at 5 words.
          label = raw.replace(/["'.]/g, '').split(/\s+/).filter(Boolean).slice(0, 5).join(' ') || label;
        }
      } else {
        console.error('[save-chat-response] OpenAI error:', resp.status, await resp.text());
      }
    } catch (e) {
      console.error('[save-chat-response] label generation failed:', e);
    }
  }

  // Insert. The (report_id, content_hash) unique constraint makes a repeat
  // save idempotent — a duplicate is treated as success.
  const { data: row, error: insertErr } = await supabase
    .from('saved_chat_responses')
    .insert({
      report_id,
      user_id: userId,
      section_type: section_type ?? null,
      label,
      content,
    })
    .select('id, label, section_type')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return new Response(
        JSON.stringify({ success: true, alreadySaved: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    console.error('[save-chat-response] insert failed:', insertErr);
    return errorResponse('Could not save this response.', 500, corsHeaders);
  }

  return new Response(
    JSON.stringify({ success: true, saved: row }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
