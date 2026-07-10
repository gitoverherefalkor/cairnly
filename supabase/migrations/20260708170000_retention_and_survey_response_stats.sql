-- Data retention: raw survey answers and chat transcripts are deleted 30
-- days after a user finishes their coaching chat (chat_completed_at on
-- user_engagement_tracking). Reports, report_sections (scores, narratives,
-- and the chat wrap-up highlights) are NEVER touched here — those stay for
-- as long as the account exists.
--
-- Before deleting raw answers, we extract an anonymous aggregate: one row
-- per selected multiple_choice/ranking option, tagged with coarse
-- demographic buckets (pronouns, age_range, country) already collected on
-- profiles. No user_id/access_code_id/report_id is ever stored here, so a
-- row can never be traced back to a person.
--
-- Both purges are strictly gated on chat_completed_at IS NOT NULL — if a
-- user never wraps up their chat, nothing is auto-deleted for them.

-- 1. Anonymous aggregate table.
CREATE TABLE IF NOT EXISTS public.survey_response_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id),
  response_value text NOT NULL,
  gender text,
  age_range text,
  region text,
  report_language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.survey_response_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages survey response stats"
  ON public.survey_response_stats FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. Extraction + purge function. Idempotent — only acts on answers rows
-- that still have a payload and chat rows that still exist, so re-running
-- (daily cron re-firing) is always safe.
CREATE OR REPLACE FUNCTION public.purge_expired_assessment_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stats_inserted int := 0;
  v_answers_purged int := 0;
  v_chat_messages_purged int := 0;
  v_chat_histories_purged int := 0;
BEGIN
  -- ---- Step 1: extract anonymized MC/ranking stats, then null raw answers ----
  WITH eligible_answers AS (
    -- The most recent SUBMITTED answers row at-or-before each report's
    -- creation, scoped to that report's user. Guards against cross-linking
    -- the wrong survey if a user has ever taken more than one.
    SELECT DISTINCT ON (rep.id)
      rep.id AS report_id,
      a.id AS answer_id,
      a.payload,
      p.pronouns,
      p.age_range,
      p.country,
      p.preferred_language
    FROM public.reports rep
    JOIN public.user_engagement_tracking t ON t.user_id = rep.user_id
    JOIN public.access_codes ac ON ac.user_id = rep.user_id
    JOIN public.answers a ON a.access_code_id = ac.id
    JOIN public.profiles p ON p.id = rep.user_id
    WHERE t.chat_completed_at IS NOT NULL
      AND t.chat_completed_at < now() - interval '30 days'
      AND a.status = 'submitted'
      AND a.payload <> '{}'::jsonb
      AND a.submitted_at <= rep.created_at
    ORDER BY rep.id, a.submitted_at DESC
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
      -- pronouns question duplicates the gender segmentation axis above; skip it
      AND q.id <> '11111111-1111-1111-1111-11111111111b'
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

  -- ---- Step 2: purge chat transcripts 30 days after chat_completed_at ----
  WITH eligible_reports AS (
    SELECT rep.id AS report_id, rep.user_id
    FROM public.reports rep
    JOIN public.user_engagement_tracking t ON t.user_id = rep.user_id
    WHERE t.chat_completed_at IS NOT NULL
      AND t.chat_completed_at < now() - interval '30 days'
  ),
  purged_messages AS (
    DELETE FROM public.chat_messages cm
    USING eligible_reports er
    WHERE cm.user_id = er.user_id
    RETURNING 1
  ),
  purged_histories AS (
    DELETE FROM public.n8n_chat_histories h
    USING eligible_reports er
    WHERE h.session_id = er.report_id::text OR h.session_id = er.user_id::text
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM purged_messages),
    (SELECT count(*) FROM purged_histories)
  INTO v_chat_messages_purged, v_chat_histories_purged;

  RETURN jsonb_build_object(
    'stats_inserted', v_stats_inserted,
    'answers_purged', v_answers_purged,
    'chat_messages_purged', v_chat_messages_purged,
    'chat_histories_purged', v_chat_histories_purged
  );
END;
$$;

-- 3. Daily at 03:11 UTC (off-peak, staggered from other scheduled jobs).
SELECT cron.schedule(
  'purge-expired-assessment-data',
  '11 3 * * *',
  'SELECT public.purge_expired_assessment_data()'
);
