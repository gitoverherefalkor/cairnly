-- Wire public.dismissed_careers into the hand-enumerated cleanup functions.
--
-- 20260915140000 added dismissed_careers (the dashboard "Not for me" control).
-- It holds personal data: which careers a user rejected, why, and a free-text
-- note. The FKs cascade from auth.users and from reports, but this project's
-- cleanup paths do NOT all rely on cascades -- two of them enumerate tables by
-- hand, so a new user-data table that nobody adds to the list quietly survives
-- a deletion it was supposed to die in. This migration adds it to the lists.
--
-- Which of the three cleanup paths actually needed a change, and why:
--
-- 1. delete_user_personal_data(p_user_id)  -- NEEDED
--    Deletes a user's personal data while the auth.users row SURVIVES (the
--    GDPR "erase my data" flow, and the account-deletion edge function calls
--    it before removing the auth user). Because auth.users is still there when
--    it runs, the user_id -> auth.users ON DELETE CASCADE never fires. Without
--    an explicit delete the dismissals would simply stay.
--
-- 2. handle_auth_user_deleted()            -- DELIBERATELY UNCHANGED
--    The BEFORE DELETE trigger on auth.users. Its entire body is a PERFORM of
--    delete_user_personal_data(OLD.id); it enumerates no tables of its own, so
--    fixing (1) already fixes this path. Adding a dismissed_careers delete here
--    would create a SECOND place that lists tables by hand, which is the exact
--    failure mode this migration exists to close. It is also double-covered:
--    the user_id -> auth.users cascade would clear the rows regardless.
--
-- 3. purge_expired_assessment_data()       -- NEEDED
--    The 30-day retention purge. It deliberately KEEPS the reports row
--    (reports.payload is still read by the Jobs and Chat pages), so the
--    report_id -> reports ON DELETE CASCADE never fires here either. It selects
--    everything through the _purge_eligible_users temp table on user_id, so the
--    new delete copies that same shape from the chat_messages purge beside it.
--
-- Both functions below are the CURRENT live bodies (fetched with
-- pg_get_functiondef, not reconstructed from older migrations) with exactly one
-- delete added. CREATE OR REPLACE only: signature, return type, LANGUAGE,
-- SECURITY DEFINER, search_path and volatility are all preserved.

