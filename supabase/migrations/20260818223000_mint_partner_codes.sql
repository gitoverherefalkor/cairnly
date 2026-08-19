-- Mint a batch of access codes for a partner.
--
-- A partner buys N seats and hands one code to each candidate. ONE CODE IS ONE
-- PERSON: signup-with-access-code binds access_codes.user_id to the first
-- account that redeems it and rejects every other. max_usage is for the same
-- person resuming, NOT for seats, so 25 candidates need 25 codes.
--
-- Columns deliberately left to their defaults: max_usage (1), usage_count (0),
-- is_active (true). Writing an explicit NULL into max_usage or usage_count
-- would let verify-access-code pass while consume_access_code silently matches
-- no row, i.e. the coach is told the code is valid and the candidate cannot get
-- in. Omit them, never null them.
--
-- Alphabet matches generateAccessCode() in supabase/functions/payment-success:
-- I, O, 0 and 1 are excluded so a code read aloud over the phone is unambiguous.

CREATE OR REPLACE FUNCTION public.mint_partner_codes(
  p_partner_slug TEXT,
  p_count        INT,
  p_expires_at   TIMESTAMPTZ DEFAULT NULL,
  p_survey_type  TEXT DEFAULT 'Office / Business Pro - 2025 v1 EN'
)
RETURNS TABLE (code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id UUID;
  v_alphabet   TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code       TEXT;
  i INT;
  j INT;
BEGIN
  SELECT p.id INTO v_partner_id
    FROM public.partners p
   WHERE p.slug = p_partner_slug AND p.is_active;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'No active partner with slug %', p_partner_slug;
  END IF;

  -- A typo in the count is the one way this function can cost real money.
  IF p_count < 1 OR p_count > 500 THEN
    RAISE EXCEPTION 'Refusing to mint % codes (allowed range is 1-500)', p_count;
  END IF;

  FOR i IN 1..p_count LOOP
    LOOP
      v_code := '';
      FOR j IN 1..16 LOOP
        IF j > 1 AND (j - 1) % 4 = 0 THEN
          v_code := v_code || '-';
        END IF;
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::INT, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.access_codes ac WHERE ac.code = v_code);
    END LOOP;

    INSERT INTO public.access_codes (code, partner_id, expires_at, survey_type)
    VALUES (v_code, v_partner_id, p_expires_at, p_survey_type);

    code := v_code;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Without this
-- revoke, any signed-in user could mint themselves unlimited free assessments.
REVOKE ALL ON FUNCTION public.mint_partner_codes(TEXT, INT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_partner_codes(TEXT, INT, TIMESTAMPTZ, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.mint_partner_codes(TEXT, INT, TIMESTAMPTZ, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.mint_partner_codes(TEXT, INT, TIMESTAMPTZ, TEXT) TO service_role;
