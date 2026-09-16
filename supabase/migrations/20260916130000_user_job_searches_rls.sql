-- RLS and index on user_job_searches, becoming the credit ledger for the
-- job-search free tier: 4 free searches per report (one search = one career
-- that reaches n8n), unlimited once a user has a referral or a comp.
--
-- WHAT THIS TABLE BECOMES
-- ------------------------
-- user_job_searches has existed since the account-deletion RPCs were written
-- (20260529120000_delete_user_personal_data.sql and
-- 20260616130000_auto_cleanup_on_auth_user_delete.sql both DELETE FROM it on
-- account deletion) but nothing has ever written to it otherwise — a grep of
-- src/ for `.from('user_job_searches')` returns zero results. A later task
-- wires search-jobs/index.ts to write one row per career that actually
-- reaches n8n: search_status = 'charged' counts against the free tier,
-- 'cached' is a free cache hit (job_search_cache already had a fresh result)
-- and does not count. The browser reads this table, SELECT only, to show a
-- remaining-credits counter.
--
-- WHAT WAS ALREADY THERE (found by inspection before writing this migration)
-- ----------------------------------------------------------------------
-- - RLS was already ON (relrowsecurity = true).
-- - Columns already match what the ledger needs: user_id, report_id,
--   career_title, section_type, country_code, location, search_status
--   (text, NOT NULL, default 'pending'), created_at, updated_at.
-- - Three policies already existed, all `TO public` (so they apply to
--   `authenticated`; for an anonymous request auth.uid() is NULL, so
--   `auth.uid() = user_id` matches zero rows and none of this is reachable
--   by `anon` — same reasoning as the profiles migrations just before this
--   one):
--
--     "Users can view own job searches"    SELECT  USING (auth.uid() = user_id)
--     "Users can insert own job searches"  INSERT  WITH CHECK (auth.uid() = user_id)
--     "Users can update own job searches"  UPDATE  USING (auth.uid() = user_id)
--
-- THE SELECT POLICY IS EXACTLY RIGHT, LEFT AS-IS
-- -----------------------------------------------
-- It is precisely the "authenticated may read their own rows" policy this
-- table needs for the credits counter. Not dropped and recreated, so there
-- is never a moment where the browser has nothing to read.
--
-- THE INSERT AND UPDATE POLICIES CONFLICT WITH A CREDIT LEDGER, DROPPED
-- ------------------------------------------------------------------------
-- The UPDATE policy has no WITH CHECK, so a user who owns a row could
-- rewrite search_status to anything (no CHECK constraint on the column
-- either) — including flipping a 'charged' row back to 'cached', which
-- zeroes out their own charged count. That is the same "reset my own credit
-- counter" attack a DELETE policy would enable; it is just reachable through
-- UPDATE instead, since this table was never given a DELETE policy for
-- `authenticated` in the first place. The INSERT policy lets a user write
-- arbitrary rows for themselves (only user_id is constrained by the policy:
-- report_id, career_title, section_type, country_code and search_status are
-- all caller-chosen) entirely outside the edge function's control.
--
-- THESE TWO POLICIES ARE UNUSED SCAFFOLD, NOT A FEATURE ANYONE RELIES ON
-- ------------------------------------------------------------------------
-- Verified before dropping: zero `.from('user_job_searches')` call sites of
-- any kind anywhere in src/ today, so nothing in the live app exercises
-- either policy, and the table itself has zero rows (`select count(*)` = 0)
-- — it has never been written to by anything, ever. They read as leftover
-- scaffold policies from whenever this table was first created, not a
-- feature. The ONLY writer, going forward, is the search-jobs edge function,
-- running as service_role. Recorded here explicitly so nobody "restores"
-- these two later as an apparent omission: their absence is the point.
--
-- Same shape as the two profiles lockdown migrations immediately before this
-- one in the same branch (20260916110000_lock_profiles_columns.sql,
-- 20260916120000_lock_profiles_insert_delete.sql): a permissive policy
-- nobody uses, closed before it becomes exploitable, now that this table is
-- about to gate a paid feature.
DROP POLICY "Users can insert own job searches" ON public.user_job_searches;
DROP POLICY "Users can update own job searches" ON public.user_job_searches;

-- DROPPING THE POLICIES ALONE IS NOT ENOUGH
-- ------------------------------------------
-- RLS enabled + no permissive policy for a command denies that command
-- TODAY, but that is a loaded gun: the day anyone adds ANY insert/update
-- policy to this table for any reason, the unrestricted table-level grant
-- still sitting underneath it makes this hole live again instantly, with no
-- second check to catch it. Same two-layer fix as
-- 20260916120000_lock_profiles_insert_delete.sql: take the grant, not just
-- the policy.
--
-- Checked before revoking (information_schema.role_table_grants):
--   authenticated  had the full default set: SELECT/INSERT/UPDATE/DELETE/...
--   anon           had the same full default set
--   service_role   had the same full default set (and bypasses RLS anyway)
--   postgres       owns the table (all privileges, grantable)
--   n8n_chat_user  ALSO had the same full default set — a role this task
--                  didn't expect, presumably n8n's direct Postgres
--                  connection. Not touched by this migration: it was never
--                  reachable through these two RLS policies either (no
--                  auth.uid() in that context, same as anon below), and
--                  with RLS on and no policy left for it after this
--                  migration, it is denied by default like anon is.
--
-- authenticated is narrowed to SELECT only, which is all the credits
-- counter needs:
REVOKE INSERT, UPDATE, DELETE ON public.user_job_searches FROM authenticated;

-- anon's grant is deliberately left untouched, not a second door: for an
-- anonymous request auth.uid() is NULL, so `auth.uid() = user_id` in the
-- surviving SELECT policy matches zero rows, and after this migration there
-- is no other policy anon could use either. RLS on + no applicable policy =
-- denied, exactly like n8n_chat_user above. Narrowing the grant too would be
-- noise, not a second layer of protection — identical reasoning to the anon
-- grant left alone in both profiles migrations just before this one.
--
-- No INSERT/UPDATE/DELETE policy for `authenticated` remains after the two
-- drops above, and none is added back. That is deliberate: only SELECT, so
-- a user can watch their own credit count but never move it.
--
-- An explicit service_role policy is not strictly required (the service role
-- already bypasses RLS by default in Supabase) but is added anyway as
-- belt-and-braces documentation, matching the style already used elsewhere
-- in this schema (e.g. "Service role can insert report sections" on
-- report_sections).
CREATE POLICY "Service role can manage job searches"
  ON public.user_job_searches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Backs the credit-count query the gate runs on every search-jobs call:
-- "how many charged rows does this report have?" —
--   select count(*) from user_job_searches
--   where report_id = $1 and search_status = 'charged'
CREATE INDEX idx_user_job_searches_report_status
  ON public.user_job_searches (report_id, search_status);

COMMENT ON TABLE public.user_job_searches IS
  'Credit ledger for the job-search free tier: one row per user + report + career + country. search_status is ''charged'' (the search reached n8n, i.e. triggered an Apify LinkedIn scrape plus AI scoring, and counts against the 4-per-report free tier) or ''cached'' (job_search_cache already had a fresh result for this signature, so it was free and does not count). Only the search-jobs edge function, running as service_role, writes this table. Authenticated users may only SELECT their own rows — no INSERT/UPDATE/DELETE policy exists for them, deliberately, so a user cannot reset their own credit count by deleting or rewriting rows.';
