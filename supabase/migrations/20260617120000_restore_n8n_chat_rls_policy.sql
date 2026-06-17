-- Fix: restore the WF5 "Cairnly Coach" after enabling RLS on n8n_chat_histories
-- (migration 20260616131000) broke n8n's writes with
-- "new row violates row-level security policy for table n8n_chat_histories".
--
-- Root cause: n8n's Postgres Chat Memory node connects as the dedicated role
-- `n8n_chat_user`. Unlike postgres / service_role (which have rolbypassrls), that
-- role IS subject to RLS, so with RLS enabled and no policy its INSERT/SELECT
-- were rejected. Add a policy granting n8n_chat_user full access. anon /
-- authenticated still have no policy, so the public API stays locked out; we also
-- revoke their leftover table grants as defense-in-depth (this is a backend-only
-- table — the frontend never queries it directly).

CREATE POLICY "n8n_chat_user manages chat memory"
  ON public.n8n_chat_histories
  FOR ALL
  TO n8n_chat_user
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.n8n_chat_histories FROM anon, authenticated;
