-- Cover Letter feature: per-application cover letters generated against a
-- specific scraped job posting.
--
-- Cover letters are inherently per-posting (org name, role title, JD wording),
-- so they get their own table keyed by user + job snapshot — unlike custom
-- résumés which are per career type. The user picks a saved tailored résumé
-- (custom_resumes row) to anchor the letter's voice; that link is nullable so
-- deleting the résumé doesn't cascade-kill the letter.
--
-- The job_* columns are a *snapshot* of the JobListing at generation time. We
-- don't FK to a jobs table because the scrape isn't persisted — the user
-- triggers a fresh search each time and we don't want letters to vanish when
-- the search results expire.

CREATE TABLE IF NOT EXISTS public.cover_letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  -- The tailored résumé this letter is voiced after. SET NULL so deleting the
  -- résumé doesn't take the letter with it — the snapshot in letter_json is
  -- enough to re-render.
  source_resume_id UUID REFERENCES public.custom_resumes(id) ON DELETE SET NULL,
  -- Snapshot of the JobListing this letter was generated for. Stored inline
  -- so the letter survives the scrape going stale.
  job_external_id TEXT,
  job_company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_location TEXT,
  job_apply_url TEXT,
  -- Full JD text passed to the LLM at generation time. Kept for transparency
  -- ("what did the model see when it wrote this?") and to allow regeneration.
  job_description TEXT,
  -- Source of truth for the letter. { greeting, opening, body_paragraphs[], closing }.
  letter_json JSONB,
  -- Generation status. Inserted as 'processing' by the edge function and
  -- updated to 'completed' (or 'failed') by the n8n cover-letter workflow.
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cover_letters_user
  ON public.cover_letters (user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_report
  ON public.cover_letters (report_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_resume
  ON public.cover_letters (source_resume_id);

ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cover_letters'
      AND policyname = 'Users manage their own cover letters'
  ) THEN
    CREATE POLICY "Users manage their own cover letters"
      ON public.cover_letters FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cover_letters'
      AND policyname = 'Service role full access on cover letters'
  ) THEN
    CREATE POLICY "Service role full access on cover letters"
      ON public.cover_letters FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.cover_letters IS
'Per-application cover letters generated against a specific scraped job posting. Job fields are snapshots from the JobListing at generation time so letters survive search-result expiry.';
