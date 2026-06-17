-- Security advisor follow-ups (beyond the two RLS-disabled tables already fixed
-- in 20260616131000).

-- 1. report_sections_with_user is a SECURITY DEFINER view (advisor ERROR
--    security_definer_view). It joins report_sections + reports + profiles and,
--    running as its creator, bypassed RLS — any caller with the anon key could
--    read every report section and user full name through it. The app does not
--    use this view (only present in generated types). Switch it to
--    security_invoker so it enforces the *caller's* RLS. service_role / postgres
--    (edge functions, n8n) still bypass RLS and see everything, so backend use
--    is unaffected.
ALTER VIEW public.report_sections_with_user SET (security_invoker = on);

-- 2. Several trigger-only / cron-only functions were callable via the public API
--    (advisor WARN anon_security_definer_function_executable). They only ever run
--    as triggers or from pg_cron (which runs as postgres), so revoke API EXECUTE.
--    handle_auth_user_deleted was added in 20260616130000; the rest are
--    pre-existing. NOT touching consume_access_code / link_and_check_entitlement —
--    those are legitimately called by the authenticated frontend.
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_deleted()  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()           FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_tracking()  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public._notify_report_completed()  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_and_send_reminders()  FROM anon, authenticated, public;
