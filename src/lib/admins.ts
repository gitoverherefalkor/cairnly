// Single source of truth for admin-gated UI (the Ops console, the report-PDF
// test button). Previously duplicated in Ops.tsx and Dashboard.tsx, which meant
// adding an address in one place silently missed the other.
//
// This gates UI only — it is NOT a security boundary. Ops data is protected by
// RLS and service-role edge functions; this list just decides what renders.
//
// MIGRATION NOTE (2026-08-13): falkoratlas.com is being phased out in favour of
// bethehitl.com. It is deliberately still here because it is currently the ONLY
// address with a real Supabase account — removing it now locks Sjoerd out of
// Ops. Drop it once a bethehitl.com account exists and has been signed in with.
export const ADMIN_EMAILS = new Set([
  'sjoerd@bethehitl.com',
  'sjoerd@cairnly.io',
  'sjoerd@falkoratlas.com',
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.has((email ?? '').trim().toLowerCase());
}
