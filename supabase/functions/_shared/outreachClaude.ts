// The one Claude call every outreach generator makes: a forced tool call on
// sonnet-5, retried once on a transient failure. Shared by outreach-mail-sync
// (classify a reply) and outreach-prepare (fit a skeleton to an agency).

export const OUTREACH_MODEL = 'claude-sonnet-5'; // never send `temperature` to sonnet-5
/**
 * The second reader (outreachCritic.ts): a stronger model, a handful of calls
 * a day. Opus 5, not 5.5: 5.5 rejects both `thinking: disabled` and a forced
 * tool_choice (400), and this call relies on both. Opus 5 accepts disabled
 * thinking at the default effort.
 */
export const CRITIC_MODEL = 'claude-opus-5';

export type ClaudeResponse = { content?: Array<{ type: string; name?: string; input?: unknown }> };

export async function claudeToolCall(
  system: string,
  userMessage: string,
  tool: { name: string },
  maxTokens: number,
  model: string = OUTREACH_MODEL,
): Promise<ClaudeResponse> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    // sonnet-5 runs adaptive thinking by default and it shares max_tokens
    // with the answer; a forced tool call does not need it.
    thinking: { type: 'disabled' },
  };
  const attempt = async () => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (!r.ok) {
      const text = (await r.text()).slice(0, 500);
      console.error('[outreach] Claude error', r.status, text);
      const err = new Error('claude-api-error') as Error & { retryable?: boolean };
      err.retryable = r.status === 429 || r.status >= 500;
      throw err;
    }
    return await r.json();
  };
  try {
    return await attempt();
  } catch (e) {
    if ((e as { retryable?: boolean }).retryable === false) throw e;
    await new Promise((res) => setTimeout(res, 1500));
    return await attempt();
  }
}
