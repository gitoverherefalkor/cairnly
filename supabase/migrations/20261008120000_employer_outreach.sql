-- Employer outreach log (Tasha's channel): who she reached, how, and what came back.
--
-- Mostly LinkedIn and events, some cold mail, all logged by hand in /ops. No
-- n8n, no Gmail sync, no scraping: LinkedIn has no API we may use, and her mail
-- runs from her own inbox. So this is a log, not an engine.
--
--   employer_contacts  several people per employer (an event often yields two
--                      or three from one company), each with a LinkedIn stage.
--   employer_events    a pick-list, so per-event stats don't split over
--                      "HR Live" / "HRLive" / "hr live 2026".
--   employer_touches   one row per outreach action. Stats are counted from here.
--   employers.follow_up_on  the next date someone should chase this employer.
--
-- employers.contact_name / contact_email stay for now (backfilled into the
-- first contact below) but the UI no longer edits them.
--
-- Ops only, same as employers: RLS on, no policies, service role only.

CREATE TABLE IF NOT EXISTS public.employer_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id      UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  name             TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  role             TEXT,
  email            TEXT,
  linkedin_url     TEXT,
  linkedin_stage   TEXT NOT NULL DEFAULT 'none'
                   CHECK (linkedin_stage IN ('none', 'invite_sent', 'connected', 'in_conversation')),
  -- First time each stage was reached, so the funnel can be counted per period.
  invite_sent_at   TIMESTAMPTZ,
  connected_at     TIMESTAMPTZ,
  conversation_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employer_contacts_employer_id_idx ON public.employer_contacts (employer_id);

CREATE TABLE IF NOT EXISTS public.employer_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  event_date  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employer_touches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id  UUID NOT NULL REFERENCES public.employers(id) ON DELETE CASCADE,
  contact_id   UUID REFERENCES public.employer_contacts(id) ON DELETE SET NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('linkedin', 'event', 'email', 'phone', 'other')),
  kind         TEXT NOT NULL CHECK (kind IN ('first_contact', 'follow_up', 'reply', 'meeting')),
  event_id     UUID REFERENCES public.employer_events(id) ON DELETE SET NULL,
  touched_on   DATE NOT NULL DEFAULT current_date,
  note         TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employer_touches_employer_id_idx ON public.employer_touches (employer_id);
CREATE INDEX IF NOT EXISTS employer_touches_touched_on_idx ON public.employer_touches (touched_on);

COMMENT ON COLUMN public.employer_touches.kind IS
  'first_contact / follow_up = we reached out; reply = they answered; meeting = a call or meeting took place.';

ALTER TABLE public.employers ADD COLUMN IF NOT EXISTS follow_up_on DATE;

ALTER TABLE public.employer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_touches  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employer_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.employer_events   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.employer_touches  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.employer_contacts TO service_role;
GRANT ALL ON public.employer_events   TO service_role;
GRANT ALL ON public.employer_touches  TO service_role;

-- The single contact an employer had becomes its first contact.
INSERT INTO public.employer_contacts (employer_id, name, email)
SELECT e.id, coalesce(nullif(trim(e.contact_name), ''), split_part(e.contact_email, '@', 1)), e.contact_email
  FROM public.employers e
 WHERE (nullif(trim(e.contact_name), '') IS NOT NULL OR e.contact_email IS NOT NULL)
   AND NOT EXISTS (SELECT 1 FROM public.employer_contacts c WHERE c.employer_id = e.id);
