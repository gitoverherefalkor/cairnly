-- rerun_report(report_id, dry_run, clear) — re-fire the n8n WF1→WF4 pipeline for an
-- existing report, server-side, without the manual "assemble the WF1 JSON and paste it
-- into the webhook" dance.
--
-- Why this exists: the n8n cloud host is not reachable from Claude Code web sessions
-- (network policy), but Postgres CAN reach it via the `http` extension. This reads the
-- report's stored payload (the 6-key envelope forward-to-n8n sends:
-- { responses, survey_id, accessCode, surveyType, completedAt, access_code_id }),
-- wraps it in the WF1 body, clears the old sections (so the pipeline, which inserts and
-- does not upsert, cannot append duplicates), flips status to 'processing', and POSTs the
-- live WF1 webhook.
--
-- Auth: SECURITY DEFINER + an internal admin gate. Callable from the browser only by the
-- Cairnly admin allowlist (matches the Ops dashboard's ADMIN_EMAILS); also allowed for
-- backend/no-JWT callers (direct SQL / service role). Granted to `authenticated` so the
-- Ops "Re-run a report" button can call it via supabase.rpc.
--
-- Usage:
--   SELECT rerun_report('<report_uuid>', true);        -- dry run: assemble + inspect, post nothing
--   SELECT rerun_report('<report_uuid>');               -- fire it (clears + regenerates in place)
--   SELECT rerun_report('<report_uuid>', false, false); -- fire WITHOUT clearing (will duplicate)
--
-- NOTE: triggers a real production pipeline run (AI credits, may email the user).

DROP FUNCTION IF EXISTS public.rerun_report(uuid, boolean);

CREATE OR REPLACE FUNCTION public.rerun_report(
  p_report_id uuid,
  p_dry_run boolean DEFAULT false,
  p_clear boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_payload jsonb;
  v_lang text;
  v_body jsonb;
  v_status int;
  v_deleted int := 0;
  -- Live WF1 "Survey complete Webhook2" (workflow 0Z8WxV5tVFMJqIZt). Keep in sync
  -- with the N8N_WEBHOOK_URL edge secret.
  v_webhook constant text := 'https://falkoratlas.app.n8n.cloud/webhook/28477bc7-d895-4b0e-bc45-a030312f6fcc';
BEGIN
  -- Admin gate: Cairnly admins via browser RPC, or backend/no-JWT callers (direct SQL / service role).
  IF NOT (
    coalesce(auth.jwt() ->> 'email','') IN ('sjoerd@cairnly.io','sjoerd@falkoratlas.com')
    OR auth.uid() IS NULL
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

  -- Replace semantics: clear regeneratable sections (keep chapter_1_feedback, which the
  -- pipeline does not regenerate). The brief empty window is covered by status='processing'.
  IF p_clear THEN
    DELETE FROM report_sections WHERE report_id = p_report_id AND section_type <> 'chapter_1_feedback';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  UPDATE reports SET status = 'processing' WHERE id = p_report_id;
  v_status := (extensions.http_post(v_webhook, v_body::text, 'application/json')).status;
  RETURN jsonb_build_object('ok', true, 'http_status', v_status, 'report_id', p_report_id,
    'cleared_sections', v_deleted, 'fired_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.rerun_report(uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rerun_report(uuid, boolean, boolean) TO authenticated;
