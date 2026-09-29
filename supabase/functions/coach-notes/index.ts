// coach-notes — keep a short "advisor's notes" summary per report so the
// post-report coach (WF5C) remembers a user's conversations after the raw
// transcript is purged. Spec: docs/superpowers/specs/
// 2026-09-15-jobs-cap-chat-continuation-dismiss-design.md (decision P).
//
// Different from chat_highlights (wrap-up-extract): highlights are the
// user-facing tactical takeaways in the report; notes are the coach's own
// memory of the person (worries, leanings, decisions, open questions).
//
// POST, x-shared-secret = N8N_SHARED_SECRET (pg_cron / n8n / manual).
//   { report_id }              → (re)write notes for one report
//   { backfill: true, limit? } → every report whose chat transcript still
//                                exists and whose notes are missing or older
//                                than the last chat message. Time-boxed.
//
// Notes are written in English (machine-side data, per the language
// contract); the coach replies in the user's language regardless.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { verifySharedSecret } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const MODEL = 'gpt-5.4-mini-2026-03-17';
const MAX_TRANSCRIPT_CHARS = 80_000;
const SUBSTANCE_THRESHOLD = 200;
// Stop picking up new reports after this, so a backfill batch finishes well
// inside the edge runtime's wall-clock limit. Rerun to continue.
const TIME_BUDGET_MS = 110_000;

const NO_SUBSTANCE = 'No substantive discussion yet beyond the report itself.';

const SYSTEM_PROMPT = `You are a career coach writing your private notes about a client after your conversations with them. Your future self will read these notes before the next session, without the transcript. Write what a good advisor would want to remember.

Cover, only where the conversation gives real evidence:
- What they care about most and what they are worried about (in their own framing)
- How they reacted to specific careers in their report: which pulled them, which they pushed back on, and why
- Decisions or leanings they expressed, and anything they said they would do
- Constraints that came up (money, family, location, time, confidence)
- Open questions or tensions still unresolved

Rules:
- 80 to 250 words. Short plain sentences or tight bullets. No headings, no intro.
- Concrete over general: keep names of roles, numbers, timeframes, people they mentioned by role (not by name).
- Do not restate the report. Do not invent. If something was only the coach's suggestion and the user did not engage, leave it out.
- If previous notes are given, update them: keep what still holds, revise what changed, add what is new. Output the full updated notes.
- Write in English. No em-dashes.
- If there was no real discussion, output exactly: "${NO_SUBSTANCE}"`;

// Quick-reply clicks carry no signal. Mirrors wrap-up-extract.
const QUICK_REPLY_PATTERNS = [
  /looks good,?\s*let'?s continue/i,
  /looks good,?\s*i'?m all done/i,
  /^i'?d like to explore this section a bit more$/i,
  /^let'?s wrap up/i,
  /ziet er goed uit,?\s*door naar/i,
  /ziet er goed uit,?\s*ik ben klaar/i,
  /^hier wil ik wat dieper op ingaan$/i,
  /laten we de sessie afronden/i,
  /^laten we deze sectie overslaan/i,
  /^ik ben er klaar voor,?\s*laten we beginnen/i,
];

function stripFormatting(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^---\s*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface MsgRow {
  sender: string;
  content: string;
  created_at: string;
}

type Outcome = 'written' | 'no_substance' | 'no_messages' | 'error';

async function writeNotes(supabase: SupabaseClient, reportId: string, openaiKey: string): Promise<Outcome> {
  const { data: report } = await supabase.from('reports').select('user_id').eq('id', reportId).maybeSingle();
  if (!report) return 'error';

  const { data: messages, error: msgErr } = await supabase
    .from('chat_messages')
    .select('sender, content, created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })
    .returns<MsgRow[]>();
  if (msgErr) {
    console.error('[coach-notes] load messages', reportId, msgErr.message);
    return 'error';
  }
  if (!messages || messages.length === 0) return 'no_messages';

  const lastAt = messages[messages.length - 1].created_at;

  let substantive = 0;
  const parts: string[] = [];
  for (const m of messages) {
    const text = stripFormatting(m.content || '');
    if (!text) continue;
    if (m.sender === 'user' && !QUICK_REPLY_PATTERNS.some((re) => re.test(text))) {
      substantive += text.length;
    }
    parts.push(`${m.sender === 'user' ? 'USER' : 'COACH'}: ${text}`);
  }

  const { data: existing } = await supabase
    .from('coach_notes')
    .select('notes')
    .eq('report_id', reportId)
    .maybeSingle();

  let notes: string;
  if (substantive < SUBSTANCE_THRESHOLD && !existing?.notes) {
    notes = NO_SUBSTANCE;
  } else {
    let transcript = parts.join('\n\n');
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      transcript = transcript.slice(transcript.length - MAX_TRANSCRIPT_CHARS);
    }
    const previous = existing?.notes && existing.notes !== NO_SUBSTANCE
      ? `Previous notes:\n${existing.notes}\n\n`
      : '';

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${previous}Conversation transcript:\n\n${transcript}` },
        ],
      }),
    });
    if (!resp.ok) {
      console.error('[coach-notes] OpenAI', reportId, resp.status, await resp.text());
      return 'error';
    }
    const out = await resp.json();
    notes = out?.choices?.[0]?.message?.content?.trim() ?? '';
    if (!notes) return 'error';
  }

  const { error: upErr } = await supabase.from('coach_notes').upsert({
    report_id: reportId,
    user_id: report.user_id,
    notes,
    source_through: lastAt,
    updated_at: new Date().toISOString(),
  });
  if (upErr) {
    console.error('[coach-notes] upsert', reportId, upErr.message);
    return 'error';
  }
  return notes === NO_SUBSTANCE ? 'no_substance' : 'written';
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const denied = verifySharedSecret(req);
  if (denied) return denied;

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) return json({ error: 'Server misconfigured' }, 500);

  let body: { report_id?: string; backfill?: boolean; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (body.report_id) {
    const outcome = await writeNotes(supabase, body.report_id, openaiKey);
    return json({ report_id: body.report_id, outcome }, outcome === 'error' ? 500 : 200);
  }

  if (body.backfill) {
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100);
    const { data: due, error } = await supabase.rpc('coach_notes_due', { p_limit: limit });
    if (error) {
      console.error('[coach-notes] coach_notes_due', error.message);
      return json({ error: 'Failed to list reports' }, 500);
    }
    const started = Date.now();
    const counts: Record<Outcome, number> = { written: 0, no_substance: 0, no_messages: 0, error: 0 };
    let processed = 0;
    for (const row of (due ?? []) as { report_id: string }[]) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      counts[await writeNotes(supabase, row.report_id, openaiKey)]++;
      processed++;
    }
    const remaining = (due?.length ?? 0) - processed;
    console.log('[coach-notes] backfill', JSON.stringify({ processed, remaining, ...counts }));
    return json({ processed, remaining_in_batch: remaining, ...counts });
  }

  return json({ error: 'report_id or backfill required' }, 400);
});
