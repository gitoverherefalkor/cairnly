-- Adds a translations JSONB column to tables holding English-canonical static content.
-- Shape per row: { "nl": { "label": "...", ... }, "de": { ... } }
-- Reading code coalesces: row.translations->>'<lang>' ?? row.<english_field>.
-- See LOCALIZATION_PLAN.md Phase 0 (foundation) and Phase 3/5 (population).

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.survey_sections
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.enriched_jobs
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.questions.translations IS
  'Per-language overrides for label, help_text, choices. Populated by scripts/translate-survey.ts (Phase 3).';
COMMENT ON COLUMN public.survey_sections.translations IS
  'Per-language overrides for title, description. Populated by scripts/translate-survey.ts (Phase 3).';
COMMENT ON COLUMN public.enriched_jobs.translations IS
  'Per-language overrides for narrative fields. Lazy-populated by n8n WF2 sub-step on first user-touch (Phase 5).';
