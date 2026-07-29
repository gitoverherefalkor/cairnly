-- Security hardening: close anonymous access to admin/ops RPCs and remove
-- leftover report backup tables that were readable with the public anon key.
--
-- Findings this addresses (Supabase security advisor, 2026-07-29):
--   1. `report_sections_backup_perso_20260710` and
--      `report_sections_backup_careers_20260710` had RLS disabled while sitting
--      in the `public` schema, so anyone holding the anon key (it ships in the
--      frontend bundle by design) could read customer report content through
--      PostgREST. They are one-off backups from the 2026-07-10 migration and
--      are no longer needed.
--   2. `rerun_report`, `rerun_report_by_email` and `call_forward_to_relevance`
--      were EXECUTE-able by the `anon` role.
--   3. Worse than the grant: the admin guard inside the two rerun functions
--      read `... OR auth.uid() IS NULL`. That was meant to let a human run them
--      from the SQL editor, but an anonymous PostgREST request also has a NULL
--      auth.uid(), so the guard actively *allowed* unauthenticated callers to
--      fire a full report regeneration against the WF1 n8n webhook. Both the
--      grant and the guard are fixed here so neither alone is load-bearing.

-- 1. Drop the stale backup tables ------------------------------------------

DROP TABLE IF EXISTS public.report_sections_backup_perso_20260710;
DROP TABLE IF EXISTS public.report_sections_backup_careers_20260710;

-- 2. Tighten the admin guard on the rerun functions -------------------------
-- The SQL-editor escape hatch now keys off the *request role* rather than the
-- absence of a user: direct psql / SQL editor / pg_cron calls have no
-- `request.jwt.claims` at all (empty role), while an anonymous PostgREST call
-- carries role 'anon' and is now rejected.

CREATE OR REPLACE FUNCTION public.rerun_report(
  p_report_id uuid,
  p_dry_run boolean DEFAULT false,
  p_clear boolean DEFAULT true,
  p_reset_chat boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user_id uuid;
  v_payload jsonb;
  v_lang text;
  v_body jsonb;
  v_status int;
  v_deleted int := 0;
  v_req_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_webhook constant text := 'https://falkoratlas.app.n8n.cloud/webhook/28477bc7-d895-4b0e-bc45-a030312f6fcc';
BEGIN
  IF NOT (
    coalesce(auth.jwt() ->> 'email','') IN ('sjoerd@cairnly.io','sjoerd@falkoratlas.com')
    OR v_req_role = 'service_role'  -- server-side callers (edge functions, cron)
    OR v_req_role = ''              -- direct SQL: psql, SQL editor, pg_cron
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authorized');
  END IF;

  SELECT user_id, payload INTO v_user_id, v_payload FROM reports WHERE id = p_report_id;
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'report not found'); END IF;
  IF v_payload IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'report has no stored payload'); END IF;

  SELECT coalesce(preferred_language,'en') INTO v_lang FROM profiles WHERE id = v_user_id;
  v_lang := coalesce(v_lang,'en');

  v_body := jsonb_build_object(
    'user_id', v_user_id, 'report_id', p_report_id, 'preferred_language', v_lang,
    'survey_responses', v_payload, 'created_at', now(), 'processing_status', 'started'
  );

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'would_post_to', v_webhook,
      'survey_responses_keys', (SELECT count(*) FROM jsonb_object_keys(v_payload->'responses')),
      'preferred_language', v_lang, 'user_id', v_user_id);
  END IF;

  -- Clear regeneratable sections so the pipeline can't append duplicates (keep chapter_1_feedback).
  IF p_clear THEN
    DELETE FROM report_sections WHERE report_id = p_report_id AND section_type <> 'chapter_1_feedback';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  -- Reset the chat so the user gets a FRESH session on the regenerated report, not the
  -- stale finished conversation. Clears the UI history, the agent memory (session_id =
  -- report_id), and the chat progress flags so the app doesn't resume a completed chat.
  IF p_reset_chat THEN
    DELETE FROM chat_messages WHERE report_id = p_report_id;
    DELETE FROM n8n_chat_histories WHERE session_id = p_report_id::text;
    UPDATE user_engagement_tracking
       SET chat_started_at = NULL, chat_last_activity_at = NULL, chat_completed_at = NULL,
           chat_last_section_index = NULL, chat_reminder_sent_at = NULL,
           dashboard_visited_after_chat_at = NULL
     WHERE user_id = v_user_id;
  END IF;

  UPDATE reports SET status = 'processing' WHERE id = p_report_id;
  v_status := (extensions.http_post(v_webhook, v_body::text, 'application/json')).status;
  RETURN jsonb_build_object('ok', true, 'http_status', v_status, 'report_id', p_report_id,
    'cleared_sections', v_deleted, 'chat_reset', p_reset_chat, 'fired_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.rerun_report_by_email(
  p_email text,
  p_dry_run boolean DEFAULT false,
  p_clear boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_name text;
  v_report_id uuid;
  v_req_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
BEGIN
  IF NOT (
    coalesce(auth.jwt() ->> 'email','') IN ('sjoerd@cairnly.io','sjoerd@falkoratlas.com')
    OR v_req_role = 'service_role'
    OR v_req_role = ''
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authorized');
  END IF;

  SELECT id, trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
    INTO v_uid, v_name
  FROM profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no user with that email');
  END IF;

  SELECT id INTO v_report_id FROM reports WHERE user_id = v_uid ORDER BY created_at DESC LIMIT 1;
  IF v_report_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user has no report', 'matched_name', v_name);
  END IF;

  RETURN public.rerun_report(v_report_id, p_dry_run, p_clear)
         || jsonb_build_object('matched_email', lower(trim(p_email)), 'matched_name', v_name, 'report_id', v_report_id);
END;
$function$;

-- 3. Revoke the anon EXECUTE grants -----------------------------------------
-- Postgres grants EXECUTE to PUBLIC on new functions by default, which is how
-- `anon` inherited it. Revoke from PUBLIC + anon, then re-grant explicitly to
-- the roles that legitimately call these.

REVOKE EXECUTE ON FUNCTION public.rerun_report(uuid, boolean, boolean, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rerun_report_by_email(text, boolean, boolean) FROM PUBLIC, anon;

-- The Ops dashboard (src/pages/Ops.tsx) calls both as a logged-in admin; the
-- in-function email allowlist is what restricts it to admins.
GRANT EXECUTE ON FUNCTION public.rerun_report(uuid, boolean, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rerun_report_by_email(text, boolean, boolean) TO authenticated, service_role;

-- Trigger function, never called over the API. Trigger execution does not
-- depend on the caller holding EXECUTE, so this is safe to lock down fully.
REVOKE EXECUTE ON FUNCTION public.call_forward_to_relevance() FROM PUBLIC, anon, authenticated;
