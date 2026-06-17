-- Security fix: enable RLS on two public tables flagged ERROR-level by the
-- Supabase advisors (rls_disabled_in_public + sensitive_columns_exposed).
--
-- Both grant the anon/authenticated API roles full SELECT/INSERT/UPDATE/DELETE
-- (the Supabase default) while RLS was OFF, so anyone holding the public anon
-- key could read/edit/delete every row. They are only ever accessed by backend
-- roles — n8n via its direct Postgres (owner) connection and edge functions via
-- service_role — both of which bypass RLS, so enabling RLS with no policy simply
-- locks out the public API roles without affecting the app.

-- AI coach chat transcripts (n8n LangChain memory): session_id + message content.
ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;

-- Stale one-row manual backup of a survey answer. Sensitive payload, no
-- production use. Locked down here; should be dropped entirely (see follow-up).
ALTER TABLE public._backup_natasha_answer_e3811cc8 ENABLE ROW LEVEL SECURITY;
