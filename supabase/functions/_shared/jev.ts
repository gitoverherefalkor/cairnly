// TypeSafe Jev client for edge functions. Port of scripts/jev-shared.mjs.
// - model pinned, retries on 429/529 with backoff
// - the key comes from Deno.env and is never logged
// - one log line per call: question ids, probabilities, model, tokens, latency

export const JEV_MODEL = 'jev-1.13.0';
export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';

export class JevError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Fails hard when the key is missing, so a misconfigured deploy never silently skips labels.
export function requireJevKey(): string {
  const key = Deno.env.get('TYPESAFE_API_KEY');
  if (!key) throw new JevError('TYPESAFE_API_KEY is not set', 503);
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface JevResponse {
  model: string;
  answers: Record<string, any>;
  usage?: { input_tokens?: number };
}

export async function callJev(
  apiKey: string,
  payload: { state: Record<string, unknown>; questions: Record<string, unknown> },
  { retries = 4, tag = '' }: { retries?: number; tag?: string } = {},
): Promise<JevResponse> {
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    const res = await fetch(JEV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, ...payload }),
    });
    const ms = Math.round(performance.now() - t0);
    const text = await res.text();
    if (res.status === 200) {
      const body = JSON.parse(text) as JevResponse;
      const summary = Object.fromEntries(
        Object.entries(body.answers ?? {}).map(([id, a]) => [id, a?.probabilities ?? a?.noul ?? a?.score ?? null]),
      );
      console.log(`[jev] ${tag} model=${body.model} tokens=${body.usage?.input_tokens ?? '?'} ms=${ms} answers=${JSON.stringify(summary)}`);
      return body;
    }
    if ((res.status === 429 || res.status === 529) && attempt < retries) {
      console.warn(`[jev] ${tag} ${res.status}, retry ${attempt + 1}/${retries}`);
      await sleep(500 * 2 ** (attempt + 1) + Math.random() * 250);
      continue;
    }
    throw new JevError(`TypeSafe ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
}
