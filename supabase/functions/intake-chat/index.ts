// intake-chat — anonymous landing-page intake conversation.
//
// The pre-payment funnel warm-up: an agent-led chat that asks ~5 intake
// questions, delivers a personalized pitch, captures an email for a
// magic-link resume, and produces a mapper-compatible extraction that
// pre-fills the survey after purchase (same rails as the resume upload).
//
// Control is SERVER-SIDE: this function counts user turns and decides which
// phase the conversation is in (Q&A -> pitch -> post-pitch -> close). The
// model is never trusted to self-report the phase.
//
// Anonymous endpoint (verify_jwt = false in config.toml), fenced by:
//   - per-IP rate limit (15/min, best effort per warm instance)
//   - hard cap of MAX_USER_TURNS user messages per session
//   - 600-char cap per message, session token budget
//   - scope-locked system prompts (see prompts.ts)
//
// Secrets used: ANTHROPIC_API_KEY, RESEND_API_KEY, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (all already configured for other functions).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  checkRateLimit,
} from '../_shared/cors.ts';
import {
  renderEmail,
  bodyRow,
  ctaRow,
  h1,
  paragraph,
  escapeHtml,
} from '../_shared/email-chrome.ts';
import {
  type Lang,
  type IntentKey,
  INTENT_KEYS,
  INTENT_LABELS,
  qaSystem,
  pitchSystem,
  postPitchSystem,
  extractionSystem,
  EXTRACTION_TOOL,
  CLOSE_MESSAGE,
  EMAIL_COPY,
} from './prompts.ts';

const MODEL = 'claude-sonnet-5'; // NOTE: never send `temperature` to sonnet-5 (API rejects it)
const QA_TURNS = 5; // user answers before the pitch fires
const MAX_USER_TURNS = 12; // hard stop per session
const MAX_MESSAGE_CHARS = 600;
const MAX_SESSION_TOKENS = 60_000; // input+output budget across the session
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TranscriptMessage {
  role: 'assistant' | 'user';
  text: string;
  at: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function json(body: unknown, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Calls the Anthropic Messages API. Returns the parsed response body. */
async function callClaude(opts: {
  system: string;
  messages: { role: string; content: string }[];
  maxTokens: number;
  tools?: unknown[];
  toolChoice?: unknown;
}): Promise<{ content: Array<{ type: string; text?: string; input?: unknown }>; usage?: { input_tokens: number; output_tokens: number } }> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) {
    console.error('[intake-chat] Claude API error:', r.status, (await r.text()).slice(0, 500));
    throw new Error('claude-api-error');
  }
  return await r.json();
}

function usedTokens(resp: { usage?: { input_tokens: number; output_tokens: number } }): number {
  return (resp.usage?.input_tokens ?? 0) + (resp.usage?.output_tokens ?? 0);
}

/** sonnet-5 may emit a `thinking` block before the text block; take the first text block. */
function textFrom(resp: { content: Array<{ type: string; text?: string }> }): string {
  return resp.content?.find((c) => c.type === 'text')?.text ?? '';
}

/**
 * Builds the Anthropic message array from the stored transcript, prepending a
 * synthetic user context line (also guarantees the required user-first order).
 */
function apiMessages(row: SessionRow): { role: string; content: string }[] {
  const label = INTENT_LABELS[row.language as Lang]?.[row.intent as IntentKey] ?? row.intent;
  const context = `(The visitor opened the chat on the Cairnly landing page. The "what brings you here?" option they relate to: "${label}".)`;
  return [
    { role: 'user', content: context },
    ...(row.messages as TranscriptMessage[]).map((m) => ({ role: m.role, content: m.text })),
  ];
}

interface SessionRow {
  id: string;
  intent: string;
  language: string;
  status: string;
  messages: TranscriptMessage[];
  extraction: Record<string, unknown> | null;
  pitch: string | null;
  email: string | null;
  resume_token: string;
  user_turns: number;
  total_tokens: number;
}

async function getSession(sessionId: string): Promise<SessionRow | null> {
  if (!UUID_RE.test(sessionId ?? '')) return null;
  const { data, error } = await supabase
    .from('intake_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) {
    console.error('[intake-chat] session fetch failed:', error.message);
    return null;
  }
  return data as SessionRow | null;
}

/** Mapper-compatible pre-fill fields (safe subset only; see prompts.ts). */
function prefillFromExtraction(extraction: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!extraction) return null;
  const prefill: Record<string, unknown> = {};
  if (typeof extraction.name === 'string' && extraction.name.trim()) prefill.name = extraction.name.trim();
  if (typeof extraction.goals === 'string' && extraction.goals.trim().length >= 20) {
    prefill.goals = extraction.goals.trim();
  }
  if (typeof extraction.years_experience === 'number' && extraction.years_experience >= 0) {
    prefill.years_experience = extraction.years_experience;
  }
  if (typeof extraction.study_subject === 'string' && extraction.study_subject.trim()) {
    prefill.study_subject = extraction.study_subject.trim();
  }
  return Object.keys(prefill).length > 0 ? prefill : null;
}

