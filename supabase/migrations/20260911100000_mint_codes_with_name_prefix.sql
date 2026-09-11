-- Minted partner codes start with the partner's name.
--
-- A code used to read GXKP-7M4R-QW2T-NJHD, which tells nobody anything. When a
-- bureau mails back "code werkt niet", the first question was always "which
-- code, from which batch". Now it reads GOING-7M4R-QW2T-NJHD and the answer is
-- in the code itself.
--
-- Shape: up to 5 letters from the partner name, then three groups of four
-- random characters. Same four-group look as before, so nothing about how a
-- code is read or typed changes.
--
-- Two deliberate details:
--
-- * The prefix may contain I and O, which the random alphabet excludes on
--   purpose (I/1 and O/0 are ambiguous read aloud). That is safe here because
--   the prefix is a readable word fragment the reader can see in context,
--   while everything after the first dash stays unambiguous. GOING is never
--   misheard as G0ING.
-- * Randomness now comes from pgcrypto's gen_random_bytes instead of random().
--   These codes are entitlements worth real money and random() is a seeded PRNG,
--   not a CSPRNG. The alphabet is exactly 32 characters and a byte is 0-255, so
--   `% 32` is free of modulo bias.
--
-- Entropy drops from 16 to 12 random characters, i.e. 32^12 (about 1.2e18)
-- combinations. With verify-access-code rate limited, guessing one is not a
-- realistic attack.
--
-- Signature is unchanged so the existing grants and the ops-partners caller
-- keep working. Codes minted before this migration stay valid: nothing
-- validates the format, it is matched as an exact string.

CREATE OR REPLACE FUNCTION public.mint_partner_codes(
  p_partner_slug TEXT,
  p_count        INT,
  p_expires_at   TIMESTAMPTZ DEFAULT NULL,
  p_survey_type  TEXT DEFAULT 'Office / Business Pro - 2025 v1 EN'
)
RETURNS TABLE (code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
-- extensions is on the path for gen_random_bytes (pgcrypto lives there).
SET search_path = public, extensions
AS $$
DECLARE
  v_partner_id   UUID;
  v_partner_name TEXT;
  v_prefix       TEXT;
  v_alphabet     TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 chars, no I/O/0/1
  v_bytes        BYTEA;
  v_code         TEXT;
  i INT;
  j INT;
BEGIN
  SELECT p.id, p.name INTO v_partner_id, v_partner_name
    FROM public.partners p
   WHERE p.slug = p_partner_slug AND p.is_active;

  IF v_partner_id IS NULL THEN
    RAISE EXCEPTION 'No active partner with slug %', p_partner_slug;
  END IF;

  -- A typo in the count is the one way this function can cost real money.
  IF p_count < 1 OR p_count > 500 THEN
    RAISE EXCEPTION 'Refusing to mint % codes (allowed range is 1-500)', p_count;
  END IF;

  -- Letters only: "2de Spoor" becomes DESPO, "Weustink&Partners" becomes
  -- WEUST. Falls back to the slug, then to a constant, so a name made purely
  -- of digits or symbols can never produce a bare "-XXXX-XXXX-XXXX".
  v_prefix := left(upper(regexp_replace(coalesce(v_partner_name, ''), '[^A-Za-z]', '', 'g')), 5);
  IF length(v_prefix) < 2 THEN
    v_prefix := left(upper(regexp_replace(p_partner_slug, '[^A-Za-z]', '', 'g')), 5);
  END IF;
  IF length(v_prefix) < 2 THEN
    v_prefix := 'CODE';
  END IF;

  FOR i IN 1..p_count LOOP
    LOOP
      v_bytes := gen_random_bytes(12);
      v_code  := v_prefix;
      FOR j IN 1..12 LOOP
        IF (j - 1) % 4 = 0 THEN
          v_code := v_code || '-';
        END IF;
        v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, j - 1) % 32), 1);
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

-- Postgres grants EXECUTE on new functions to PUBLIC by default, and CREATE OR
-- REPLACE resets that. Without these revokes any signed-in user could mint
-- themselves unlimited free assessments.
REVOKE ALL ON FUNCTION public.mint_partner_codes(TEXT, INT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_partner_codes(TEXT, INT, TIMESTAMPTZ, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.mint_partner_codes(TEXT, INT, TIMESTAMPTZ, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.mint_partner_codes(TEXT, INT, TIMESTAMPTZ, TEXT) TO service_role;
