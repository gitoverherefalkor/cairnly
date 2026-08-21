// Canonical admin allowlist for the edge functions.
//
// This IS the security boundary. src/lib/admins.ts mirrors it for the frontend,
// but that file only decides what renders — never trust it for access.
//
// Why a shared file: this list used to be pasted into each ops function
// separately and drifted. src/lib/admins.ts carried sjoerd@bethehitl.com while
// ops-feed and ops-marketing did not, so signing in with that address rendered
// the Ops console and then 403'd on every call it made. Import from here.
//
// Keep in sync with src/lib/admins.ts. Deno and Vite cannot share a module, so
// the two lists exist separately; src/lib/admins.test.ts fails if they drift.
export const ADMIN_EMAILS = new Set([
  'sjn.geurts@gmail.com',
  'sjoerd@bethehitl.com',
  'sjoerd@cairnly.io',
  'sjoerd@falkoratlas.com',
]);

/** Case- and whitespace-tolerant check. Auth providers do not normalise for you. */
export function isAdminEmail(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has((email ?? '').trim().toLowerCase());
}
