-- rerun_report(report_id, dry_run) — re-fire the n8n WF1 pipeline for an existing
-- report, server-side, without the manual "assemble the WF1 JSON and paste it into
-- the webhook" dance.
--
-- Why this exists: the n8n cloud host is not reachable from Claude Code web sessions
-- (network policy), but Postgres CAN reach it via the `http` extension. This function
-- reads the report's stored payload (the same 6-key envelope forward-to-n8n sends:
-- { responses, survey_id, accessCode, surveyType, completedAt, access_code_id }),
-- wraps it in the WF1 body, flips the report to 'processing', and POSTs the live WF1
-- webhook. Call it with one report_id — no copy-paste, no key handling.
--
-- Usage:
--   SELECT rerun_report('<report_uuid>', true);   -- dry run: assemble + inspect, post nothing
--   SELECT rerun_report('<report_uuid>');          -- fire it (overwrites the report in place)
--
-- NOTE: this triggers a real production pipeline run (AI credits, and may email the
-- user a "report ready" notice). Intended for admin/beta use. Currently ungated
-- (single-operator). If exposed via RPC later, add an admin check first.

CREATE OR REPLACE FUNCTION public.rerun_report(p_report_id uuid, p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_payload jsonb;
  v_lang text;
  v_body jsonb;
  v_status int;
  -- Live WF1 "Survey complete Webhook2" (workflow 0Z8WxV5tVFMJqIZt). Keep in sync
  -- with the N8N_WEBHOOK_URL edge secret.
  v_webhook constant text := 'https://falkoratlas.app.n8n.cloud/webhook/28477bc7-d895-4b0e-bc45-a030312f6fcc';
BEGIN
  SELECT user_id, payload INTO v_user_id, v_payload FROM reports WHERE id = p_report_id;
  IF NOT FOUND OR v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'report not found');
  END IF;
  IF v_payload IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'report has no stored payload');
  END IF;

  SELECT COALESCE(preferred_language, 'en') INTO v_lang FROM profiles WHERE id = v_user_id;
  v_lang := COALESCE(v_lang, 'en');

  v_body := jsonb_build_object(
    'user_id', v_user_id,
    'report_id', p_report_id,
    'preferred_language', v_lang,
    'survey_responses', v_payload,
    'created_at', now(),
    'processing_status', 'started'
  );

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'ok', true, 'dry_run', true,
      'would_post_to', v_webhook,
      'body_keys', (SELECT array_agg(k) FROM jsonb_object_keys(v_body) k),
      'survey_responses_keys', (SELECT count(*) FROM jsonb_object_keys(v_payload->'responses')),
      'preferred_language', v_lang,
      'user_id', v_user_id
    );
  END IF;

  UPDATE reports SET status = 'processing' WHERE id = p_report_id;
  v_status := (extensions.http_post(v_webhook, v_body::text, 'application/json')).status;
  RETURN jsonb_build_object('ok', true, 'http_status', v_status, 'report_id', p_report_id, 'fired_at', now());
END;
$$;
