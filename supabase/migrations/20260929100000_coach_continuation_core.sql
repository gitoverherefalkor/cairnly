-- Phase C, step 2 (data): the coach after the report.
-- Spec: docs/superpowers/specs/2026-09-15-jobs-cap-chat-continuation-dismiss-design.md
--
-- Adds:
--   app_flags               global feature switches (coach_enabled = kill switch)
--   coach_usage             monthly message counter per report (budget)
--   coach_next_steps        steps agreed with the coach + check-in date
--   coach_notes             short running summary of coach conversations
--   get_coach_snapshot()    compact JSON of everything the coach may read,
--                           loaded by WF5C before every reply
--   coach_save_next_step()  the only write path WF5C has (never report_sections)
--
-- Nothing here changes existing tables or the report.

-- ---------------------------------------------------------------- app_flags
CREATE TABLE IF NOT EXISTS public.app_flags (
  key TEXT PRIMARY KEY,
  value BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;

-- Anyone signed in may read flags (the frontend hides entry points when off).
-- No write policy: only the service role / SQL editor can flip a flag.
DROP POLICY IF EXISTS "Authenticated read app flags" ON public.app_flags;
CREATE POLICY "Authenticated read app flags"
  ON public.app_flags FOR SELECT TO authenticated USING (true);

-- Starts OFF. Sjoerd flips it on at launch (see spec runbook).
INSERT INTO public.app_flags (key, value, note)
VALUES ('coach_enabled', false, 'Kill switch for the post-report coach (WF5C)')
ON CONFLICT (key) DO NOTHING;

-- -------------------------------------------------------------- coach_usage
CREATE TABLE IF NOT EXISTS public.coach_usage (
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  month DATE NOT NULL,                       -- first day of the month
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages_used INTEGER NOT NULL DEFAULT 0,
  first_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, month)
);
CREATE INDEX IF NOT EXISTS idx_coach_usage_user ON public.coach_usage (user_id);
ALTER TABLE public.coach_usage ENABLE ROW LEVEL SECURITY;

-- User reads their own counter; writes happen in chat-proxy (service role).
DROP POLICY IF EXISTS "Users read own coach usage" ON public.coach_usage;
CREATE POLICY "Users read own coach usage"
  ON public.coach_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- --------------------------------------------------------- coach_next_steps
CREATE TABLE IF NOT EXISTS public.coach_next_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (length(step) BETWEEN 3 AND 400),
  career_title TEXT,
  check_in_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dropped')),
  check_in_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_next_steps_report ON public.coach_next_steps (report_id);
CREATE INDEX IF NOT EXISTS idx_coach_next_steps_checkin
  ON public.coach_next_steps (check_in_at) WHERE status = 'open' AND check_in_sent_at IS NULL;
ALTER TABLE public.coach_next_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own next steps" ON public.coach_next_steps;
CREATE POLICY "Users read own next steps"
  ON public.coach_next_steps FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users may only change the status of their own steps (column-level grant).
DROP POLICY IF EXISTS "Users update own next steps" ON public.coach_next_steps;
CREATE POLICY "Users update own next steps"
  ON public.coach_next_steps FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
REVOKE UPDATE ON public.coach_next_steps FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.coach_next_steps TO authenticated;

