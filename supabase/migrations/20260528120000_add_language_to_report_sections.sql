-- Adds a language column to report_sections so we can store per-language report content.
-- English remains the default. Dutch (and future languages) populate the same table.
-- Pairs with `add_translations_jsonb.sql` (next migration) which adds translation caches
-- to static content tables. See LOCALIZATION_PLAN.md Phase 0 for context.

ALTER TABLE public.report_sections
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_report_sections_language
  ON public.report_sections(language);

COMMENT ON COLUMN public.report_sections.language IS
  'BCP-47 language code (e.g. ''en'', ''nl'', ''de''). Written by n8n WF1/WF3/WF4 based on user preferred_language at generation time.';
