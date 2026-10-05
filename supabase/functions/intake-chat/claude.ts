// Anthropic Messages API helpers shared by both intake-chat audiences
// (the homepage consumer chat and the /partners pre-chat).

export const MODEL = 'claude-sonnet-5-5'; // NOTE: never send `temperature` (API rejects it)
// Extraction forces a tool call (tool_choice: tool). Sonnet 5.5 rejects forced
// tool_choice outright (400, even with between_tools), so that one call stays on
// Sonnet 5. Moving it needs tool_choice auto + a prompt that insists on the tool.
export const EXTRACTION_MODEL = 'claude-sonnet-5';

export interface ClaudeResponse {
  content: Array<{ type: string; text?: string; input?: unknown }>;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Calls the Anthropic Messages API. Returns the parsed response body.
 * Retries once on transient failures (429 rate limit, 5xx/529 overload,
 * network errors, timeouts) — without this, a single blip surfaces to the
 * visitor as "the conversation hiccuped" mid-funnel. Non-retryable 4xx
 * errors (bad request, auth) fail immediately.
 */
export async function callClaude(opts: {
  system: string;
  messages: { role: string; content: string }[];
  maxTokens: number;
  tools?: unknown[];
  toolChoice?: unknown;
  thinking?: unknown;
  model?: string;
  /** Sonnet 5.5 effort: low/medium/high. Sent as output_config.effort. */
  effort?: 'low' | 'medium' | 'high';
}): Promise<ClaudeResponse> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const body: Record<string, unknown> = {
    model: opts.model ?? MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  if (opts.thinking) body.thinking = opts.thinking;
  if (opts.effort) body.output_config = { effort: opts.effort };

  const attempt = async (): Promise<ClaudeResponse> => {
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
      const err = new Error('claude-api-error') as Error & { retryable?: boolean };
      err.retryable = r.status === 429 || r.status >= 500;
      throw err;
    }
    return await r.json();
  };

  try {
    return await attempt();
  } catch (e) {
    // Network errors and AbortSignal timeouts have no `retryable` flag; treat
    // them as transient. Only explicit non-retryable API errors (4xx) rethrow.
    if ((e as { retryable?: boolean }).retryable === false) throw e;
    console.error('[intake-chat] transient Claude failure, retrying once:', e);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return await attempt();
  }
}

export function usedTokens(resp: { usage?: { input_tokens: number; output_tokens: number } }): number {
  return (resp.usage?.input_tokens ?? 0) + (resp.usage?.output_tokens ?? 0);
}

/** sonnet-5 may emit a `thinking` block before the text block; take the first text block. */
export function textFrom(resp: { content: Array<{ type: string; text?: string }> }): string {
  return resp.content?.find((c) => c.type === 'text')?.text ?? '';
}

