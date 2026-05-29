-- GDPR Art. 17 complete erasure, done transactionally in one function.
-- Called by the delete-user-data edge function (service role) AFTER it has
-- verified the caller's JWT identity. The function trusts p_user_id to be the
-- verified caller; it is therefore granted to service_role ONLY (never anon /
-- authenticated, who could otherwise pass someone else's id).
--
-- Pure personal/behavioral data is hard-deleted. Financial records
-- (purchases, referrals, referral_payouts) are RETAINED for statutory
-- bookkeeping retention and instead anonymized, per GDPR Art. 17(3)(b).

-- ---- Schema fix: protect retained referral rows from cascade deletes ----
-- referrals.referrer_user_id was NOT NULL with an ON DELETE CASCADE FK to
-- auth.users. That meant deleting a referrer's auth user would cascade-delete
-- their referral rows (destroying retained financial records, and collaterally
-- the invitee's data on those rows). Worse, once referral_payouts exist the
-- payouts.referral_id RESTRICT FK blocks that cascade, failing the whole
-- account deletion. Make the column nullable and flip the FK to SET NULL so
-- the financial row survives an auth-user delete (defense-in-depth, even
-- outside the RPC).
ALTER TABLE public.referrals ALTER COLUMN referrer_user_id DROP NOT NULL;

ALTER TABLE public.referrals DROP CONSTRAINT referrals_referrer_user_id_fkey;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_referrer_user_id_fkey
  FOREIGN KEY (referrer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.delete_user_personal_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  -- Report-scoped job research (no cascade from reports).
  IF v_report_ids IS NOT NULL THEN
    DELETE FROM public.enriched_jobs WHERE report_id = ANY(v_report_ids);
  END IF;

  -- User-scoped behavioral tables. Several cascade on reports delete, but we
  -- delete explicitly by user_id to also catch rows with a null report_id.
  DELETE FROM public.chat_messages            WHERE user_id = p_user_id;
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
$$;

REVOKE ALL ON FUNCTION public.delete_user_personal_data(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_personal_data(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_personal_data(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_personal_data(uuid) TO service_role;

COMMENT ON FUNCTION public.delete_user_personal_data(uuid) IS
  'GDPR erasure: hard-deletes personal data, anonymizes retained financial rows. Service-role only; caller must verify identity first.';
