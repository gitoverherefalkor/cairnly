// Tests for the hardened n8n hand-off retry logic.
//
// Run from the repo root:  deno test supabase/functions/forward-to-n8n/
//
// All time-related behaviour is injected (sleep is a no-op, fetch is a stub) so
// these run instantly and never touch the network.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deliverToN8n } from "./n8n-delivery.ts";

const noSleep = (_ms: number) => Promise.resolve();
const silent = (_msg: string) => {};

/** Builds a fetch stub that returns the given queued responses in order. */
function queuedFetch(responses: Array<Response | (() => Promise<Response>) | "throw">) {
  let i = 0;
  const calls: string[] = [];
  const impl = ((_url: string | URL, _init?: RequestInit) => {
    calls.push(String(_url));
    const next = responses[Math.min(i, responses.length - 1)];
    i++;
    if (next === "throw") return Promise.reject(new TypeError("network down"));
    if (typeof next === "function") return next();
    return Promise.resolve(next);
  }) as unknown as typeof fetch;
  return { impl, callCount: () => i, calls };
}

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
const notRegistered = () =>
  new Response(
    JSON.stringify({ code: 404, message: "This webhook is not registered for POST requests." }),
    { status: 404 },
  );
const gateway5xx = () => new Response("Bad Gateway", { status: 502 });

Deno.test("happy path: 200 on first try, no retry", async () => {
  const f = queuedFetch([ok()]);
  const res = await deliverToN8n("https://n8n/webhook", { hello: "world" }, {
    fetchImpl: f.impl,
    sleep: noSleep,
    log: silent,
  });
  assertEquals(res.ok, true);
  assertEquals(res.status, 200);
  assertEquals(res.attemptsMade, 1);
  assertEquals(f.callCount(), 1);
});

Deno.test("THE BUG: 404 'webhook not registered' is retried and recovers", async () => {
  // First call hits a sleeping instance (404), second call succeeds once the
  // webhook has re-registered. The old code returned 502 immediately here.
  const f = queuedFetch([notRegistered(), ok()]);
  const res = await deliverToN8n("https://n8n/webhook", {}, {
    fetchImpl: f.impl,
    sleep: noSleep,
    log: silent,
  });
  assertEquals(res.ok, true);
  assertEquals(res.attemptsMade, 2);
  assertEquals(f.callCount(), 2);
});

Deno.test("5xx gateway error is retried and recovers", async () => {
  const f = queuedFetch([gateway5xx(), ok()]);
  const res = await deliverToN8n("https://n8n/webhook", {}, {
    fetchImpl: f.impl,
    sleep: noSleep,
    log: silent,
  });
  assertEquals(res.ok, true);
  assertEquals(res.attemptsMade, 2);
});

Deno.test("network error is retried and recovers", async () => {
  const f = queuedFetch(["throw", ok()]);
  const res = await deliverToN8n("https://n8n/webhook", {}, {
    fetchImpl: f.impl,
    sleep: noSleep,
    log: silent,
  });
  assertEquals(res.ok, true);
  assertEquals(res.attemptsMade, 2);
});

Deno.test("gives up after exhausting all attempts", async () => {
  const f = queuedFetch([notRegistered(), notRegistered(), notRegistered()]);
  const res = await deliverToN8n("https://n8n/webhook", {}, {
    attempts: 3,
    fetchImpl: f.impl,
    sleep: noSleep,
    log: silent,
  });
  assertEquals(res.ok, false);
  assertEquals(res.status, 404);
  assertEquals(res.attemptsMade, 3);
  assertEquals(f.callCount(), 3);
});

Deno.test("a hung instance is aborted by the per-attempt timeout, then retried", async () => {
  // First attempt hangs until aborted; the per-attempt AbortController fires,
  // the attempt is treated as a failure, then the second attempt succeeds.
  let i = 0;
  const impl = ((_url: string | URL, init?: RequestInit) => {
    i++;
    if (i === 1) {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        }
      });
    }
    return Promise.resolve(ok());
  }) as unknown as typeof fetch;

  const res = await deliverToN8n("https://n8n/webhook", {}, {
    attempts: 2,
    timeoutMs: 20, // fire the abort quickly
    fetchImpl: impl,
    sleep: noSleep,
    log: silent,
  });
  assertEquals(res.ok, true);
  assertEquals(res.attemptsMade, 2);
  assertEquals(i, 2);
});
