-- Individual free codes, minted one at a time from the Ops console.
--
-- For the free access Sjoerd hands out personally (mostly over WhatsApp), not
-- through a partner or employer batch. There is no email on file for these, so
-- the code row itself records who it went to and when it was handed out:
--
--   issued_to  the recipient's name as typed in Ops
--   issued_on  the day it was handed out; defaults to today, but can be set to
--              an earlier day to log a code that went out before this existed
--
-- A row with issued_to set and no partner_id / employer_id is an individual
-- free code. Redeeming it is the normal access-code signup: no Stripe, one code
-- is one person, nothing about verify/signup/claim changes.

alter table public.access_codes
  add column if not exists issued_to text,
  add column if not exists issued_on date;

comment on column public.access_codes.issued_to is
  'Recipient name for an individual free code minted in Ops. Null for bought, partner and employer codes.';
comment on column public.access_codes.issued_on is
  'Day an individual free code was handed out (set in Ops, defaults to today).';

-- Mint one code for one named person. Same code shape and randomness as
-- mint_partner_codes: up to 5 letters of the name, then three groups of four
-- characters from an alphabet without I/O/0/1.
CREATE OR REPLACE FUNCTION public.mint_individual_code(
  p_issued_to   TEXT,
  p_issued_on   DATE DEFAULT CURRENT_DATE,
  p_survey_type TEXT DEFAULT 'Office / Business Pro - 2025 v1 EN'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
-- extensions is on the path for gen_random_bytes (pgcrypto lives there).
SET search_path = public, extensions
AS $$
DECLARE
  v_name     TEXT := btrim(coalesce(p_issued_to, ''));
  v_prefix   TEXT;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 chars, no I/O/0/1
  v_bytes    BYTEA;
  v_code     TEXT;
  j INT;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'A recipient name is required';
  END IF;

  -- Letters only, so "Anne-Marie" becomes ANNEM. A name without enough
  -- letters (initials, digits) falls back to FREE.
  v_prefix := left(upper(regexp_replace(v_name, '[^A-Za-z]', '', 'g')), 5);
  IF length(v_prefix) < 2 THEN
    v_prefix := 'FREE';
  END IF;

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

  INSERT INTO public.access_codes (code, survey_type, issued_to, issued_on)
  VALUES (v_code, p_survey_type, v_name, coalesce(p_issued_on, CURRENT_DATE));

  RETURN v_code;
END;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Without these
-- revokes any signed-in user could mint themselves free assessments.
REVOKE ALL ON FUNCTION public.mint_individual_code(TEXT, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_individual_code(TEXT, DATE, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.mint_individual_code(TEXT, DATE, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.mint_individual_code(TEXT, DATE, TEXT) TO service_role;
