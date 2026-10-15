-- Employer hitlist (cold outreach to HR buyers) + one global do-not-contact list.
--
-- Step 2 of the employer go-to-market plan. Tasha's warm network stays in the
-- existing pipeline (20261008120000_employer_outreach.sql); the hitlist is the
-- same employers table, filled from research instead of her address book.
-- Nothing here sends anything: drafting and sending come later and will read
-- employer_hitlist.effective_tier and outreach_is_suppressed().
--
--   employers            + ICP fields (country, size band, sector, website/domain,
--                          source), frontline flag, Tasha's relationship,
--                          a manual tier override, and status 'prospect'
--                          (on the hitlist, not contacted yet).
--   employer_contacts    + role type (buyer / champion), contact source,
--                          Tasha's relationship.
--   employer_signals     trigger events (reorg, new HR lead, L&D job ad, CAO
--                          budget), each with a date and a source link.
--   employer_hitlist     view: the suggested tier and why, computed here so the
--                          console and the future sender use the same rule.
--   outreach_suppressions  ONE do-not-contact list for every track: employer
--                          hitlist, Tasha's manual log, and the bureau
--                          (outplacement) mailer. Keyed on one email, one
--                          domain or one LinkedIn profile per row.
--
-- The bureau mailer already has its own opt-out (outreach_prospects.
-- niet_mailen_op) that prepare, send, the cockpit and the push digest all
-- respect. Rather than rewire all four, two triggers keep the two in step:
-- a bureau opting out lands on the list, and anything put on the list closes
-- the matching bureau. outreach-send additionally checks the list at send time
-- for the actual recipients (to + cc), which may differ from the bureau's
-- main address.
--
-- Ops only, same as the other employer tables: RLS on, no policies, service
-- role only. Additive apart from the widened employers.status check.

-- ── 0. Shared helpers ───────────────────────────────────────────────────────

-- Consumer mailboxes. A hitlist contact must have a work address, and a
-- whole-domain suppression of one of these would block half the country.
-- Keep in sync with FREE_MAIL_DOMAINS in supabase/functions/_shared/workEmail.ts
-- (src/lib/hitlist.test.ts compares the two).
CREATE OR REPLACE FUNCTION public.outreach_is_free_mail_domain(p_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(p_domain, '')) IN (
    'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.nl', 'hotmail.co.uk',
    'outlook.com', 'outlook.nl', 'live.com', 'live.nl', 'live.co.uk', 'msn.com',
    'yahoo.com', 'yahoo.co.uk', 'yahoo.nl', 'ymail.com', 'icloud.com', 'me.com',
    'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net',
    'ziggo.nl', 'kpnmail.nl', 'kpnplanet.nl', 'planet.nl', 'home.nl', 'xs4all.nl',
    'hetnet.nl', 'casema.nl', 'chello.nl', 'telfort.nl', 'online.nl', 'quicknet.nl',
    'btinternet.com', 'sky.com', 'virginmedia.com', 'talktalk.net', 'ntlworld.com'
  );
$$;

/** "https://www.Acme.nl/about" → "acme.nl". */
CREATE OR REPLACE FUNCTION public.outreach_norm_domain(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(lower(trim(coalesce(p, ''))), '^([a-z]+://)?(www\.)?([^/:?#@]+).*$', '\3'), '');
$$;

