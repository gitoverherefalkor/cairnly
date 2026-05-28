// wrap-up-extract — distill the chat conversation into 4-8 highlight
// bullets so the nuance from discussion (specific strategies, pivots,
// course corrections the user resonated with) survives into the final
// report instead of being trapped in a transcript no one re-reads.
//
// Triggered when the user clicks "All done, wrap up session" in the chat.
// Returns the highlights as markdown for the WrapUpCard to display. The
// user reviews, optionally adds an addendum, then commits via the sibling
// `wrap-up-save` function.
//
// Inputs:
//   {
//     report_id: string (uuid),
//   }
//
// Output: { highlights: string }   — markdown bullet list

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';

// Strips markdown headings, html tags, separators — leaves only the
// text the user/agent actually said. Keeps the prompt compact.
function stripFormatting(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^---\s*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SYSTEM_PROMPT = `You distill a career-coaching chat conversation into a tight set of "Discussion Highlights" that will be added to the user's formal report. The verbatim chat is NOT preserved — these highlights are the only memory of the discussion that survives.

Your job: surface the specific tactical advice and concrete strategies the formal report would otherwise lose. NOT high-level themes. NOT polite summaries. Specific recipes the coach proposed.

Rules:
- Return 0-9 bullets. NO floor. If there were only two genuine moments worth preserving, return two. If there were none, return a single line: "_(No substantive discussion to highlight beyond the report sections themselves.)_". Padding the list to look thorough is worse than honesty.
- Each bullet starts with a bold lead phrase, then a clarifying sentence. Markdown format: "- **Lead phrase.** Clarifying sentence."
- Lead phrases name the specific recipe or strategy, not the topic. Examples:
  - GOOD: "Substack-and-corporate-IP hybrid for the writing pivot." (names the actual approach)
  - BAD: "Hybrid writing strategies." (generic)
  - GOOD: "Toggl-style fractional CPO model as the bridge."
  - BAD: "Career path options."
- The clarifying sentence should preserve the concrete numbers, names, mechanics, or sequencing the coach gave (€-ranges, specific cohort sizes, named playbooks, "first do X then Y" steps). If the coach gave a multi-step recipe, summarise the steps in one sentence rather than collapsing them into a theme.
- Skip small talk, navigation messages ("ready to continue?"), and content that just restates the report.
- Skip anything the user explicitly pushed back on or rejected.
- Use second person ("you"). No em-dashes; use commas, colons, or parentheses.
- Output ONLY the bullet list (or the no-substance fallback line). No intro, no outro, no headings.`;

interface ChatMessageRow {
  sender: 'user' | 'bot';
  content: string;
  created_at: string;
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
  const { userId: authUserId } = authed;

  let body: { report_id?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const { report_id } = body;
  if (!report_id || typeof report_id !== 'string') {
    return errorResponse('report_id required', 400, corsHeaders);
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.error('[wrap-up-extract] OPENAI_API_KEY not configured');
    return errorResponse('Server misconfigured', 500, corsHeaders);
  }

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
    console.error('[wrap-up-extract] report ownership lookup failed:', reportLookupErr);
    return errorResponse('Failed to verify report access', 500, corsHeaders);
  }
  if (!reportRow || reportRow.user_id !== authUserId) {
    return errorResponse('Forbidden', 403, corsHeaders);
  }

  // Lookup preferred_language so the highlights are written in the user's
  // language. See LOCALIZATION_PLAN.md Phase 2.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', authUserId)
    .maybeSingle();
  const preferredLanguage = profileRow?.preferred_language || 'en';

  // Pull the full chat for this report. Order ascending so the LLM sees
  // the natural conversational flow.
  const { data: messages, error: msgErr } = await supabase
    .from('chat_messages')
    .select('sender, content, created_at')
    .eq('report_id', report_id)
    .order('created_at', { ascending: true })
    .returns<ChatMessageRow[]>();

  if (msgErr) {
    console.error('[wrap-up-extract] fetch chat_messages error:', msgErr);
    return errorResponse('Failed to load chat history', 500, corsHeaders);
  }
  if (!messages || messages.length === 0) {
    return errorResponse('No chat messages found for this report', 404, corsHeaders);
  }

  // Pre-flight: was there enough USER discussion to warrant an LLM call?
  // The threshold filters two specific things:
  //   1. Quick-reply clicks ("Looks good, let's continue to the next
  //      section.") — short, formulaic, no real signal.
  //   2. Sessions where the user advanced through every section without
  //      typing anything substantive — the LLM would otherwise pad to
  //      reach a target and end up paraphrasing the report itself.
  // We sum the *non-formulaic* user message length. Anything below
  // ~200 chars total skips the model and writes a placeholder so the
  // report still gets a chat_highlights row (avoids special-casing
  // downstream).
  const QUICK_REPLY_PATTERNS = [
    /looks good,?\s*let'?s continue/i,
    /looks good,?\s*i'?m all done/i,
    /^i'?d like to explore this section a bit more$/i,
    /^let'?s wrap up/i,
  ];
  let userSubstantiveChars = 0;
  for (const m of messages) {
    if (m.sender !== 'user') continue;
    const text = stripFormatting(m.content);
    if (QUICK_REPLY_PATTERNS.some((re) => re.test(text))) continue;
    userSubstantiveChars += text.length;
  }
  const SUBSTANCE_THRESHOLD = 200;
  if (userSubstantiveChars < SUBSTANCE_THRESHOLD) {
    return new Response(
      JSON.stringify({
        highlights:
          '_(No substantive discussion to highlight beyond the report sections themselves.)_',
        skipped_llm: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Format the transcript compactly. Cap at ~80k chars (well under any
  // reasonable token ceiling). For exceptionally long sessions we drop
  // the oldest messages first — section delivery boilerplate adds up
  // quickly and the recent discussion is where the gold is anyway.
  const transcriptParts: string[] = [];
  for (const m of messages) {
    const role = m.sender === 'user' ? 'USER' : 'COACH';
    transcriptParts.push(`${role}: ${stripFormatting(m.content)}`);
  }
  let transcript = transcriptParts.join('\n\n');
  const MAX_CHARS = 80_000;
  if (transcript.length > MAX_CHARS) {
    transcript = transcript.slice(transcript.length - MAX_CHARS);
  }

  // Append a language instruction when the user prefers a non-English locale.
  // Brand terms stay English per glossary. See LOCALIZATION_PLAN.md.
  const LANG_NAMES: Record<string, string> = { nl: 'Dutch (Nederlands)', de: 'German (Deutsch)' };
  const langInstruction = preferredLanguage !== 'en' && LANG_NAMES[preferredLanguage]
    ? `\n\nWrite your final output in ${LANG_NAMES[preferredLanguage]}. Maintain Markdown structure. Brand terms (Cairnly, outside-the-box, runner-up) stay in English.`
    : '';
  const finalSystemPrompt = SYSTEM_PROMPT + langInstruction;

  const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini-2026-03-17',
      temperature: 0.4,
      messages: [
        { role: 'system', content: finalSystemPrompt },
        {
          role: 'user',
          content: `Distill this conversation into Discussion Highlights:\n\n${transcript}`,
        },
      ],
    }),
  });

  if (!openaiResp.ok) {
    const errText = await openaiResp.text();
    console.error('[wrap-up-extract] OpenAI error:', openaiResp.status, errText);
    return errorResponse('Failed to generate highlights', 502, corsHeaders);
  }

  const json = await openaiResp.json();
  const highlights = json?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!highlights) {
    return errorResponse('Empty highlights returned', 502, corsHeaders);
  }

  return new Response(JSON.stringify({ highlights }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
