// chat-proxy — authenticated proxy from the browser to n8n's chat webhook.
//
// Why: the n8n chat webhook URL used to live in the frontend bundle as
// VITE_N8N_CHAT_WEBHOOK_URL. Anyone viewing devtools could POST arbitrary
// prompts directly to n8n, burning OpenAI credits in WF5 with no rate
// limit. This proxy fixes that by:
//
//   1. Requiring a valid user JWT (verify_jwt = true at the platform level
//      + getAuthenticatedUser here)
//   2. Rate-limiting per IP (30/min — agent calls cost real money)
//   3. Forwarding to n8n with x-shared-secret. n8n's chat workflow trigger
//      must be configured with Header Auth requiring the same secret.
//
// Setup required:
//   Supabase Edge Function secret: N8N_CHAT_WEBHOOK_URL=<the n8n URL>
//   n8n chat workflow trigger node: Header Auth requiring
//     header `x-shared-secret` to match the value of the
//     N8N_SHARED_SECRET env var / vault.n8n_shared_secret.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
  checkRateLimit,
} from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

// Post-report coach budget per report per calendar month (decision H).
const COACH_MONTHLY_LIMIT = 40;
// WF5C "Coach chat" trigger (production URL; only answers once WF5C is active).
const DEFAULT_COACH_WEBHOOK_URL =
  'https://falkoratlas.app.n8n.cloud/webhook/ca944e4c-de52-46eb-bc45-e2c8405f5019/chat';
const COACH_ENTRY_POINTS = ['chat', 'career', 'move', 'set_aside', 'checkin'];

// How long we wait for n8n before switching to recovery, and how long recovery
// may poll. Together they stay under the frontend's 120s fetch timeout.
const N8N_TIMEOUT_MS = 85_000;
const RECOVERY_WAIT_MS = 25_000;
const RECOVERY_POLL_MS = 2_500;

/** The reply text from an n8n chat response body, or '' when there is none.
 *  Handles a plain object ({output}), an array ([{output}]) and a streamed
 *  NDJSON body ({"type":"item","content":"..."} per line). */
function extractReply(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  const pick = (v: unknown): string => {
    if (Array.isArray(v)) return pick(v[0]);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const out = o.output ?? o.text ?? o.message;
      return typeof out === 'string' ? out : '';
    }
    return '';
  };
  try {
    return pick(JSON.parse(text));
  } catch {
    // Not one JSON document: try NDJSON stream chunks.
    let joined = '';
    for (const line of text.split('\n')) {
      try {
        const chunk = JSON.parse(line);
        if (chunk?.type === 'item' && typeof chunk.content === 'string') joined += chunk.content;
      } catch {
        /* skip non-JSON lines */
      }
    }
    return joined;
  }
}

