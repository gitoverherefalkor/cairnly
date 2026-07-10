-- Fixes for the retention purge shipped in 20260708170000_retention_and_survey_response_stats.sql.
--
-- Problems fixed:
--   1. The purge was keyed on user_id with a single per-user chat_completed_at,
--      so a user who finished chat A >30 days ago and then started a NEW
--      assessment (Starter/Encore/retake) had their in-progress chat B and
--      freshly submitted answers B purged the very next night. Eligibility now
--      requires that the user has NO report created after chat_completed_at
--      (i.e. no newer assessment in flight), and answers are only purged when
--      submitted at-or-before the completed chat.
--   2. DISTINCT ON (rep.id) could process the same answers row once per report,
--      double-inserting into survey_response_stats. Extraction is now keyed on
--      the answers row itself, so each row is processed exactly once.
--   3. The pronoun question was excluded by one hardcoded UUID; flavor surveys
--      mint new question UUIDs, so a future flavor's pronoun/gender question
--      would leak into the "anonymous" stats. A label-based guard now covers
--      any question whose label mentions pronouns or gender.
--   4. The eligible set grew forever (no "already purged" marker), so the
--      nightly cron rescanned every historical user against the chat tables.
--      user_engagement_tracking.data_purged_at now records the purge; a user
--      only becomes eligible again after a NEWER chat completes (wrap-up-save
--      now bumps chat_completed_at on every wrap-up for the same reason).
--   5. The function was SECURITY DEFINER with the default EXECUTE grant, i.e.
--      anonymously callable through PostgREST. Locked down like every other
--      definer function in this repo (see 20260616132000_security_advisor_followups.sql).
--   6. The delete/join columns had no indexes (chat_messages.user_id,
--      n8n_chat_histories.session_id, access_codes.user_id).
--
-- NOTE ON PARALLEL ENUMERATIONS: the set of user-data tables purged here must
-- stay in sync with delete_user_personal_data() (20260529120000) and
-- auto_cleanup_on_auth_user_delete (20260616130000). If you add a chat- or
-- answers-adjacent table, update all three.

