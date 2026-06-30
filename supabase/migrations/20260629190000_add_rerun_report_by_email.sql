-- rerun_report_by_email(email, dry_run, clear) — convenience wrapper around
-- rerun_report() that resolves an email to that user's LATEST report and re-runs it.
-- Lets the Ops "Re-run a report" card take an email instead of a report UUID
-- (you can't add report_id to the Supabase-managed auth.users table, and a user can
-- have multiple reports — so resolve at call time).
--
-- Same admin gate as rerun_report; granted to authenticated for the Ops button.

CREATE OR REPLACE FUNCTION public.rerun_report_by_email(
  p_email text,
  p_dry_run boolean DEFAULT false,
  p_clear boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_report_id uuid;
BEGIN
  IF NOT (
    coalesce(auth.jwt() ->> 'email','') IN ('sjoerd@cairnly.io','sjoerd@falkoratlas.com')
    OR auth.uid() IS NULL
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
$$;

REVOKE ALL ON FUNCTION public.rerun_report_by_email(text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rerun_report_by_email(text, boolean, boolean) TO authenticated;