/** Any LinkedIn profile URL → "/in/handle", or null when it is not a profile. */
CREATE OR REPLACE FUNCTION public.outreach_norm_linkedin(p TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT rtrim(substring(lower(coalesce(p, '')) FROM 'linkedin\.com(/in/[^/?#]+)'), '/');
$$;

-- ── 1. Employers: ICP fields ────────────────────────────────────────────────

ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS country       TEXT CHECK (country IN ('NL', 'UK')),
  ADD COLUMN IF NOT EXISTS size_band     TEXT CHECK (size_band IN ('lt100', '100_249', '250_499', '500_999', '1000_plus')),
  ADD COLUMN IF NOT EXISTS sector        TEXT,
  ADD COLUMN IF NOT EXISTS website       TEXT,
  ADD COLUMN IF NOT EXISTS domain        TEXT,
  ADD COLUMN IF NOT EXISTS source        TEXT CHECK (source IN ('linkedin', 'news', 'event', 'referral', 'other')),
  ADD COLUMN IF NOT EXISTS source_url    TEXT,
  ADD COLUMN IF NOT EXISTS frontline     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tasha_link    TEXT NOT NULL DEFAULT 'unchecked'
                                         CHECK (tasha_link IN ('unchecked', 'none', 'first', 'second')),
  ADD COLUMN IF NOT EXISTS tier_override TEXT CHECK (tier_override IN ('A', 'B', 'C'));

-- One row per company: the CSV import dedupes on this.
CREATE UNIQUE INDEX IF NOT EXISTS employers_domain_key ON public.employers (domain) WHERE domain IS NOT NULL;

ALTER TABLE public.employers DROP CONSTRAINT IF EXISTS employers_status_check;
ALTER TABLE public.employers ADD CONSTRAINT employers_status_check
  CHECK (status IN ('prospect', 'lead', 'trial_sent', 'in_talks', 'customer', 'lost'));

COMMENT ON COLUMN public.employers.tasha_link IS
  'Tasha''s relationship with this company. first = she knows someone: a warm intro by her, never cold outreach. second = a shared connection: tier A, a human reviews every message. unchecked = she has not looked yet.';
COMMENT ON COLUMN public.employers.tier_override IS
  'Set by hand in /ops; empty = use employer_hitlist.suggested_tier. Never overrides a Tasha 1st-degree link or a suppression.';
COMMENT ON COLUMN public.employers.frontline IS
  'Mostly frontline / blue-collar staff: excluded from the hitlist unless a tier is set by hand.';

-- ── 2. Contacts ─────────────────────────────────────────────────────────────

ALTER TABLE public.employer_contacts
  ADD COLUMN IF NOT EXISTS role_type      TEXT CHECK (role_type IN ('buyer', 'champion', 'other')),
  ADD COLUMN IF NOT EXISTS contact_source TEXT,
  ADD COLUMN IF NOT EXISTS tasha_link     TEXT NOT NULL DEFAULT 'unchecked'
                                          CHECK (tasha_link IN ('unchecked', 'none', 'first', 'second'));

COMMENT ON COLUMN public.employer_contacts.role_type IS
  'buyer = HR director / CHRO (signs). champion = HRBP, L&D lead, internal mobility or career adviser (pushes it internally).';
COMMENT ON COLUMN public.employer_contacts.contact_source IS
  'Where the name and address came from (LinkedIn, company site, event, ...). Required for hitlist contacts.';

-- ── 3. Signals ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employer_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id  UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('reorg', 'new_hr_lead', 'ld_job_ad', 'cao_budget')),
  signal_date  DATE NOT NULL,
  source_url   TEXT NOT NULL CHECK (source_url ~* '^https?://'),
  note         TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employer_signals_employer_id_idx ON public.employer_signals (employer_id);

COMMENT ON COLUMN public.employer_signals.kind IS
  'reorg = reorganisation / cost-cutting / merger announced (fresh 6 months). new_hr_lead = new CHRO or HR director (12). ld_job_ad = L&D / internal mobility / duurzame inzetbaarheid vacancy (6). cao_budget = CAO with a development budget (12).';

/** Last day a signal still counts. Windows agreed with Sjoerd 2026-10-15. */
CREATE OR REPLACE FUNCTION public.employer_signal_fresh_until(p_kind TEXT, p_date DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_date + CASE p_kind
    WHEN 'reorg'       THEN interval '6 months'
    WHEN 'new_hr_lead' THEN interval '12 months'
    WHEN 'ld_job_ad'   THEN interval '6 months'
    WHEN 'cao_budget'  THEN interval '12 months'
  END)::date;
$$;

CREATE OR REPLACE VIEW public.employer_signals_status
WITH (security_invoker = true) AS
SELECT s.*,
       public.employer_signal_fresh_until(s.kind, s.signal_date)                 AS fresh_until,
       public.employer_signal_fresh_until(s.kind, s.signal_date) >= current_date AS fresh
  FROM public.employer_signals s;

