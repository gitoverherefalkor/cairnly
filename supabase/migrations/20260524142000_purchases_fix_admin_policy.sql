-- Rewrite the admin policy on purchases for the same reason as access_codes.
--
-- Previous USING expression:
--   auth.uid() IN (SELECT auth.uid() FROM auth.users
--                  WHERE auth.jwt() ->> 'role' = 'admin')
-- This errored for non-admin authenticated users because auth.users is not
-- readable by that role, masking the user-scoped policy
-- ("Users can view their own purchases") below it.
--
-- Same semantics, no auth.users dependency.

DROP POLICY IF EXISTS "Admin can manage purchases" ON public.purchases;

CREATE POLICY "Admin can manage purchases"
  ON public.purchases
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