-- 1. Supporting indexes for the nightly purge (and account-deletion paths).
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
  ON public.chat_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_chat_histories_session_id
  ON public.n8n_chat_histories (session_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_user_id
  ON public.access_codes (user_id);

-- 2. Purge bookkeeping: when this user's expired data was last purged.
ALTER TABLE public.user_engagement_tracking
  ADD COLUMN IF NOT EXISTS data_purged_at timestamptz;

-- 3. Corrected extraction + purge function.
CREATE OR REPLACE FUNCTION public.purge_expired_assessment_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Single source of truth for the retention window (privacy policy: 30 days
  -- after the coaching chat is completed).
  v_cutoff timestamptz := now() - interval '30 days';
  v_stats_inserted int := 0;
  v_answers_purged int := 0;
  v_chat_messages_purged int := 0;
  v_chat_histories_purged int := 0;
  v_users_purged int := 0;
BEGIN
  -- Eligible users: completed their chat more than 30 days ago, have not been
  -- purged since that completion, and have NO report created after the chat
  -- completed. That last predicate is the safety net for multi-assessment
  -- users (Starter/Encore/retakes): while a newer assessment exists, nothing
  -- is purged for them; once its chat wraps up, wrap-up-save bumps
  -- chat_completed_at and the 30-day clock restarts for everything.
  DROP TABLE IF EXISTS _purge_eligible_users;
  CREATE TEMP TABLE _purge_eligible_users ON COMMIT DROP AS
  SELECT t.user_id, t.chat_completed_at
  FROM public.user_engagement_tracking t
  WHERE t.chat_completed_at < v_cutoff
    AND (t.data_purged_at IS NULL OR t.data_purged_at < t.chat_completed_at)
    AND NOT EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.user_id = t.user_id
        AND r.created_at > t.chat_completed_at
    );

  -- ---- Step 1: extract anonymized MC/ranking stats, then null raw answers ----
  -- Keyed on the answers row itself (not reports), so each row is extracted
  -- and nulled exactly once, and only when it belongs to the completed chat's
  -- assessment (submitted at-or-before chat completion).
  WITH eligible_answers AS (
    SELECT
      a.id AS answer_id,
      a.payload,
      p.pronouns,
      p.age_range,
      p.country,
      p.preferred_language
    FROM _purge_eligible_users eu
    JOIN public.access_codes ac ON ac.user_id = eu.user_id
    JOIN public.answers a ON a.access_code_id = ac.id
    JOIN public.profiles p ON p.id = eu.user_id
    WHERE a.status = 'submitted'
      AND a.payload <> '{}'::jsonb
      AND a.submitted_at <= eu.chat_completed_at
  ),
  extracted AS (
    INSERT INTO public.survey_response_stats
      (question_id, response_value, gender, age_range, region, report_language)
    SELECT
      q.id,
      elem,
      ea.pronouns,
      ea.age_range,
      ea.country,
      ea.preferred_language
    FROM eligible_answers ea
    CROSS JOIN LATERAL jsonb_each(ea.payload) AS kv(key, value)
    JOIN public.questions q
      ON q.id::text = kv.key
      AND q.type IN ('multiple_choice', 'ranking')
      -- Pronoun/gender questions duplicate the gender segmentation axis and
      -- must never land in the stats table. The UUID pins the main survey's
      -- pronoun question; the label guards cover flavor surveys, whose
      -- questions get fresh UUIDs.
      AND q.id <> '11111111-1111-1111-1111-11111111111b'
      AND q.label NOT ILIKE '%pronoun%'
      AND q.label NOT ILIKE '%gender%'
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE jsonb_typeof(kv.value)
        WHEN 'array' THEN kv.value
        ELSE jsonb_build_array(kv.value)
      END
    ) AS elem
    RETURNING 1
  ),
  nulled AS (
    -- answers.payload is NOT NULL, so "purged" is represented as an empty object.
    UPDATE public.answers a
    SET payload = '{}'::jsonb
    FROM eligible_answers ea
    WHERE a.id = ea.answer_id
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM extracted),
    (SELECT count(*) FROM nulled)
  INTO v_stats_inserted, v_answers_purged;

  -- ---- Step 2: purge chat transcripts ----
  -- Per-user deletes are safe here because eligibility already excludes any
  -- user with an assessment newer than the completed chat.
  WITH purged_messages AS (
    DELETE FROM public.chat_messages cm
    USING _purge_eligible_users eu
    WHERE cm.user_id = eu.user_id
    RETURNING 1
  ),
  purged_histories AS (
    DELETE FROM public.n8n_chat_histories h
    USING _purge_eligible_users eu
    WHERE h.session_id = eu.user_id::text
       OR h.session_id IN (
            SELECT r.id::text FROM public.reports r WHERE r.user_id = eu.user_id
          )
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM purged_messages),
    (SELECT count(*) FROM purged_histories)
  INTO v_chat_messages_purged, v_chat_histories_purged;

  -- ---- Step 3: mark these users as purged so the nightly cron stops rescanning them ----
  UPDATE public.user_engagement_tracking t
  SET data_purged_at = now()
  FROM _purge_eligible_users eu
  WHERE t.user_id = eu.user_id;
  GET DIAGNOSTICS v_users_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'users_purged', v_users_purged,
    'stats_inserted', v_stats_inserted,
    'answers_purged', v_answers_purged,
    'chat_messages_purged', v_chat_messages_purged,
    'chat_histories_purged', v_chat_histories_purged
  );
END;
$$;

-- 4. Lock the definer function down: cron runs it as postgres (bypasses
-- grants); nothing else should be able to call it through the API.
REVOKE ALL ON FUNCTION public.purge_expired_assessment_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_expired_assessment_data() FROM anon, authenticated;