function sanitizeLang(input: unknown): Lang {
  return input === 'nl' ? 'nl' : 'en';
}

// ── Action handlers ──────────────────────────────────────────────────────────

/**
 * The conversation opens with the VISITOR's message (seeded from the intent
 * pill, editable, or free text). Creates the session and generates the
 * agent's first reply (acknowledge + question 1).
 */
async function handleStart(body: Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return errorResponse('Empty message', 400, corsHeaders);
  if (text.length > MAX_MESSAGE_CHARS) {
    return errorResponse('Message too long', 400, corsHeaders);
  }
  const language = sanitizeLang(body.language);
  const intent: IntentKey = INTENT_KEYS.includes(body.intent as IntentKey)
    ? (body.intent as IntentKey)
    : 'default';
  const source = body.source === 'pill' ? 'pill' : 'cta';
  const { data, error } = await supabase
    .from('intake_sessions')
    .insert({ intent, language, source, messages: [] })
    .select('*')
    .single();
  if (error || !data) {
    console.error('[intake-chat] session insert failed:', error?.message);
    return errorResponse('Could not start the conversation', 500, corsHeaders);
  }
  return await advanceConversation(data as SessionRow, text, corsHeaders, true);
}

async function handleMessage(body: Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return errorResponse('Empty message', 400, corsHeaders);
  if (text.length > MAX_MESSAGE_CHARS) {
    return errorResponse('Message too long', 400, corsHeaders);
  }
  const row = await getSession(String(body.sessionId ?? ''));
  if (!row) return errorResponse('Unknown session', 404, corsHeaders);
  return await advanceConversation(row, text, corsHeaders, false);
}

/**
 * Shared turn handler: appends the user message, picks the phase from the
 * turn count (turns 1-5 ask questions 1-5, turn 6 fires the pitch +
 * extraction, later turns are post-pitch follow-ups), persists, replies.
 */
