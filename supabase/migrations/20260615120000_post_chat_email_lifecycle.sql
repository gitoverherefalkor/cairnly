-- =============================================================================
-- Post-chat email lifecycle
--   * New dedup columns for the dashboard-ready + referral-unlock emails
--   * check_and_send_reminders rewrite: removes the flaky report_not_viewed
--     reminder, adds A0 (dashboard ready), A1/A2 (unlock nudges), and the
--     referral progression + refund follow-ups.
-- Pre-chat reminders (signup / survey_abandoned / chat_not_completed) are
-- unchanged. No n8n changes.
-- =============================================================================

-- 1. New dedup columns (all nullable, additive) ------------------------------
ALTER TABLE public.user_engagement_tracking
  ADD COLUMN IF NOT EXISTS dashboard_ready_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlock_nudge_1_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlock_nudge_2_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_progression_nudge_count INT,
  ADD COLUMN IF NOT EXISTS refund_unlock_email_sent_at TIMESTAMPTZ;

-- 2. Reminder check function -------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_send_reminders()
RETURNS void AS $$
DECLARE
  edge_function_url TEXT := 'https://pcoyafgsirrznhmdaiji.supabase.co/functions/v1/send-reminder-email';
  service_role_key TEXT;
  signup_users JSONB;
  survey_users JSONB;
  chat_users JSONB;
  dash_users JSONB;
  nudge1_users JSONB;
  nudge2_users JSONB;
  prog_users JSONB;
  refund_users JSONB;
