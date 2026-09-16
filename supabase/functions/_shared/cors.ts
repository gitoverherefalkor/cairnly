// Shared CORS utility for Atlas edge functions
// Browser-called functions use getAllowedCorsHeaders()
// n8n-called functions use verifySharedSecret() instead

const ALLOWED_ORIGINS = [
  'https://cairnly.io',
  'https://www.cairnly.io',
];

// Allow localhost with any port in development
const DEV_ORIGIN_PATTERN = /^http:\/\/localhost(:\d+)?$/;

/**
 * Returns CORS headers with the origin restricted to known domains.
 * In development, localhost origins are also allowed.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) || DEV_ORIGIN_PATTERN.test(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/**
 * Handles CORS preflight (OPTIONS) requests.
 * Returns a Response if it's a preflight, or null to continue.
 */
export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}

/**
 * Verifies a shared secret for server-to-server calls (n8n → edge function).
 * Fails closed: if N8N_SHARED_SECRET is not configured, the request is rejected
 * with 503. Misconfiguration must never produce an open endpoint.
 *
 * Set the secret on every environment that calls these functions:
 *   Supabase Edge Function secrets:  N8N_SHARED_SECRET=<value>
 *   Supabase Vault (for pg_net):     vault.create_secret('<value>', 'n8n_shared_secret', '...')
 *   n8n side (for outbound calls):   same value, sent as x-shared-secret header
 */
export function verifySharedSecret(req: Request): Response | null {
  const secret = Deno.env.get('N8N_SHARED_SECRET');
  if (!secret) {
    console.error('N8N_SHARED_SECRET is not set — rejecting request');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: shared secret not set' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const provided = req.headers.get('x-shared-secret') || '';
  if (provided !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

/**
 * Returns a sanitized error response — never leaks internal details to the client.
 */
export function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

/**
 * Resolves the authenticated user from the request's Authorization header by
 * calling Supabase's GoTrue auth/v1/user endpoint. Avoids pulling supabase-js
 * into the _shared bundle.
 *
 * Returns the user on success, or a Response (401) on failure.
 *
 * Caller should:
 *   const authed = await getAuthenticatedUser(req, corsHeaders);
 *   if (authed instanceof Response) return authed;
 *   const { userId } = authed;
 *
 * NOTE: ANY function that takes a user-scoped resource ID (report_id, etc.) from
 *       the request body MUST additionally verify ownership against `userId`
 *       before reading or writing. JWT auth alone only proves SOME user is
 *       logged in.
 */
export async function getAuthenticatedUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string; email?: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('Authorization required', 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('SUPABASE_URL or SUPABASE_ANON_KEY missing in environment');
    return errorResponse('Server misconfigured', 500, corsHeaders);
  }

  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
      },
    });
  } catch (e) {
    console.error('auth/v1/user fetch failed:', e);
    return errorResponse('Authentication service unreachable', 503, corsHeaders);
  }

  if (!res.ok) {
    return errorResponse('Invalid authentication', 401, corsHeaders);
  }

  const user = await res.json().catch(() => null);
  if (!user?.id || typeof user.id !== 'string') {
    return errorResponse('Invalid authentication', 401, corsHeaders);
  }

  return { userId: user.id, email: user.email };
}

// --- Rate Limiting ---
// Lightweight in-memory rate limiter for Supabase Edge Functions.
// Each function instance has its own Map, so this works best for sustained abuse
// from a single IP hitting the same warm instance. For distributed rate limiting,
// you'd need Redis or a database counter — but this catches the common cases.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple rate limiter. Returns an error Response if limit exceeded, or null to proceed.
 * @param req - incoming request (IP extracted from headers)
 * @param maxRequests - max requests allowed in the window
 * @param windowMs - time window in milliseconds (default: 60 seconds)
 * @param corsHeaders - CORS headers to include in the 429 response
 */
export function checkRateLimit(
  req: Request,
  maxRequests: number,
  corsHeaders: Record<string, string>,
  windowMs = 60_000,
): Response | null {
  // Get client IP from standard headers
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  // Clean up expired entries periodically (every 100 checks)
  if (Math.random() < 0.01) {
    for (const [key, val] of rateLimitStore) {
      if (val.resetAt < now) rateLimitStore.delete(key);
    }
  }

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      },
    );
  }

  return null;
}
