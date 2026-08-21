// Single source of truth for admin-gated UI (the Ops console, the report-PDF
// test button). Previously duplicated in Ops.tsx and Dashboard.tsx, which meant
// adding an address in one place silently missed the other.
//
// This gates UI only — it is NOT a security boundary. Ops data is protected by
// RLS and service-role edge functions; this list just decides what renders.
//
// Mirrors supabase/functions/_shared/admins.ts, which is the real gate. Deno and
// Vite cannot share a module, so the list exists twice; admins.test.ts reads the
// edge copy and fails if the two drift apart.
//
// NOTE (2026-08-21): of these, only sjn.geurts@gmail.com and
// sjoerd@falkoratlas.com have real Supabase accounts today. The other two are
// listed ahead of the accounts existing, which is harmless — an address with no
// account simply cannot sign in. falkoratlas.com is being phased out in favour
// of bethehitl.com but stays until a bethehitl account exists and has been
// signed in with, otherwise removing it locks Sjoerd out of Ops.
export const ADMIN_EMAILS = new Set([
  'sjn.geurts@gmail.com',
  'sjoerd@bethehitl.com',
  'sjoerd@cairnly.io',
  'sjoerd@falkoratlas.com',
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has((email ?? '').trim().toLowerCase());
}
