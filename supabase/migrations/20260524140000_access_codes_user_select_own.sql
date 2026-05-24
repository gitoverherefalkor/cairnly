-- Allow authenticated users to read their own access_codes rows.
--
-- Background: the only existing SELECT policy on access_codes is
-- "Admin can manage access codes", which means client-side queries from
-- normal users return zero rows. This blocked anything that needs to join
-- answers → access_codes from the client (e.g. the Profile page's
-- survey-derived pronoun/age pre-fill).
--
-- This policy only ADDS read access for rows where the user is the owner.
-- It does not loosen any existing protection — the admin policy and the
-- absence of write policies are untouched.

DROP POLICY IF EXISTS "Users can read their own access codes" ON public.access_codes;

CREATE POLICY "Users can read their own access codes"
  ON public.access_codes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
