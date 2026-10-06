-- Employers as their own concept (the /employers channel, run by Tasha).
--
-- Deliberately NOT a kind of partner. A partner_id on a code turns on bureau
-- branding everywhere downstream: the /p/:slug landing, the logo on the PDF,
-- and the closing page that sends the reader "to your advisor at X". None of
-- that is true for an employee, so an employer code carries employer_id
-- instead and can never pick up a bureau's treatment by accident.
--
-- Two kinds of employer code:
--   trial  one code for the HR prospect to try it themselves. Ordinary consumer
--          experience; it only exists so Ops can see the trial got used.
--   seat   a code for an employee. The assessment's first screen tells them
--          the employer paid and sees nothing. Counted per employer, never
--          shown per person.
--
-- Ops only: RLS on, no policies, so only the service role (ops-employers)
-- reads or writes. The employer itself never gets a login.

CREATE TABLE IF NOT EXISTS public.employers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  contact_name  TEXT,
  contact_email TEXT,
  status        TEXT NOT NULL DEFAULT 'lead'
                CHECK (status IN ('lead', 'trial_sent', 'in_talks', 'customer', 'lost')),
  notes         TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.employers TO service_role;

ALTER TABLE public.access_codes
  ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employer_code_kind TEXT CHECK (employer_code_kind IN ('trial', 'seat'));

CREATE INDEX IF NOT EXISTS access_codes_employer_id_idx
  ON public.access_codes (employer_id) WHERE employer_id IS NOT NULL;

COMMENT ON COLUMN public.access_codes.employer_code_kind IS
  'trial = HR prospect tries it (consumer experience); seat = employee code, shows the employer-paid notice. Survives the employer row being deleted on purpose: the seat was still paid for.';

-- Per-employer rollup for Ops. Counts only: the /employers page promises the
-- employer sees how many codes were redeemed, never by whom, and Ops keeps to
-- the same shape so nobody gets used to reading names here.
-- Reports join through access_codes.user_id (reports.access_code_id is dead,
-- see 20260818224000_partner_code_status_view.sql).
CREATE OR REPLACE VIEW public.employer_code_status
WITH (security_invoker = true) AS
SELECT
  e.id AS employer_id,
  count(ac.id) FILTER (WHERE ac.employer_code_kind = 'trial')                              AS trial_issued,
  count(ac.id) FILTER (WHERE ac.employer_code_kind = 'trial' AND ac.user_id IS NOT NULL)   AS trial_claimed,
  count(ac.id) FILTER (WHERE ac.employer_code_kind = 'trial' AND ac.usage_count > 0)       AS trial_started,
  (
    SELECT count(DISTINCT r.id)
      FROM public.access_codes t
      JOIN public.reports r ON r.user_id = t.user_id AND r.status = 'completed'
     WHERE t.employer_id = e.id AND t.employer_code_kind = 'trial'
  )                                                                                        AS trial_reports,
  max(ac.created_at) FILTER (WHERE ac.employer_code_kind = 'trial')                        AS trial_last_minted_at,
  count(ac.id) FILTER (WHERE ac.employer_code_kind = 'seat')                               AS seats_issued,
  count(ac.id) FILTER (WHERE ac.employer_code_kind = 'seat' AND ac.user_id IS NOT NULL)    AS seats_claimed
FROM public.employers e
LEFT JOIN public.access_codes ac ON ac.employer_id = e.id
GROUP BY e.id;

REVOKE ALL ON public.employer_code_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.employer_code_status TO service_role;

-- Same code shape as mint_partner_codes (20260911100000): up to five letters of
-- the name, then three groups of four from the unambiguous 32-char alphabet,
-- CSPRNG via pgcrypto. ACME-7M4R-QW2T-NJHD tells you which company a code is
-- from when someone mails "my code doesn't work".
CREATE OR REPLACE FUNCTION public.mint_employer_codes(
  p_employer_id UUID,
  p_kind        TEXT,
  p_count       INT,
  p_expires_at  TIMESTAMPTZ DEFAULT NULL,
  p_survey_type TEXT DEFAULT 'Office / Business Pro - 2025 v1 EN'
)
RETURNS TABLE (code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_name     TEXT;
  v_prefix   TEXT;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes    BYTEA;
  v_code     TEXT;
  i INT;
  j INT;
BEGIN
  SELECT e.name INTO v_name FROM public.employers e WHERE e.id = p_employer_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'No employer with id %', p_employer_id;
  END IF;

  IF p_kind NOT IN ('trial', 'seat') THEN
    RAISE EXCEPTION 'Unknown employer code kind %', p_kind;
  END IF;

  -- A typo in the count is the one way this function can cost real money.
  IF p_count < 1 OR p_count > 500 THEN
    RAISE EXCEPTION 'Refusing to mint % codes (allowed range is 1-500)', p_count;
  END IF;

  v_prefix := left(upper(regexp_replace(v_name, '[^A-Za-z]', '', 'g')), 5);
  IF length(v_prefix) < 2 THEN
    v_prefix := 'WORK';
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

    INSERT INTO public.access_codes (code, employer_id, employer_code_kind, expires_at, survey_type)
    VALUES (v_code, p_employer_id, p_kind, p_expires_at, p_survey_type);

    code := v_code;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- New functions are executable by PUBLIC by default. Without these revokes any
-- signed-in user could mint themselves free assessments.
REVOKE ALL ON FUNCTION public.mint_employer_codes(UUID, TEXT, INT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_employer_codes(UUID, TEXT, INT, TIMESTAMPTZ, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.mint_employer_codes(UUID, TEXT, INT, TIMESTAMPTZ, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.mint_employer_codes(UUID, TEXT, INT, TIMESTAMPTZ, TEXT) TO service_role;