interface ChatRequestBody {
  action?: 'sendMessage' | 'loadPreviousSession';
  mode?: 'continue';
  // n8n expects the exact key 'n8n-chat/sessionId'
  ['n8n-chat/sessionId']?: string;
  chatInput?: string;
  metadata?: {
    report_id?: string;
    first_name?: string;
    country?: string;
    // Injected by useN8nWebhook so n8n WF5 can respond in the user's language.
    // See LOCALIZATION_PLAN.md Phase 2.
    preferred_language?: string;
    // Section context (set by ChatContainer.sectionMetadata) so WF5 knows which
    // section the user is on and whether any career has been revealed yet —
    // gates career-related follow-up suggestions on personality sections.
    current_section?: string | null;
    careers_revealed?: boolean;
    // Survey-sourced coach context (set by ChatContainer from the report's
    // survey responses). We forward the whole body verbatim, so these pass
    // straight through to WF5 without any change here — listed for clarity.
    assessment_purpose?: string;
    goal_alignment?: string;
    // Coach mode only: which dashboard button opened the coach, and its subject
    // (career title or next-step text).
    entry_point?: string;
    entry_context?: string;
  };
}

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  // Rate limit: 30/min/IP. Cap roughly aligned with a fast human chatting
  // (a message every 2s sustained = 30/min). Anything above is automation.
  const rateLimited = checkRateLimit(req, 30, corsHeaders);
  if (rateLimited) return rateLimited;

  // Require a real user JWT. The platform's verify_jwt = true also enforces
  // this, but the second check returns nicer error messages.
  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;

  const webhookUrl = Deno.env.get('N8N_CHAT_WEBHOOK_URL');
  const sharedSecret = Deno.env.get('N8N_SHARED_SECRET');

  if (!webhookUrl) {
    console.error('[chat-proxy] N8N_CHAT_WEBHOOK_URL not set');
    return errorResponse('Chat service unavailable', 503, corsHeaders);
  }
  if (!sharedSecret) {
    console.error('[chat-proxy] N8N_SHARED_SECRET not set');
    return errorResponse('Chat service misconfigured', 503, corsHeaders);
  }

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  // Cap input size — keeps a runaway client from sending megabyte prompts
  // to n8n.
  if (body.chatInput && typeof body.chatInput === 'string' && body.chatInput.length > 8_000) {
    return errorResponse('chatInput too long (max 8000 chars)', 400, corsHeaders);
  }

  // A report_id always has to be the caller's own report. Without this check a
  // signed-in user could chat about (and, via WF6, edit) someone else's report.
  const reportId = body.metadata?.report_id;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  if (reportId) {
    const { data: owned } = await supabase
      .from('reports')
      .select('id')
      .eq('id', reportId)
      .eq('user_id', authed.userId)
      .maybeSingle();
    if (!owned) return errorResponse('Forbidden', 403, corsHeaders);
  }

  let targetUrl = webhookUrl;
  let reserved = false;
  if (body.mode === 'continue') {
    if (body.action !== 'sendMessage' || !reportId || !body.chatInput?.trim()) {
      return errorResponse('report_id and chatInput required', 400, corsHeaders);
    }

    const { data: flag } = await supabase
      .from('app_flags').select('value').eq('key', 'coach_enabled').maybeSingle();
    if (!flag?.value) return errorResponse('Coach not available', 403, corsHeaders);

    const { data: engagement } = await supabase
      .from('user_engagement_tracking')
      .select('chat_completed_at')
      .eq('user_id', authed.userId)
      .maybeSingle();
    if (!engagement?.chat_completed_at) {
      return errorResponse('Finish your first coaching chat first', 403, corsHeaders);
    }

    const { data: used, error: usageErr } = await supabase.rpc('coach_usage_bump', {
      p_report_id: reportId,
      p_user_id: authed.userId,
      p_limit: COACH_MONTHLY_LIMIT,
      p_delta: 1,
    });
    if (usageErr) {
      console.error('[chat-proxy] coach_usage_bump:', usageErr.message);
      return errorResponse('Chat service unavailable', 503, corsHeaders);
    }
    if (used === -1) {
      const now = new Date();
      const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return new Response(
        JSON.stringify({
          error: 'coach_limit_reached',
          used: COACH_MONTHLY_LIMIT,
          limit: COACH_MONTHLY_LIMIT,
          resets_at: resetsAt.toISOString(),
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    reserved = true;

    // Rebuild the payload: only whitelisted fields reach WF5C.
    const m = body.metadata ?? {};
    const entryPoint = COACH_ENTRY_POINTS.includes(m.entry_point ?? '') ? m.entry_point : 'chat';
    body = {
      action: 'sendMessage',
      'n8n-chat/sessionId': body['n8n-chat/sessionId'],
      chatInput: body.chatInput,
      metadata: {
        report_id: reportId,
        first_name: String(m.first_name ?? '').slice(0, 80),
        country: String(m.country ?? '').slice(0, 80),
        preferred_language: String(m.preferred_language ?? 'en').slice(0, 8),
        entry_point: entryPoint,
        entry_context: String(m.entry_context ?? '').slice(0, 300),
      },
    };
    targetUrl = Deno.env.get('N8N_CHAT_CONTINUE_WEBHOOK_URL') ?? DEFAULT_COACH_WEBHOOK_URL;
  }

  // A coach message that never got a reply is refunded.
  const refund = async () => {
    if (!reserved) return;
    const { error } = await supabase.rpc('coach_usage_bump', {
      p_report_id: reportId,
      p_user_id: authed.userId,
      p_limit: COACH_MONTHLY_LIMIT,
      p_delta: -1,
    });
    if (error) console.error('[chat-proxy] coach refund failed:', error.message);
  };

  // Forward to n8n with auth. We send BOTH x-shared-secret AND Basic Auth
  // because the n8n Chat Trigger node only supports Basic Auth — not Header
  // Auth — but other downstream consumers may still validate x-shared-secret.
  // Basic Auth username is arbitrary; password is the shared secret value.
  // Over HTTPS this is equivalent in security to the header approach.
  const basicAuthUser = Deno.env.get('N8N_BASIC_AUTH_USER') ?? 'atlas-chat-proxy';
  const basicAuthHeader = `Basic ${btoa(`${basicAuthUser}:${sharedSecret}`)}`;

  // Lost-reply recovery (first chat only, not the post-report coach). WF5's
  // Postgres memory saves every turn to n8n_chat_histories (session_id =
  // the chat session id). In round 6 n8n finished the turn and saved the
  // reply, but the reply never reached the browser: once on a turn with a
  // WF6 tool call (empty/unusable body), once on a turn slower than our
  // timeout. The user only saw a retry icon, and each retry ran WF6 again.
  // So: remember where the history stood before forwarding, and when n8n's
  // answer is unusable or late, return the reply the agent saved instead.
  const historySession = body['n8n-chat/sessionId'] ?? reportId ?? null;
  const userTurn = body.chatInput ?? '';
  const canRecover = !reserved && body.action === 'sendMessage' && !!historySession && !!userTurn.trim();
  let historyBaseline = 0;
  if (canRecover) {
    const { data: last } = await supabase
      .from('n8n_chat_histories')
      .select('id')
      .eq('session_id', historySession)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    historyBaseline = Number(last?.id ?? 0);
  }

  // The AI reply saved for THIS user turn: the first human row after the
  // baseline with this exact text, directly followed by an ai row. Other
  // writers (deliver-section, the background agent) can add rows meanwhile,
  // so we never just take "the newest ai row".
  const findSavedReply = async (): Promise<string> => {
    const { data: rows } = await supabase
      .from('n8n_chat_histories')
      .select('id, message')
      .eq('session_id', historySession)
      .gt('id', historyBaseline)
      .order('id', { ascending: true })
      .limit(50);
    const list = (rows ?? []) as Array<{ id: number; message: { type?: string; content?: unknown } }>;
    for (let i = 0; i < list.length - 1; i++) {
      const m = list[i].message;
      const next = list[i + 1].message;
      if (m?.type === 'human' && m.content === userTurn && next?.type === 'ai' && typeof next.content === 'string' && next.content.trim()) {
        return next.content;
      }
    }
    return '';
  };
  const recoverReply = async (waitMs: number): Promise<string> => {
    if (!canRecover) return '';
    const deadline = Date.now() + waitMs;
    for (;;) {
      const found = await findSavedReply().catch(() => '');
      if (found) return found;
      if (Date.now() + RECOVERY_POLL_MS > deadline) return '';
      await new Promise((r) => setTimeout(r, RECOVERY_POLL_MS));
    }
  };
  const recoveredResponse = (output: string) =>
    new Response(JSON.stringify({ output, recovered: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // n8n agent calls are slow; the timeout plus recovery stays shorter than
  // the frontend's 120s so we answer before the user's fetch gives up.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  let n8nResp: Response;
  try {
    n8nResp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': sharedSecret,
        Authorization: basicAuthHeader,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      // n8n is usually still working: wait for the reply it will save.
      const saved = await recoverReply(RECOVERY_WAIT_MS);
      if (saved) {
        console.warn('[chat-proxy] n8n slow; reply recovered from chat history');
        return recoveredResponse(saved);
      }
      await refund();
      console.error(`[chat-proxy] n8n timed out after ${N8N_TIMEOUT_MS / 1000}s, nothing to recover`);
      return errorResponse('Chat timed out. Please try again.', 504, corsHeaders);
    }
    await refund();
    console.error('[chat-proxy] n8n fetch error:', e);
    return errorResponse('Chat service unreachable', 502, corsHeaders);
  } finally {
    clearTimeout(timeout);
  }

  if (!n8nResp.ok) {
    await refund();
    const text = await n8nResp.text().catch(() => '');
    console.error('[chat-proxy] n8n returned non-OK:', n8nResp.status, text.slice(0, 500));
    return errorResponse('Chat agent returned an error', 502, corsHeaders);
  }

  // Pass n8n's body through verbatim — frontend parses the same shape it
  // used to parse from n8n directly. Exception: a body without a usable
  // reply (empty, or a shape the browser can't read) is replaced by the
  // reply the agent saved to its memory, when there is one.
  const respBody = await n8nResp.text();
  if (canRecover && !extractReply(respBody).trim()) {
    const saved = await recoverReply(10_000);
    if (saved) {
      console.warn('[chat-proxy] n8n body had no usable reply; recovered from chat history:', respBody.slice(0, 200));
      return recoveredResponse(saved);
    }
    console.error('[chat-proxy] n8n body had no usable reply and nothing to recover:', respBody.slice(0, 300));
  }
  if (reserved) {
    // Tell the frontend how much budget is left, for the counter.
    try {
      const parsed = JSON.parse(respBody);
      const { data: row } = await supabase
        .from('coach_usage')
        .select('messages_used')
        .eq('report_id', reportId)
        .eq('month', new Date().toISOString().slice(0, 7) + '-01')
        .maybeSingle();
      const payload = Array.isArray(parsed) ? parsed[0] ?? {} : parsed;
      return new Response(
        JSON.stringify({ ...payload, coach_usage: { used: row?.messages_used ?? null, limit: COACH_MONTHLY_LIMIT } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } catch {
      // Not JSON: pass through unchanged.
    }
  }
  return new Response(respBody, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': n8nResp.headers.get('Content-Type') ?? 'application/json' },
  });
});
