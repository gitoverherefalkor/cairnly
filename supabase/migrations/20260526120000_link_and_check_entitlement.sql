-- Block unentitled OAuth sign-ins.
--
-- After a user authenticates we call this RPC. It does two things in a single
-- round-trip:
--   1. Auto-link any unbound access_codes whose linked purchases.email matches
--      the signed-in user's auth email. This rescues the common "paid via
--      Stripe, then signed in with the same email via Google" case where the
--      old flow required manually entering the code.
--   2. Return whether the user is entitled to use the product. A user is
--      entitled if they own a bound access code, a matching purchase email,
--      or any prior product activity (report / chat / saved job / saved
--      response). The activity clauses grandfather existing users whose
--      codes were never bound (e.g., beta testers, manually-issued codes).
--
-- SECURITY DEFINER so the function can read purchases by email even when the
-- caller's RLS would not allow it (purchases is keyed by email, not user_id).
-- All reads/writes are scoped to the caller's auth.uid() / auth.email().

CREATE OR REPLACE FUNCTION public.link_and_check_entitlement()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_linked_count int := 0;
  v_entitled boolean := false;
BEGIN
  -- No session → not entitled. Defensive; the client only calls this when
  -- it already has a session.
  IF v_user_id IS NULL OR v_user_email = '' THEN
    RETURN jsonb_build_object('entitled', false, 'linked_codes', 0);
  END IF;

  -- (1) Auto-link any access_codes that belong to a purchase made with the
  --     same email but aren't bound to any user yet. Only touches unbound
  --     codes — never re-assigns a code already owned by another user.
  WITH to_link AS (
    SELECT ac.id
    FROM public.access_codes ac
    JOIN public.purchases pu ON pu.access_code_id = ac.id
    WHERE ac.user_id IS NULL
      AND lower(pu.email) = v_user_email
  )
  UPDATE public.access_codes ac
     SET user_id = v_user_id
    FROM to_link
   WHERE ac.id = to_link.id
     AND ac.user_id IS NULL;  -- belt + suspenders against a race
  GET DIAGNOSTICS v_linked_count = ROW_COUNT;

  -- (2) Entitlement check across all signals.
  SELECT
    EXISTS (SELECT 1 FROM public.access_codes        ac WHERE ac.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.purchases           pu WHERE lower(pu.email) = v_user_email)
    OR EXISTS (SELECT 1 FROM public.reports             r  WHERE r.user_id  = v_user_id)
    OR EXISTS (SELECT 1 FROM public.chat_messages       cm WHERE cm.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.saved_jobs          sj WHERE sj.user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.saved_chat_responses sc WHERE sc.user_id = v_user_id)
  INTO v_entitled;

  RETURN jsonb_build_object('entitled', v_entitled, 'linked_codes', v_linked_count);
END;
$$;

-- Lock the function down. SECURITY DEFINER + revoke from PUBLIC + revoke
-- from anon (Supabase's pg_default_acl auto-grants EXECUTE to anon on every
-- new function in public, which the FROM PUBLIC revoke does NOT strip) +
-- grant to authenticated only.
REVOKE ALL ON FUNCTION public.link_and_check_entitlement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.link_and_check_entitlement() FROM anon;
GRANT EXECUTE ON FUNCTION public.link_and_check_entitlement() TO authenticated;

COMMENT ON FUNCTION public.link_and_check_entitlement() IS
  'Called after sign-in. Auto-links unbound purchases to the signed-in user and returns {entitled: bool, linked_codes: int}.';
