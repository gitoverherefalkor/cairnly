-- Saved chat responses.
--
-- When a user clicks "Save" on an AI-coach response in the chat, that response
-- is snapshotted here, tagged with the report section that was in focus, and
-- surfaced in that section of the dashboard report.
--
-- Content is stored verbatim rather than as an FK to chat_messages: the
-- frontend assigns temporary message ids that don't match the persisted rows,
-- so a content snapshot is the reliable record. content_hash is a generated
-- md5 of the content, backing a uniqueness guard against double-saves.

CREATE TABLE IF NOT EXISTS public.saved_chat_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The report section in focus when the response was saved (e.g. 'top_career_1',
  -- 'approach'). Nullable: a save made outside any section still persists.
  section_type TEXT,
  -- Short AI-generated label (gpt-5.4-nano) shown on the collapsed entry.
  label TEXT,
  content TEXT NOT NULL,
  -- Generated md5 of content — backs the dedup constraint cheaply (a unique
  -- index on the raw TEXT could exceed btree size limits for long responses).
  content_hash TEXT GENERATED ALWAYS AS (md5(content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_chat_responses_unique UNIQUE (report_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_saved_chat_responses_report
  ON public.saved_chat_responses (report_id);

-- RLS: a user fully manages (read / insert / delete) their own saved rows.
-- The save edge function writes via the service role; unsave + report reads
-- go directly from the browser under this policy.
ALTER TABLE public.saved_chat_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_chat_responses'
      AND policyname = 'Users manage their own saved chat responses'
  ) THEN
    CREATE POLICY "Users manage their own saved chat responses"
      ON public.saved_chat_responses FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saved_chat_responses'
      AND policyname = 'Service role full access on saved chat responses'
  ) THEN
    CREATE POLICY "Service role full access on saved chat responses"
      ON public.saved_chat_responses FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.saved_chat_responses IS
'Coach responses a user saved from the chat, snapshotted and tagged to a report section for display in the dashboard report.';
