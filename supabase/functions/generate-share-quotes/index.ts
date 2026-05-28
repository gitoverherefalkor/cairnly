// generate-share-quotes — summarize the "Why this role fits you" subsection
// (or "Why this might be a fit" for outside-the-box careers) into 1-3 short,
// punchy shareable quotes per career. Persists to
// `report_sections.share_quotes` (jsonb) so we only LLM-call once per report.
//
// Triggered when the share-card modal opens and any role section lacks
// share_quotes. Idempotent: sections that already have share_quotes are
// returned as-is without a new model call.
//
// Inputs:
//   { report_id: string (uuid) }
//
// Output:
//   { quotes: { [section_id: string]: string[] } }
//     One entry per top_career_1/2/3 + outside_box section. Each value is
//     an array of 1-3 short strings.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
  checkRateLimit,
} from '../_shared/cors.ts';

const ROLE_SECTION_TYPES = ['top_career_1', 'top_career_2', 'top_career_3', 'outside_box'];

const SYSTEM_PROMPT = `You write short, punchy social-share quotes for someone sharing their Cairnly career report on LinkedIn.

You'll receive a "Why this role fits you" passage from a personalized career report. Distill it into 1-3 standalone shareable lines that someone would actually want to post.

Rules:
- Each line stands on its own. No "this" / "that" / "it" referring to something the reader can't see. Self-contained.
- Each line is 60-160 characters. Tight. Punchy. Real sentences, not fragments.
- Use second person ("you") where natural. The narrator is the report, talking to / about the candidate.
- Capture the SPECIFIC insight, not a generic platitude. "You move fast when given space to think" beats "You are independent."
- No em-dashes. Use commas, colons, or sentence breaks.
- No quotation marks around the lines themselves — they're already going inside a quote treatment in the UI.
- 1-3 lines total. If the passage genuinely only supports one strong line, return one. Padding hurts.
- Output ONLY a JSON array of strings. No prose, no markdown, no explanation. Example:
  ["You get founder-level autonomy without the capital burn.", "Strategic engagement of a CoS role, none of the org politics."]`;

