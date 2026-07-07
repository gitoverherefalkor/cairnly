import { lazy, type ComponentType } from 'react';

/**
 * A drop-in replacement for React.lazy that recovers gracefully from failed
 * dynamic imports — the usual cause of the brief "Something went wrong" flash
 * users saw when navigating right after a deploy.
 *
 * Why the flash happened: Vercel gives every build new hashed chunk filenames.
 * A browser holding the OLD index.html tries to import a chunk hash that no
 * longer exists on the server → the import rejects → the error bubbles up to
 * ChunkLoadErrorBoundary, which can render its error card (e.g. on a second
 * failure inside its 10s reload window, or when the browser's error message
 * isn't recognised as a chunk error).
 *
 * This wrapper handles the failure earlier and more calmly:
 *   1. Retry the import once — clears transient network blips with no reload.
 *   2. Still failing → almost always a stale deploy. Reload ONCE (guarded so we
 *      can't loop) to pull fresh HTML with valid chunk hashes. While the reload
 *      is in flight we return a never-resolving promise, so React keeps showing
 *      the neutral Suspense spinner (PageLoader) — never the scary card.
 *   3. Already reloaded within the guard window and it STILL fails → genuinely
 *      broken, not just stale. Re-throw so the boundary shows its card.
 */

// Shared with ChunkLoadErrorBoundary so the two coordinate on the same window.
const RELOAD_TS_KEY = 'chunk_reload_ts';
const RELOAD_LOOP_WINDOW_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || '';
  const name = error.name || '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Loading CSS chunk/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /'text\/html' is not a valid JavaScript MIME type/i.test(msg)
  );
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      // 1. One silent retry — transient network hiccup, no reload needed.
      try {
        return await factory();
      } catch {
        // 2. Still failing → stale deploy. Reload once (guarded) to get fresh
        //    HTML. Keep the Suspense spinner up until the reload takes over.
        const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
        if (Date.now() - last > RELOAD_LOOP_WINDOW_MS) {
          sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
          window.location.reload();
          return new Promise<{ default: T }>(() => {}); // never resolves; reload wins
        }
        // 3. We already reloaded and it's still broken → let the boundary show.
        throw err;
      }
    }
  });
}
