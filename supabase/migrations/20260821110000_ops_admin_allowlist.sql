-- One admin allowlist for the database side.
--
-- The list of Ops admins was pasted into four places: src/lib/admins.ts, three
-- edge functions, and the two rerun_report* SQL functions. They drifted:
-- src/lib/admins.ts carried sjoerd@bethehitl.com while ops-feed and
-- ops-marketing did not, so signing in with that address rendered the Ops
-- console and then 403'd on every call it made.
--
-- The TypeScript side now imports supabase/functions/_shared/admins.ts, guarded
-- by src/lib/admins.test.ts. This migration does the same for the database:
-- is_ops_admin() holds the list, and both rerun_report functions call it.
--
-- Adding an admin is now two edits, both version-controlled: the shared TS file
-- and this function.
--
-- The function bodies below are the LIVE definitions read back from production
-- (which had already diverged from their original migrations via the
-- 20260729120000 hardening pass). Only the authorization line changed.

CREATE OR REPLACE FUNCTION public.is_ops_admin(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(trim(coalesce(p_email, ''))) IN (
    'sjn.geurts@gmail.com',
    'sjoerd@bethehitl.com',
    'sjoerd@cairnly.io',
    'sjoerd@falkoratlas.com'
  );
$$;

COMMENT ON FUNCTION public.is_ops_admin(TEXT) IS
  'Ops admin allowlist for SQL-side gates. Mirrors supabase/functions/_shared/admins.ts.';

CREATE OR REPLACE FUNCTION public.rerun_report(p_report_id uuid, p_dry_run boolean DEFAULT false, p_clear boolean DEFAULT true, p_reset_chat boolean DEFAULT true)
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
    public.is_ops_admin(auth.jwt() ->> 'email')
    OR v_req_role = 'service_role'
    OR v_req_role = ''
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

  IF p_clear THEN
    DELETE FROM report_sections WHERE report_id = p_report_id AND section_type <> 'chapter_1_feedback';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

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

CREATE OR REPLACE FUNCTION public.rerun_report_by_email(p_email text, p_dry_run boolean DEFAULT false, p_clear boolean DEFAULT true)
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
    public.is_ops_admin(auth.jwt() ->> 'email')
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
