-- Question-level survey progress, written by the survey client on autosave.
--
-- The dashboard computes resume progress from the answer payload (questions
-- answered / sections complete, via the shared validator). The reminder email
-- previously derived a SEPARATE, coarser number from survey_last_section, which
-- could read 100% the moment a user reached the last section even with
-- questions unanswered ("You're 100% through ... continue where you left off").
--
-- Storing the validated progress here lets the email read the SAME number the
-- dashboard shows, with the validator living in exactly one place (the client).
-- Shape mirrors the SurveyProgress interface in src/lib/surveyProgress.ts:
--   { questionsAnswered, totalQuestions, sectionsComplete, totalSections }
ALTER TABLE public.user_engagement_tracking
  ADD COLUMN IF NOT EXISTS survey_progress jsonb;

COMMENT ON COLUMN public.user_engagement_tracking.survey_progress IS
  'Question-level survey progress {questionsAnswered,totalQuestions,sectionsComplete,totalSections}, written by the survey client on autosave. Read by send-reminder-email so the reminder % matches the dashboard.';
