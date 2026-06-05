// Hardened delivery of the survey hand-off to the n8n webhook.
//
// Why this exists: the n8n webhook normally responds immediately (the Webhook
// node runs in "onReceived" mode), so a successful hand-off is fast and n8n does
// the heavy AI work asynchronously, writing results back to the report row.
//
// The failure we hit on 2026-06-05: while an n8n.cloud instance is sleeping /
// restarting, an *active* workflow's webhook briefly returns an error and
// creates NO execution. Depending on timing that is either a 404
// ("webhook not registered") or a gateway 5xx. The old code only retried on
// 5xx, so the 404 case failed instantly and dead-ended the user.
//
// This helper therefore retries on ANY failure (non-2xx response, network
// error, or timeout) and gives each attempt its own AbortController timeout so a
// hung instance can never block the request. Everything time-related is
// injectable so the retry logic can be unit-tested without real delays.

export interface DeliverOptions {
  /** Total attempts including the first one. Default 3. */
  attempts?: number;
  /** Per-attempt timeout in ms (AbortController). Default 15_000. */
  timeoutMs?: number;
  /** Backoff before each retry, indexed per gap. Default [4_000, 15_000]. */
  delaysMs?: number[];
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable sleep (tests pass a no-op to skip real backoff). */
  sleep?: (ms: number) => Promise<void>;
  /** Logger for per-attempt diagnostics. Defaults to console.warn. */
  log?: (msg: string) => void;
}

export interface DeliverResult {
  ok: boolean;
  /** Last HTTP status seen, or null if no response was ever received. */
  status: number | null;
  /** Last response body or error text (for logging on final failure). */
  body: string;
  /** How many attempts were actually made. */
  attemptsMade: number;
}

export async function deliverToN8n(
  url: string,
  payload: unknown,
  opts: DeliverOptions = {},
): Promise<DeliverResult> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const delaysMs = opts.delaysMs ?? [4_000, 15_000];
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const log = opts.log ?? ((msg: string) => console.warn(msg));

  const bodyJson = JSON.stringify(payload);
  let status: number | null = null;
  let body = '';

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyJson,
        signal: controller.signal,
      });
      clearTimeout(timer);
      status = resp.status;

      if (resp.ok) {
        return { ok: true, status, body: '', attemptsMade: attempt };
      }

      // Non-2xx: capture body for diagnostics and fall through to retry.
      body = await resp.text().catch(() => '');
      log(`n8n delivery attempt ${attempt}/${attempts} failed with ${status}: ${body.slice(0, 300)}`);
    } catch (err) {
      clearTimeout(timer);
      status = null;
      body = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      log(`n8n delivery attempt ${attempt}/${attempts} errored (network/timeout): ${body}`);
    }

    // Retry on ANY failure (non-2xx, network error, or timeout) while attempts remain.
    if (attempt < attempts) {
      const delay = delaysMs[attempt - 1] ?? delaysMs[delaysMs.length - 1] ?? 0;
      await sleep(delay);
    }
  }

  return { ok: false, status, body, attemptsMade: attempts };
}