async function advanceConversation(
  row: SessionRow,
  text: string,
  corsHeaders: Record<string, string>,
  includeSessionId: boolean,
): Promise<Response> {
  const lang = sanitizeLang(row.language);
  const userTurns = row.user_turns + 1;

  // Hard stops: turn cap or token budget reached -> fixed close, no API call.
  if (userTurns > MAX_USER_TURNS || row.total_tokens > MAX_SESSION_TOKENS) {
    return json({ reply: CLOSE_MESSAGE[lang], stage: row.status === 'active' ? 'chat' : 'pitched', closed: true }, corsHeaders);
  }

  const transcript: TranscriptMessage[] = [
    ...row.messages,
    { role: 'user', text, at: new Date().toISOString() },
  ];
  const rowForApi = { ...row, messages: transcript } as SessionRow;

  let reply: string;
  let stage: 'chat' | 'pitched' = row.status === 'active' ? 'chat' : 'pitched';
  let tokens = 0;
  let extraction = row.extraction;
  let pitch = row.pitch;

  try {
    if (row.status === 'active' && userTurns <= QA_TURNS) {
      // Q&A phase: the visitor's opener is turn 1, replied to with question 1.
      const resp = await callClaude({
        system: qaSystem(lang, userTurns),
        messages: apiMessages(rowForApi),
        maxTokens: 300,
      });
      reply = textFrom(resp);
      tokens = usedTokens(resp);
    } else if (row.status === 'active') {
      // Pitch phase: personalized preview + structured extraction.
      const pitchResp = await callClaude({
        system: pitchSystem(lang),
        messages: apiMessages(rowForApi),
        maxTokens: 600,
      });
      reply = textFrom(pitchResp);
      tokens = usedTokens(pitchResp);
      pitch = reply;
      stage = 'pitched';
      try {
        const extractResp = await callClaude({
          system: extractionSystem(lang),
          messages: apiMessages(rowForApi),
          maxTokens: 500,
          tools: [EXTRACTION_TOOL],
          toolChoice: { type: 'tool', name: EXTRACTION_TOOL.name },
        });
        tokens += usedTokens(extractResp);
        const toolBlock = extractResp.content?.find((c) => c.type === 'tool_use');
        if (toolBlock?.input) extraction = toolBlock.input as Record<string, unknown>;
      } catch (e) {
        // Extraction is best-effort: the pitch still ships without pre-fill.
        console.error('[intake-chat] extraction failed:', e);
      }
    } else {
      // Post-pitch follow-up questions.
      const resp = await callClaude({
        system: postPitchSystem(lang),
        messages: apiMessages(rowForApi),
        maxTokens: 300,
      });
      reply = textFrom(resp);
      tokens = usedTokens(resp);
    }
  } catch (e) {
    console.error('[intake-chat] message handling failed:', e);
    return errorResponse('The conversation hiccuped, please try again', 502, corsHeaders);
  }

  if (!reply) return errorResponse('The conversation hiccuped, please try again', 502, corsHeaders);

  transcript.push({ role: 'assistant', text: reply, at: new Date().toISOString() });
  const { error: updateError } = await supabase
    .from('intake_sessions')
    .update({
      messages: transcript,
      user_turns: userTurns,
      total_tokens: row.total_tokens + tokens,
      status: stage === 'pitched' ? (row.status === 'email_captured' ? 'email_captured' : 'pitched') : row.status,
      pitch,
      extraction,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (updateError) console.error('[intake-chat] session update failed:', updateError.message);

  return json(
    {
      ...(includeSessionId ? { sessionId: row.id } : {}),
      reply,
      stage,
      prefill: stage === 'pitched' ? prefillFromExtraction(extraction) : null,
    },
    corsHeaders,
  );
}

async function handleEmail(body: Record<string, unknown>, corsHeaders: Record<string, string>, origin: string): Promise<Response> {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return errorResponse('Invalid email address', 400, corsHeaders);
  }
  const row = await getSession(String(body.sessionId ?? ''));
  if (!row) return errorResponse('Unknown session', 404, corsHeaders);

  const { error: updateError } = await supabase
    .from('intake_sessions')
    .update({ email, status: 'email_captured', updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (updateError) {
    console.error('[intake-chat] email update failed:', updateError.message);
    return errorResponse('Could not save your email', 500, corsHeaders);
  }

  const lang = sanitizeLang(row.language);
  const copy = EMAIL_COPY[lang];
  const name = typeof row.extraction?.name === 'string' ? (row.extraction.name as string) : null;
  const link = `${origin}/?intake=${row.resume_token}`;
  const pitchHtml = row.pitch
    ? paragraph(escapeHtml(row.pitch).replace(/\n+/g, '<br/><br/>'))
    : '';
  const html = renderEmail({
    title: copy.title,
    preheader: copy.preheader,
    bodyHtml:
      bodyRow(h1(copy.heading(name)) + paragraph(copy.intro) + pitchHtml + paragraph(copy.outro)) +
      ctaRow(copy.cta, link),
  });
  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const { error: sendError } = await resend.emails.send({
      from: 'Cairnly <no-reply@cairnly.io>',
      to: [email],
      subject: copy.subject,
      html,
    });
    if (sendError) console.error('[intake-chat] email send failed:', sendError);
  } catch (e) {
    // Email is a courtesy; the funnel continues even if it fails.
    console.error('[intake-chat] email send threw:', e);
  }
  return json({ ok: true }, corsHeaders);
}

async function handleResume(body: Record<string, unknown>, corsHeaders: Record<string, string>): Promise<Response> {
  const token = String(body.token ?? '');
  if (!UUID_RE.test(token)) return errorResponse('Invalid link', 400, corsHeaders);
  const { data, error } = await supabase
    .from('intake_sessions')
    .select('*')
    .eq('resume_token', token)
    .maybeSingle();
  if (error || !data) return errorResponse('Invalid link', 404, corsHeaders);
  const row = data as SessionRow;
  return json(
    {
      sessionId: row.id,
      messages: (row.messages as TranscriptMessage[]).map((m) => ({ role: m.role, text: m.text })),
      stage: row.status === 'active' ? 'chat' : 'pitched',
      emailCaptured: row.status === 'email_captured',
      intent: row.intent,
      language: row.language,
      prefill: prefillFromExtraction(row.extraction),
      contact: { email: row.email, firstName: typeof row.extraction?.name === 'string' ? row.extraction.name : null },
    },
    corsHeaders,
  );
}

// ── Entrypoint ───────────────────────────────────────────────────────────────

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405, corsHeaders);

  const rateLimited = checkRateLimit(req, 15, corsHeaders);
  if (rateLimited) return rateLimited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON', 400, corsHeaders);
  }

  // Origin for the magic link: the CORS layer already resolved the caller's
  // origin to an allowed value (falls back to https://cairnly.io).
  const origin = corsHeaders['Access-Control-Allow-Origin'] || 'https://cairnly.io';

  switch (body.action) {
    case 'start':
      return await handleStart(body, corsHeaders);
    case 'message':
      return await handleMessage(body, corsHeaders);
    case 'email':
      return await handleEmail(body, corsHeaders, origin);
    case 'resume':
      return await handleResume(body, corsHeaders);
    default:
      return errorResponse('Unknown action', 400, corsHeaders);
  }
});
