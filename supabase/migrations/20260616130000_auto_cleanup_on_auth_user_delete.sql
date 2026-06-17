-- Auto-run the GDPR personal-data cleanup on EVERY auth.users deletion,
-- including deletes done straight from the Supabase dashboard.
--
-- Background
-- ----------
-- Deleting a user only fires the raw foreign-key actions on auth.users:
--   * tables with a direct user_id FK (profiles, reports, chat_messages, ...)
--     are ON DELETE CASCADE  -> cleaned automatically
--   * access_codes / referrals / support_requests are ON DELETE SET NULL
--   * `answers` has NO FK to auth.users at all (linked only via access codes)
-- The indirectly-linked data (answers, purchases PII, enriched_jobs, n8n chat
-- history) was therefore only cleaned by delete_user_personal_data(), which
-- until now ran exclusively from the `delete-user-data` edge function. Deleting
-- a user from the dashboard skipped it entirely and left that data behind.
--
-- This migration:
--   1. Hardens delete_user_personal_data() to also reach answers via the user's
--      *purchase email*, because access_codes.user_id is frequently NULL even
--      for real users (a separate data-integrity bug). Without this, the RPC
--      misses the survey answers of any user whose access code was never linked.
--   2. Adds a BEFORE DELETE trigger on auth.users that runs the RPC. BEFORE (not
--      AFTER) is required: the RPC locates answers/purchases through the user's
--      access codes, and the delete itself sets access_codes.user_id to NULL, so
--      the links must still be intact when the RPC runs.
--
-- The RPC is idempotent, so the in-app edge function calling it AND this trigger
-- firing on the same delete is harmless (the second pass is a no-op).

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
$function$;

-- Trigger wrapper: runs the cleanup just before the auth user row is removed.
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.delete_user_personal_data(OLD.id);
  RETURN OLD;  -- must return OLD so the delete proceeds
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_deleted();
