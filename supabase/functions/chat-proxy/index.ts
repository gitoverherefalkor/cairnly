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

interface ChatRequestBody {
  action?: 'sendMessage' | 'loadPreviousSession';
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

  // Forward to n8n with auth. We send BOTH x-shared-secret AND Basic Auth
  // because the n8n Chat Trigger node only supports Basic Auth — not Header
  // Auth — but other downstream consumers may still validate x-shared-secret.
  // Basic Auth username is arbitrary; password is the shared secret value.
  // Over HTTPS this is equivalent in security to the header approach.
  const basicAuthUser = Deno.env.get('N8N_BASIC_AUTH_USER') ?? 'atlas-chat-proxy';
  const basicAuthHeader = `Basic ${btoa(`${basicAuthUser}:${sharedSecret}`)}`;

  // 90s timeout (n8n agent calls are slow); shorter than the frontend's
  // 120s so we surface a clear error before the user's fetch times out.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let n8nResp: Response;
  try {
    n8nResp = await fetch(webhookUrl, {
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
      console.error('[chat-proxy] n8n timed out after 90s');
      return errorResponse('Chat timed out. Please try again.', 504, corsHeaders);
    }
    console.error('[chat-proxy] n8n fetch error:', e);
    return errorResponse('Chat service unreachable', 502, corsHeaders);
  } finally {
    clearTimeout(timeout);
  }

  if (!n8nResp.ok) {
    const text = await n8nResp.text().catch(() => '');
    console.error('[chat-proxy] n8n returned non-OK:', n8nResp.status, text.slice(0, 500));
    return errorResponse('Chat agent returned an error', 502, corsHeaders);
  }

  // Pass n8n's body through verbatim — frontend parses the same shape it
  // used to parse from n8n directly.
  const respBody = await n8nResp.text();
  return new Response(respBody, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': n8nResp.headers.get('Content-Type') ?? 'application/json' },
  });
});
