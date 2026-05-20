-- Add kanban workflow columns to saved_jobs so the redesigned /jobs page can
-- track Saved → Applied → Interviewing → Archived. The table previously stored
-- saved-or-not only; these additive columns are safe — existing rows default
-- to 'saved' and all new fields are nullable.

ALTER TABLE public.saved_jobs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'saved',
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS from_career text,
  ADD COLUMN IF NOT EXISTS match_score smallint;

-- Constrain status to the four kanban columns.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_jobs_status_check'
  ) THEN
    ALTER TABLE public.saved_jobs
      ADD CONSTRAINT saved_jobs_status_check
      CHECK (status IN ('saved', 'applied', 'interviewing', 'archived'));
  END IF;
END$$;

-- Speed up the kanban grouping query (one read per user, partitioned by column).
CREATE INDEX IF NOT EXISTS saved_jobs_user_status_idx
  ON public.saved_jobs (user_id, status);

COMMENT ON COLUMN public.saved_jobs.status IS
  'Kanban column: saved | applied | interviewing | archived';
COMMENT ON COLUMN public.saved_jobs.from_career IS
  'Originating career title (e.g. "AI Tools Marketplace Publisher") so the kanban can show provenance.';
COMMENT ON COLUMN public.saved_jobs.match_score IS
  '0–10 AI match score captured at save time so the kanban card can keep the tier color.';
