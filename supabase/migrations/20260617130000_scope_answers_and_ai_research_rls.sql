-- Security fix (2026-06-17 audit, tech-debt item #9): lock down public read/write
-- on the two tables that still carried permissive "USING (true)" policies.
--
-- answers.payload (jsonb) is the most sensitive PII in the app: every survey
-- response. RLS was already ENABLED, but a leftover "Allow public select on
-- answers" USING (true) let anyone holding the public anon key dump every row
-- via GET /rest/v1/answers. A matching "Allow public update on answers"
-- USING (true) let anyone edit any row, and three duplicate public INSERT
-- policies existed. The Supabase advisor ignores permissive SELECT policies, so
-- the linter never flagged this — it was found by hand.
--
-- The survey is gated behind authentication (the /assessment page redirects to
-- /auth when there is no user) and every access code is linked to its owner
-- (access_codes.user_id) by signup/verify time. So although `answers` has no
-- user_id column, the caller always has a JWT and we can scope ownership through
-- the access_codes join. No edge function or frontend change is required.
--
-- After this migration:
--   * anon role            -> no policy applies -> denied (the leak is closed)
--   * authenticated role   -> read/insert/update ONLY answers whose access_code
--                             belongs to them
--   * service_role / n8n   -> bypass RLS entirely (unchanged)

-- ---------------------------------------------------------------------------
-- Ownership helper. SECURITY DEFINER so the access_codes lookup is NOT re-
-- filtered by access_codes' own RLS (robust to future policy changes), and
-- STABLE so the planner can cache it per statement. search_path is pinned to
-- prevent search-path hijacking. Returns false for anon (auth.uid() is null).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_owns_access_code(p_code_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.access_codes
    WHERE id = p_code_id
      AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.user_owns_access_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_owns_access_code(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- answers: drop the permissive / duplicate / no-op policies, add ownership-
-- scoped ones. RLS is already enabled on this table.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public select on answers"       ON public.answers;
DROP POLICY IF EXISTS "Only service role can read responses" ON public.answers;
DROP POLICY IF EXISTS "Allow public update on answers"       ON public.answers;
DROP POLICY IF EXISTS "Allow public insert on answers"       ON public.answers;
DROP POLICY IF EXISTS "Anyone can submit survey responses"   ON public.answers;
DROP POLICY IF EXISTS "Public can insert answers"            ON public.answers;

CREATE POLICY "Users read own answers"
  ON public.answers
  FOR SELECT
  TO authenticated
  USING (public.user_owns_access_code(access_code_id));

CREATE POLICY "Users insert own answers"
  ON public.answers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_owns_access_code(access_code_id));

CREATE POLICY "Users update own answers"
  ON public.answers
  FOR UPDATE
  TO authenticated
  USING (public.user_owns_access_code(access_code_id))
  WITH CHECK (public.user_owns_access_code(access_code_id));

-- No DELETE policy: answer deletion happens only through the service-role
-- delete-user-data edge function, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- ai_research: reference/citation data written only by n8n WF2 (via the direct
-- Postgres/owner connection, which bypasses RLS). Nothing in the app reads or
-- writes it. Drop the permissive public-read + authenticated insert/update
-- policies so it is backend-only. RLS is already enabled.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access"   ON public.ai_research;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.ai_research;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.ai_research;