-- ── 4. The do-not-contact list ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outreach_suppressions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT CHECK (email = lower(email) AND email LIKE '%_@_%'),
  domain        TEXT CHECK (domain = lower(domain) AND NOT public.outreach_is_free_mail_domain(domain)),
  linkedin      TEXT CHECK (linkedin LIKE '/in/%'),
  reason        TEXT,
  track         TEXT NOT NULL CHECK (track IN ('employer', 'outplacement', 'manual')),
  -- Where it came from. SET NULL, not CASCADE: deleting the contact must
  -- never lift the block.
  employer_id   UUID REFERENCES public.employers(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES public.employer_contacts(id) ON DELETE SET NULL,
  prospect_slug TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT outreach_suppressions_one_key CHECK (num_nonnulls(email, domain, linkedin) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS outreach_suppressions_email_key    ON public.outreach_suppressions (email)    WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS outreach_suppressions_domain_key   ON public.outreach_suppressions (domain)   WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS outreach_suppressions_linkedin_key ON public.outreach_suppressions (linkedin) WHERE linkedin IS NOT NULL;

COMMENT ON TABLE public.outreach_suppressions IS
  'Global do-not-contact list across all outreach tracks. One key per row (email, domain or LinkedIn /in/ path). Checked by ops-employers before a cold touch is logged and by outreach-send before every mail; kept in step with outreach_prospects.niet_mailen_op by triggers.';

/**
 * Is this address (or LinkedIn profile) on the list? A domain row also covers
 * its subdomains: blocking acme.com blocks jan@nl.acme.com.
 */
CREATE OR REPLACE FUNCTION public.outreach_is_suppressed(p_email TEXT, p_linkedin TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH k AS (
    SELECT nullif(lower(trim(coalesce(p_email, ''))), '')           AS email,
           nullif(split_part(lower(trim(coalesce(p_email, ''))), '@', 2), '') AS dom,
           public.outreach_norm_linkedin(p_linkedin)                 AS li
  )
  SELECT EXISTS (
    SELECT 1
      FROM public.outreach_suppressions s, k
     WHERE (k.email IS NOT NULL AND s.email = k.email)
        OR (k.dom IS NOT NULL AND s.domain IS NOT NULL AND (k.dom = s.domain OR k.dom LIKE '%.' || s.domain))
        OR (k.li IS NOT NULL AND s.linkedin = k.li)
  );
$$;

-- A bureau that asks not to be mailed lands on the global list.
CREATE OR REPLACE FUNCTION public.outreach_prospect_optout_to_list()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.niet_mailen_op IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.niet_mailen_op IS NULL)
     AND nullif(trim(coalesce(NEW.to_email, '')), '') IS NOT NULL
     AND NOT public.outreach_is_suppressed(NEW.to_email) THEN
    INSERT INTO public.outreach_suppressions (email, reason, track, prospect_slug)
    VALUES (lower(trim(NEW.to_email)), 'Asked not to be mailed', 'outplacement', NEW.slug)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS outreach_prospect_optout_to_list ON public.outreach_prospects;
CREATE TRIGGER outreach_prospect_optout_to_list
  AFTER INSERT OR UPDATE OF niet_mailen_op ON public.outreach_prospects
  FOR EACH ROW EXECUTE FUNCTION public.outreach_prospect_optout_to_list();

-- Anything on the list closes the matching bureau, so the mailer's existing
-- checks (prepare, send, cockpit, push digest) stop it without code changes.
CREATE OR REPLACE FUNCTION public.outreach_list_to_prospects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL AND NEW.domain IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.outreach_prospects p
     SET niet_mailen_op = now(), updated_at = now()
   WHERE p.niet_mailen_op IS NULL
     AND p.to_email IS NOT NULL
     AND (
       lower(trim(p.to_email)) = NEW.email
       OR (NEW.domain IS NOT NULL AND (
             split_part(lower(trim(p.to_email)), '@', 2) = NEW.domain
          OR split_part(lower(trim(p.to_email)), '@', 2) LIKE '%.' || NEW.domain))
     );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS outreach_list_to_prospects ON public.outreach_suppressions;
CREATE TRIGGER outreach_list_to_prospects
  AFTER INSERT ON public.outreach_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.outreach_list_to_prospects();

-- Backfill: bureaus that already opted out.
INSERT INTO public.outreach_suppressions (email, reason, track, prospect_slug, created_at)
SELECT DISTINCT ON (lower(trim(p.to_email)))
       lower(trim(p.to_email)), 'Asked not to be mailed', 'outplacement', p.slug, p.niet_mailen_op
  FROM public.outreach_prospects p
 WHERE p.niet_mailen_op IS NOT NULL
   AND nullif(trim(coalesce(p.to_email, '')), '') IS NOT NULL
 ORDER BY lower(trim(p.to_email)), p.niet_mailen_op
ON CONFLICT DO NOTHING;

-- ── 5. Guardrails for the (future) automated sender ─────────────────────────
-- Tasha's hand-logged touches only get a warning in /ops. Anything a machine
-- logs (automated = true) is held to the rules here, in the database, so no
-- future sender can skip them: max 2 follow-ups per contact, never a
-- suppressed person or company.

ALTER TABLE public.employer_touches
  ADD COLUMN IF NOT EXISTS automated BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.employer_touch_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.employer_contacts%rowtype;
  v_domain  TEXT;
BEGIN
  IF NOT NEW.automated OR NEW.kind NOT IN ('first_contact', 'follow_up') THEN
    RETURN NEW;
  END IF;
  IF NEW.contact_id IS NULL THEN
    RAISE EXCEPTION 'An automated touch needs a contact';
  END IF;
  SELECT * INTO v_contact FROM public.employer_contacts WHERE id = NEW.contact_id;
  SELECT domain INTO v_domain FROM public.employers WHERE id = NEW.employer_id;
  IF public.outreach_is_suppressed(v_contact.email, v_contact.linkedin_url)
     OR (v_domain IS NOT NULL AND public.outreach_is_suppressed('x@' || v_domain)) THEN
    RAISE EXCEPTION 'Contact % is on the do-not-contact list', NEW.contact_id;
  END IF;
  IF NEW.kind = 'follow_up' AND (
       SELECT count(*) FROM public.employer_touches t
        WHERE t.contact_id = NEW.contact_id AND t.kind = 'follow_up'
     ) >= 2 THEN
    RAISE EXCEPTION 'Contact % already had 2 follow-ups', NEW.contact_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS employer_touch_guard ON public.employer_touches;
CREATE TRIGGER employer_touch_guard
  BEFORE INSERT ON public.employer_touches
  FOR EACH ROW EXECUTE FUNCTION public.employer_touch_guard();

-- ── 6. The hitlist view: suggested tier and why ─────────────────────────────
--
--   excluded (hard): on the do-not-contact list, or Tasha knows them (1st
--                    degree, on the company or any contact) → warm intro.
--   excluded (soft): under 100 staff, or mostly frontline. A hand-set tier
--                    still wins over these.
--   A: fresh reorg signal, OR 500+ staff, OR Tasha 2nd degree.
--   B: ICP fit + any fresh signal.   C: ICP fit, no fresh signal.
--   No tier yet: country or size not filled in.

CREATE OR REPLACE VIEW public.employer_hitlist
WITH (security_invoker = true) AS
WITH sig AS (
  SELECT employer_id,
         bool_or(kind = 'reorg' AND fresh)  AS reorg_fresh,
         count(*) FILTER (WHERE fresh)      AS fresh_signals,
         count(*)                           AS all_signals
    FROM public.employer_signals_status
   GROUP BY employer_id
), ct AS (
  SELECT employer_id,
         bool_or(tasha_link = 'first')  AS any_first,
         bool_or(tasha_link = 'second') AS any_second,
         bool_or(tasha_link = 'unchecked') AS any_unchecked,
         count(*)                       AS contacts
    FROM public.employer_contacts
   GROUP BY employer_id
), base AS (
  SELECT e.id AS employer_id,
         e.tier_override,
         CASE
           WHEN e.tasha_link = 'first'  OR coalesce(ct.any_first, false)  THEN 'first'
           WHEN e.tasha_link = 'second' OR coalesce(ct.any_second, false) THEN 'second'
           WHEN e.tasha_link = 'none' THEN 'none'
           ELSE 'unchecked'
         END AS tasha_effective,
         (e.domain IS NOT NULL AND public.outreach_is_suppressed('x@' || e.domain)) AS domain_suppressed,
         e.size_band,
         e.frontline,
         (e.country IS NOT NULL AND e.size_band IS NOT NULL) AS icp_complete,
         coalesce(sig.reorg_fresh, false) AS reorg_fresh,
         coalesce(sig.fresh_signals, 0)   AS fresh_signals,
         coalesce(sig.all_signals, 0)     AS all_signals,
         coalesce(ct.contacts, 0)         AS contacts
    FROM public.employers e
    LEFT JOIN sig ON sig.employer_id = e.id
    LEFT JOIN ct  ON ct.employer_id  = e.id
), judged AS (
  SELECT b.*,
         CASE
           WHEN b.domain_suppressed          THEN 'suppressed'
           WHEN b.tasha_effective = 'first'  THEN 'tasha_warm'
         END AS hard_exclusion,
         CASE
           WHEN b.size_band = 'lt100' THEN 'too_small'
           WHEN b.frontline           THEN 'frontline'
         END AS soft_exclusion
    FROM base b
), tiered AS (
  SELECT j.*,
         CASE
           WHEN j.hard_exclusion IS NOT NULL OR j.soft_exclusion IS NOT NULL THEN NULL
           WHEN NOT j.icp_complete THEN NULL
           WHEN j.reorg_fresh OR j.size_band IN ('500_999', '1000_plus') OR j.tasha_effective = 'second' THEN 'A'
           WHEN j.fresh_signals > 0 THEN 'B'
           ELSE 'C'
         END AS suggested_tier
    FROM judged j
)
SELECT t.employer_id,
       t.tasha_effective,
       t.domain_suppressed,
       t.hard_exclusion,
       t.soft_exclusion,
       t.icp_complete,
       t.reorg_fresh,
       t.fresh_signals,
       t.all_signals,
       t.contacts,
       t.suggested_tier,
       CASE WHEN t.hard_exclusion IS NOT NULL THEN NULL
            ELSE coalesce(t.tier_override, t.suggested_tier) END AS effective_tier,
       CASE
         WHEN t.hard_exclusion = 'suppressed' THEN 'On the do-not-contact list'
         WHEN t.hard_exclusion = 'tasha_warm' THEN 'Tasha knows them: warm intro, no cold outreach'
         WHEN t.soft_exclusion = 'too_small'  THEN 'Excluded: under 100 employees'
         WHEN t.soft_exclusion = 'frontline'  THEN 'Excluded: mostly frontline staff'
         WHEN NOT t.icp_complete              THEN 'Fill in country and size to get a tier'
         WHEN t.suggested_tier = 'A' THEN concat_ws(', ',
              CASE WHEN t.reorg_fresh THEN 'fresh reorg signal' END,
              CASE WHEN t.size_band IN ('500_999', '1000_plus') THEN '500+ employees' END,
              CASE WHEN t.tasha_effective = 'second' THEN 'Tasha 2nd degree' END)
         WHEN t.suggested_tier = 'B' THEN 'ICP fit + ' || t.fresh_signals || ' fresh signal' || CASE WHEN t.fresh_signals > 1 THEN 's' ELSE '' END
         ELSE 'ICP fit, no fresh signal'
       END AS tier_reason
  FROM tiered t;

-- ── 7. Access: service role only ────────────────────────────────────────────

ALTER TABLE public.employer_signals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employer_signals        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.outreach_suppressions   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.employer_signals_status FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.employer_hitlist        FROM PUBLIC, anon, authenticated;
GRANT ALL    ON public.employer_signals        TO service_role;
GRANT ALL    ON public.outreach_suppressions   TO service_role;
GRANT SELECT ON public.employer_signals_status TO service_role;
GRANT SELECT ON public.employer_hitlist        TO service_role;

REVOKE ALL ON FUNCTION public.outreach_is_suppressed(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outreach_is_suppressed(TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.outreach_prospect_optout_to_list() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.outreach_list_to_prospects()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.employer_touch_guard()             FROM PUBLIC, anon, authenticated;