-- -------------------------------------------------------------- coach_notes
CREATE TABLE IF NOT EXISTS public.coach_notes (
  report_id UUID PRIMARY KEY REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  source_through TIMESTAMPTZ,               -- last chat message the notes cover
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own coach notes" ON public.coach_notes;
CREATE POLICY "Users read own coach notes"
  ON public.coach_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ------------------------------------------------------ get_coach_snapshot
-- Everything the post-report coach may read, compact. Career bodies are
-- trimmed; the coach gets titles, ratings, the feedback WF6 wrote, and the
-- user's own signals (dismissals, saved messages, highlights, notes, steps).
CREATE OR REPLACE FUNCTION public.get_coach_snapshot(p_report_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'exec_summary', (
      SELECT content FROM report_sections
      WHERE report_id = p_report_id AND section_type IN ('exec_summary', 'executive_summary')
      ORDER BY updated_at DESC NULLS LAST LIMIT 1),
    'discussion_highlights', (
      SELECT content FROM report_sections
      WHERE report_id = p_report_id AND section_type = 'chat_highlights'
      ORDER BY updated_at DESC NULLS LAST LIMIT 1),
    'personality', (
      SELECT jsonb_agg(jsonb_build_object(
               'section', rs.section_type,
               'title', rs.title,
               'user_feedback', rs.feedback) ORDER BY rs.order_number)
      FROM report_sections rs
      WHERE rs.report_id = p_report_id
        AND rs.section_type IN ('approach', 'strengths', 'development', 'values')),
    'careers', (
      SELECT jsonb_agg(jsonb_build_object(
               'section', rs.section_type,
               'title', rs.title,
               'match_score', rs.score,
               'move', rs.metadata->>'move',
               'salary', rs.metadata->'salary',
               'chat_generated', CASE WHEN rs.metadata->>'origin' = 'chat_replacement' THEN true END,
               'summary', left(regexp_replace(rs.content, '\s+', ' ', 'g'), 500),
               'user_feedback', rs.feedback,
               'deep_dive', left(rs.explore, 800),
               'set_aside', CASE WHEN dc.id IS NOT NULL THEN
                 jsonb_build_object('reason', dc.reason, 'note', dc.note) END)
             ORDER BY CASE rs.section_type
                        WHEN 'top_career_1' THEN 1 WHEN 'top_career_2' THEN 2
                        WHEN 'top_career_3' THEN 3 WHEN 'runner_ups' THEN 4
                        WHEN 'outside_box' THEN 5 WHEN 'dream_jobs' THEN 6 ELSE 7 END,
                      rs.order_number)
      FROM report_sections rs
      LEFT JOIN dismissed_careers dc ON dc.section_id = rs.id
      WHERE rs.report_id = p_report_id
        AND rs.section_type IN ('top_career_1', 'top_career_2', 'top_career_3',
                                'runner_ups', 'outside_box', 'dream_jobs')
        AND coalesce(rs.metadata->>'empty', 'false') <> 'true'),
    'saved_messages', (
      SELECT jsonb_agg(jsonb_build_object(
               'section', s.section_type,
               'label', s.label,
               'text', left(s.content, 600)) ORDER BY s.created_at)
      FROM saved_chat_responses s WHERE s.report_id = p_report_id),
    'coach_notes', (
      SELECT notes FROM coach_notes WHERE report_id = p_report_id),
    'next_steps', (
      SELECT jsonb_agg(jsonb_build_object(
               'id', n.id, 'step', n.step, 'career', n.career_title,
               'check_in_at', n.check_in_at, 'status', n.status) ORDER BY n.created_at)
      FROM coach_next_steps n
      WHERE n.report_id = p_report_id AND n.status <> 'dropped')
  ));
$$;

REVOKE ALL ON FUNCTION public.get_coach_snapshot(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_coach_snapshot(UUID) TO service_role;

-- --------------------------------------------------- coach_save_next_step
-- WF5C's only write. report_id comes from the trigger metadata (set by
-- chat-proxy after auth), never from the model. Max 3 open steps per report;
-- check-in is clamped to 3-42 days out.
CREATE OR REPLACE FUNCTION public.coach_save_next_step(
  p_report_id UUID,
  p_step TEXT,
  p_check_in_days INTEGER,
  p_career_title TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_open INTEGER;
BEGIN
  SELECT user_id INTO v_user FROM reports WHERE id = p_report_id;
  IF v_user IS NULL THEN
    RETURN 'error: unknown report';
  END IF;

  SELECT count(*) INTO v_open FROM coach_next_steps
  WHERE report_id = p_report_id AND status = 'open';
  IF v_open >= 3 THEN
    RETURN 'not saved: this user already has 3 open next steps. Ask which one to replace or mark done first.';
  END IF;

  INSERT INTO coach_next_steps (user_id, report_id, step, career_title, check_in_at)
  VALUES (v_user, p_report_id, left(trim(p_step), 400), nullif(trim(p_career_title), ''),
          current_date + greatest(3, least(coalesce(p_check_in_days, 14), 42)));

  RETURN 'saved';
END;
$$;

REVOKE ALL ON FUNCTION public.coach_save_next_step(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coach_save_next_step(UUID, TEXT, INTEGER, TEXT) TO service_role;

COMMENT ON TABLE public.coach_next_steps IS 'Next steps agreed with the post-report coach (WF5C), with a check-in date.';
COMMENT ON TABLE public.coach_notes IS 'Short running summary of a user''s coach conversations, kept with the report.';
COMMENT ON TABLE public.coach_usage IS 'Monthly post-report coach message counter per report (budget, enforced in chat-proxy).';
