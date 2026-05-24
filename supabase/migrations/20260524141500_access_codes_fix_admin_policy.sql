-- Rewrite the admin policy on access_codes.
--
-- The previous policy used: auth.uid() IN (SELECT auth.uid() FROM auth.users
--   WHERE auth.jwt() ->> 'role' = 'admin')
-- which (a) was effectively "if JWT role=admin, allow all" anyway because
-- auth.jwt() is request-scoped not row-scoped, and (b) required SELECT on
-- auth.users — which the `authenticated` role does not have. Result: every
-- non-admin SELECT on access_codes errored with "permission denied for
-- table users", swallowed by PostgREST as zero rows.
--
-- New version: same effective semantics, but checks the JWT claim directly
-- so no auth.users access is needed. Admins who currently work continue to
-- work; non-admins now correctly fall through to the user-scoped policy
-- added in the previous migration.

DROP POLICY IF EXISTS "Admin can manage access codes" ON public.access_codes;

CREATE POLICY "Admin can manage access codes"
  ON public.access_codes
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
