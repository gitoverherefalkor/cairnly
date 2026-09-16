-- "Not for me" — let a user set aside a career recommendation they don't want.
--
-- Why its own table rather than a flag on report_sections: that table's
-- `metadata` jsonb is written by n8n (WF4 writes fit_scores, comparison, move,
-- origin). A browser write racing a workflow write would clobber one or the
-- other. A separate table also keeps the /ops aggregate and the retention
-- purge trivial.
--
-- section_id is the right key for every case. top_career_1/2/3 are one row
-- each; runner_ups / outside_box / dream_jobs are already one row PER CAREER,
-- split on ---CAREER_SPLIT--- by WF4. So "one dismissal per section row"
-- covers both shapes with no special casing.
--
-- section_type and career_title are denormalised on purpose: /ops aggregates
-- across users without joining, and career_title survives the title being
-- re-translated later (content_i18n churn) so the historical signal stays
-- readable.

CREATE TABLE IF NOT EXISTS public.dismissed_careers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.report_sections(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  career_title TEXT NOT NULL,
  -- Optional, skippable. NULL means the user dismissed without saying why.
  reason TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dismissed_careers_unique UNIQUE (report_id, section_id),
  CONSTRAINT dismissed_careers_reason_valid CHECK (
    reason IS NULL OR reason IN (
      'not_interested', 'wrong_level', 'pay_too_low', 'already_did', 'location', 'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_dismissed_careers_report
  ON public.dismissed_careers (report_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_careers_user
  ON public.dismissed_careers (user_id);
-- Backs the /ops aggregate (group by section_type, reason).
CREATE INDEX IF NOT EXISTS idx_dismissed_careers_type
  ON public.dismissed_careers (section_type);

ALTER TABLE public.dismissed_careers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dismissed_careers'
      AND policyname = 'Users manage their own dismissed careers'
  ) THEN
    CREATE POLICY "Users manage their own dismissed careers"
      ON public.dismissed_careers FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dismissed_careers'
      AND policyname = 'Service role full access on dismissed careers'
  ) THEN
    CREATE POLICY "Service role full access on dismissed careers"
      ON public.dismissed_careers FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.dismissed_careers IS
  'Careers the user set aside via the dashboard "Not for me" control. Greys the card, omits it from the PDF (runner-ups/outside-box) or marks it "set aside" (top 3), and feeds the /ops dismissal aggregate. Never read by any n8n workflow.';