BEGIN
  -- Read key from Supabase Vault (encrypted at rest, only accessible to SECURITY DEFINER)
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'service_role_key not found in vault — skipping reminders';
    RETURN;
  END IF;

  -- ===== Reminder 1: Signed up but never started survey (24h after signup) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', p.email,
    'first_name', COALESCE(p.first_name, 'there')
  )), '[]'::jsonb)
  INTO signup_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.survey_started_at IS NULL
    AND t.signup_reminder_sent_at IS NULL
    AND t.created_at < NOW() - INTERVAL '24 hours'
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL;

  IF jsonb_array_length(signup_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'signup_no_start', 'users', signup_users),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    UPDATE public.user_engagement_tracking
    SET signup_reminder_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (
      SELECT (u->>'user_id')::uuid
      FROM jsonb_array_elements(signup_users) u
    );
  END IF;

  -- ===== Reminder 2: Survey abandoned (24h after last activity, not completed) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'survey_last_section', t.survey_last_section,
    'survey_total_sections', t.survey_total_sections
  )), '[]'::jsonb)
  INTO survey_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.survey_started_at IS NOT NULL
    AND t.survey_completed_at IS NULL
    AND t.survey_reminder_sent_at IS NULL
    AND t.survey_last_activity_at < NOW() - INTERVAL '24 hours'
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL;

  IF jsonb_array_length(survey_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'survey_abandoned', 'users', survey_users),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    UPDATE public.user_engagement_tracking
    SET survey_reminder_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (
      SELECT (u->>'user_id')::uuid
      FROM jsonb_array_elements(survey_users) u
    );
  END IF;

  -- ===== Reminder 3: Chat not completed (24h after last activity or survey complete) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'chat_last_section_index', COALESCE(t.chat_last_section_index, -1)
  )), '[]'::jsonb)
  INTO chat_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.survey_completed_at IS NOT NULL
    AND t.chat_completed_at IS NULL
    AND t.chat_reminder_sent_at IS NULL
    AND (
      (t.chat_last_activity_at IS NOT NULL AND t.chat_last_activity_at < NOW() - INTERVAL '24 hours')
      OR
      (t.chat_started_at IS NULL AND t.survey_completed_at < NOW() - INTERVAL '24 hours')
    )
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL;

  IF jsonb_array_length(chat_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'chat_not_completed', 'users', chat_users),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    UPDATE public.user_engagement_tracking
    SET chat_reminder_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (
      SELECT (u->>'user_id')::uuid
      FROM jsonb_array_elements(chat_users) u
    );
  END IF;

  -- NOTE: the old "Reminder 4: report_not_viewed" block is intentionally removed.
  -- It produced false "you haven't viewed your report" emails (flaky client-side
  -- dashboard-visit tracking). Replaced by the dashboard-ready + unlock lifecycle.

  -- ===== A0: Dashboard ready (exec_summary exists = WF7 done, or 24h fallback) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', p.email,
    'first_name', COALESCE(p.first_name, 'there')
  )), '[]'::jsonb)
  INTO dash_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.chat_completed_at IS NOT NULL
    AND t.dashboard_ready_sent_at IS NULL
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.reports r
        JOIN public.report_sections s ON s.report_id = r.id
        WHERE r.user_id = t.user_id AND s.section_type = 'exec_summary'
      )
      OR t.chat_completed_at < NOW() - INTERVAL '24 hours'
    );

  IF jsonb_array_length(dash_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'dashboard_ready', 'users', dash_users),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    UPDATE public.user_engagement_tracking
    SET dashboard_ready_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (
      SELECT (u->>'user_id')::uuid
      FROM jsonb_array_elements(dash_users) u
    );
  END IF;

  -- ===== A1: Unlock nudge #1 (2 days after dashboard_ready, 0 converted referrals) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'nudge', 1,
    'referral_code', p.referral_code,
    'top_role', (
      SELECT s.title FROM public.reports r
      JOIN public.report_sections s ON s.report_id = r.id
      WHERE r.user_id = t.user_id AND s.section_type = 'top_career_1'
      ORDER BY s.created_at DESC LIMIT 1
    )
  )), '[]'::jsonb)
  INTO nudge1_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.dashboard_ready_sent_at IS NOT NULL
    AND t.dashboard_ready_sent_at < NOW() - INTERVAL '2 days'
    AND t.unlock_nudge_1_sent_at IS NULL
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id);

  IF jsonb_array_length(nudge1_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'unlock_nudge', 'users', nudge1_users),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    UPDATE public.user_engagement_tracking
    SET unlock_nudge_1_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (
      SELECT (u->>'user_id')::uuid
      FROM jsonb_array_elements(nudge1_users) u
    );
  END IF;

  -- ===== A2: Unlock nudge #2 (4 days after nudge #1, still 0 converted referrals) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'nudge', 2,
    'referral_code', p.referral_code,
    'top_role', (
      SELECT s.title FROM public.reports r
      JOIN public.report_sections s ON s.report_id = r.id
      WHERE r.user_id = t.user_id AND s.section_type = 'top_career_1'
      ORDER BY s.created_at DESC LIMIT 1
    )
  )), '[]'::jsonb)
  INTO nudge2_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.unlock_nudge_1_sent_at IS NOT NULL
    AND t.unlock_nudge_1_sent_at < NOW() - INTERVAL '4 days'
    AND t.unlock_nudge_2_sent_at IS NULL
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id);

  IF jsonb_array_length(nudge2_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'unlock_nudge', 'users', nudge2_users),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    UPDATE public.user_engagement_tracking
    SET unlock_nudge_2_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (
      SELECT (u->>'user_id')::uuid
      FROM jsonb_array_elements(nudge2_users) u
    );
  END IF;

  -- ===== B1: Progression next-tool (1 or 2 converted referrals, stalled 3 days) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'variant', 'next_tool',
    'current_count', rc.cnt,
    'referral_code', p.referral_code,
    'top_role', (
      SELECT s.title FROM public.reports r
      JOIN public.report_sections s ON s.report_id = r.id
      WHERE r.user_id = t.user_id AND s.section_type = 'top_career_1'
      ORDER BY s.created_at DESC LIMIT 1
    )
  )), '[]'::jsonb)
  INTO prog_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  JOIN LATERAL (
    SELECT count(*)::int AS cnt, max(created_at) AS last_at
    FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id
  ) rc ON TRUE
  WHERE rc.cnt IN (1, 2)
    AND rc.last_at < NOW() - INTERVAL '3 days'
    AND (t.referral_progression_nudge_count IS DISTINCT FROM rc.cnt)
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL;

  IF jsonb_array_length(prog_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'referral_progression', 'users', prog_users),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    UPDATE public.user_engagement_tracking t
    SET referral_progression_nudge_count = (
      SELECT count(*)::int FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id
    ), updated_at = NOW()
    WHERE t.user_id IN (
      SELECT (u->>'user_id')::uuid
      FROM jsonb_array_elements(prog_users) u
    );
  END IF;

  -- ===== B2: Refund unlock (3+ converted referrals, stalled 3 days, send once) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'variant', 'refund',
    'referral_code', p.referral_code
  )), '[]'::jsonb)
  INTO refund_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  JOIN LATERAL (
    SELECT count(*)::int AS cnt, max(created_at) AS last_at
    FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id
  ) rc ON TRUE
  WHERE rc.cnt >= 3
    AND rc.last_at < NOW() - INTERVAL '3 days'
    AND t.refund_unlock_email_sent_at IS NULL
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL;

  IF jsonb_array_length(refund_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'referral_progression', 'users', refund_users),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )
    );

    UPDATE public.user_engagement_tracking
    SET refund_unlock_email_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (
      SELECT (u->>'user_id')::uuid
      FROM jsonb_array_elements(refund_users) u
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