function stripHtml(raw: string): string {
  return (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find the content under a specific heading in a section body. Career
// bodies use <h3>/<h4>/<h5> for "Why this role fits you" etc. Returns the
// HTML between that heading and the next heading of equal-or-higher level.
function extractSubsection(body: string, headingPatterns: string[]): string | null {
  if (!body) return null;
  const patterns = headingPatterns.map((p) => p.toLowerCase().trim());
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches: { level: number; text: string; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(body)) !== null) {
    matches.push({
      level: Number(m[1]),
      text: stripHtml(m[2]).toLowerCase(),
      index: m.index,
      length: m[0].length,
    });
  }
  if (matches.length === 0) return null;
  const hitIdx = matches.findIndex((h) => patterns.some((p) => h.text.includes(p)));
  if (hitIdx === -1) return null;
  const hit = matches[hitIdx];
  const start = hit.index + hit.length;
  const next = matches.slice(hitIdx + 1).find((h) => h.level <= hit.level);
  const end = next ? next.index : body.length;
  return body.slice(start, end);
}

function patternsForSectionType(sectionType: string): string[] {
  if (sectionType === 'outside_box') {
    return ['why this might be a fit', 'why this could be a fit', 'why this role fits you'];
  }
  return ['why this role fits you', 'why this fits you', 'why this fits'];
}

interface ReportSectionRow {
  id: string;
  section_type: string;
  title: string | null;
  content: string | null;
  share_quotes: unknown;
}

async function summarizeOne(
  passage: string,
  openaiKey: string,
  language: string,
): Promise<string[]> {
  // Append a language instruction when the user prefers a non-English locale.
  // Brand terms stay English. See LOCALIZATION_PLAN.md.
  const LANG_NAMES: Record<string, string> = { nl: 'Dutch (Nederlands)', de: 'German (Deutsch)' };
  const langInstruction = language !== 'en' && LANG_NAMES[language]
    ? `\n\nWrite the quotes in ${LANG_NAMES[language]}. Brand terms (Cairnly, outside-the-box, runner-up) stay in English.`
    : '';
  const finalSystemPrompt = SYSTEM_PROMPT + langInstruction;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini-2026-03-17',
      temperature: 0.5,
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: `Distill into 1-3 share quotes:\n\n${passage}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.error('[generate-share-quotes] OpenAI error:', resp.status, errText);
    throw new Error(`OpenAI ${resp.status}`);
  }
  const json = await resp.json();
  const raw = json?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!raw) throw new Error('Empty completion');

  // Model sometimes wraps the array in an object when response_format is
  // json_object. Accept both shapes.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('[generate-share-quotes] non-JSON completion:', raw);
    throw new Error('Non-JSON completion');
  }
  let arr: unknown[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const firstArrayValue = Object.values(obj).find((v) => Array.isArray(v));
    if (Array.isArray(firstArrayValue)) arr = firstArrayValue;
  }
  const cleaned = arr
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 220)
    .slice(0, 3);
  if (cleaned.length === 0) throw new Error('No usable quotes returned');
  return cleaned;
}

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  // Generous limit — modal can request a few times if quotes are split
  // across role tabs, but this stops sustained abuse.
  const limited = checkRateLimit(req, 20, corsHeaders);
  if (limited) return limited;

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
    console.error('[generate-share-quotes] OPENAI_API_KEY not configured');
    return errorResponse('Server misconfigured', 500, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Ownership check.
  const { data: reportRow, error: reportLookupErr } = await supabase
    .from('reports')
    .select('user_id')
    .eq('id', report_id)
    .maybeSingle();
  if (reportLookupErr) {
    console.error('[generate-share-quotes] report ownership lookup failed:', reportLookupErr);
    return errorResponse('Failed to verify report access', 500, corsHeaders);
  }
  if (!reportRow || reportRow.user_id !== authUserId) {
    return errorResponse('Forbidden', 403, corsHeaders);
  }

  // Lookup preferred_language so share quotes are written in the user's
  // language. See LOCALIZATION_PLAN.md Phase 2.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', authUserId)
    .maybeSingle();
  const preferredLanguage = profileRow?.preferred_language || 'en';

  // Pull the role sections for this report.
  const { data: sections, error: secErr } = await supabase
    .from('report_sections')
    .select('id, section_type, title, content, share_quotes')
    .eq('report_id', report_id)
    .in('section_type', ROLE_SECTION_TYPES)
    .returns<ReportSectionRow[]>();
  if (secErr) {
    console.error('[generate-share-quotes] fetch sections error:', secErr);
    return errorResponse('Failed to load report sections', 500, corsHeaders);
  }

  const result: Record<string, string[]> = {};

  for (const sec of sections ?? []) {
    // Already-cached quotes — return as-is, skip the LLM.
    if (Array.isArray(sec.share_quotes) && sec.share_quotes.length > 0) {
      result[sec.id] = (sec.share_quotes as unknown[])
        .filter((s): s is string => typeof s === 'string')
        .slice(0, 3);
      continue;
    }

    const subsectionHtml = extractSubsection(sec.content || '', patternsForSectionType(sec.section_type));
    const passage = stripHtml(subsectionHtml || sec.content || '');
    if (!passage || passage.length < 60) {
      // Nothing to summarize — leave null in DB and skip.
      continue;
    }

    try {
      const quotes = await summarizeOne(passage, openaiKey, preferredLanguage);
      result[sec.id] = quotes;
      // Persist for next time.
      const { error: updateErr } = await supabase
        .from('report_sections')
        .update({ share_quotes: quotes })
        .eq('id', sec.id);
      if (updateErr) {
        console.error('[generate-share-quotes] update share_quotes failed for', sec.id, updateErr);
        // Non-fatal — still return what we generated.
      }
    } catch (e) {
      console.error('[generate-share-quotes] summarize failed for', sec.id, e);
      // Skip this section; client falls back to its current pickShareSentences.
    }
  }

  return new Response(JSON.stringify({ quotes: result }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