-- 1. Account deletion / GDPR erase.
CREATE OR REPLACE FUNCTION public.delete_user_personal_data(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_email      text := lower(coalesce((SELECT email FROM auth.users WHERE id = p_user_id), ''));
  v_code_ids   uuid[];
  v_report_ids uuid[];
  v_anon_email text := 'deleted+' || replace(p_user_id::text, '-', '') || '@deleted.invalid';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT array_agg(id) INTO v_code_ids   FROM public.access_codes WHERE user_id = p_user_id;
  SELECT array_agg(id) INTO v_report_ids FROM public.reports      WHERE user_id = p_user_id;

  -- ---- Hard delete: pure personal data ----

  -- Survey answers are tied to the user's access codes (no user_id column).
  IF v_code_ids IS NOT NULL THEN
    DELETE FROM public.answers WHERE access_code_id = ANY(v_code_ids);
  END IF;

  -- Also catch answers reachable only via the user's *purchases* (matched by
  -- email). access_codes.user_id is sometimes NULL even for real users, which
  -- would otherwise leave their survey answers behind on deletion. Runs before
  -- the purchase anonymization below so the email is still the real one here.
  IF v_email <> '' THEN
    DELETE FROM public.answers
     WHERE access_code_id IN (
       SELECT access_code_id FROM public.purchases
        WHERE access_code_id IS NOT NULL AND lower(email) = v_email
     );
  END IF;

  -- Report-scoped job research (no cascade from reports).
  IF v_report_ids IS NOT NULL THEN
    DELETE FROM public.enriched_jobs WHERE report_id = ANY(v_report_ids);
  END IF;

  -- User-scoped behavioral tables. Several cascade on reports delete, but we
  -- delete explicitly by user_id to also catch rows with a null report_id.
  DELETE FROM public.chat_messages            WHERE user_id = p_user_id;
  DELETE FROM public.dismissed_careers        WHERE user_id = p_user_id;
  DELETE FROM public.saved_chat_responses     WHERE user_id = p_user_id;
  DELETE FROM public.saved_jobs               WHERE user_id = p_user_id;
  DELETE FROM public.user_job_searches        WHERE user_id = p_user_id;
  DELETE FROM public.cover_letters            WHERE user_id = p_user_id;
  DELETE FROM public.custom_resumes           WHERE user_id = p_user_id;
  DELETE FROM public.content_feedback         WHERE user_id = p_user_id;  -- report_id FK is SET NULL, so must be explicit
  DELETE FROM public.support_requests         WHERE user_id = p_user_id;
  DELETE FROM public.user_engagement_tracking WHERE user_id = p_user_id;

  IF v_report_ids IS NOT NULL THEN
    DELETE FROM public.report_sections WHERE report_id = ANY(v_report_ids);
  END IF;
  DELETE FROM public.reports WHERE user_id = p_user_id;

  -- n8n LangChain chat memory: session_id is free text; in this app sessions
  -- are keyed by report id (and historically user id). Best-effort match.
  IF v_report_ids IS NOT NULL THEN
    DELETE FROM public.n8n_chat_histories
     WHERE session_id = ANY (SELECT (unnest(v_report_ids))::text)
        OR session_id = p_user_id::text;
  ELSE
    DELETE FROM public.n8n_chat_histories WHERE session_id = p_user_id::text;
  END IF;

  -- ---- Anonymize: financial / legal-retention data ----

  IF v_code_ids IS NOT NULL THEN
    UPDATE public.purchases
       SET first_name = '[deleted]', last_name = '[deleted]', country = '[deleted]', email = v_anon_email
     WHERE access_code_id = ANY(v_code_ids);
  END IF;
  IF v_email <> '' THEN
    UPDATE public.purchases
       SET first_name = '[deleted]', last_name = '[deleted]', country = '[deleted]', email = v_anon_email
     WHERE lower(email) = v_email;
  END IF;

  -- This user as an invitee: scrub their identifiers, keep the financial row
  -- for the referrer's payout record.
  UPDATE public.referrals
     SET invitee_user_id = NULL, invitee_email = v_anon_email
   WHERE invitee_user_id = p_user_id;

  -- This user as the referrer: detach them so the retained financial row
  -- survives the eventual auth.users delete (FK is SET NULL). Keep the
  -- invitee's identifiers — they belong to a different person.
  UPDATE public.referrals SET referrer_user_id = NULL WHERE referrer_user_id = p_user_id;

  -- This user as a referrer with payouts: detach so the retained financial
  -- payout record survives the auth.users delete (FK is SET NULL).
  UPDATE public.referral_payouts SET referrer_user_id = NULL WHERE referrer_user_id = p_user_id;

  -- De-link access codes (not PII; referenced by retained purchase rows).
  UPDATE public.access_codes SET user_id = NULL WHERE user_id = p_user_id;

  -- Profile last (within public schema). Auth user + storage handled by caller.
  DELETE FROM public.profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'email_anonymized_to', v_anon_email,
    'access_codes_unlinked', coalesce(array_length(v_code_ids, 1), 0),
    'reports_deleted', coalesce(array_length(v_report_ids, 1), 0)
  );
END;
$function$
;

-- 2. handle_auth_user_deleted() is intentionally not redefined here. See the
--    note above: it delegates wholly to delete_user_personal_data().

-- 3. 30-day retention purge.
CREATE OR REPLACE FUNCTION public.purge_expired_assessment_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cutoff timestamptz := now() - interval '30 days';
  v_stats_inserted int := 0;
  v_answers_purged int := 0;
  v_chat_messages_purged int := 0;
  v_chat_histories_purged int := 0;
  v_users_purged int := 0;
BEGIN
  -- Eligible users: completed their chat more than 30 days ago, have not been
  -- purged since that completion, and have NO report created after the chat
  -- completed (protects multi-assessment users: Starter/Encore/retakes).
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

  -- ---- Step 2b: purge set-aside ("Not for me") careers ----
  -- Scoped by user_id, matching how everything else in this function
  -- selects rows (there is no report-scoped CTE here; the chat purge above
  -- joins _purge_eligible_users on user_id too). dismissed_careers.report_id
  -- does cascade from reports, but this function deliberately KEEPS the
  -- reports row (reports.payload is still read by the Jobs and Chat pages),
  -- so that cascade never fires and the delete has to be explicit.
  DELETE FROM public.dismissed_careers dc
  USING _purge_eligible_users eu
  WHERE dc.user_id = eu.user_id;

  -- ---- Step 3: mark these users as purged ----
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
$function$
;
