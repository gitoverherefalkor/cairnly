-- Language contract: English canonical in `content`, translations beside it.
-- See docs/LANGUAGE_CONTRACT_PLAN.md (PR #81).
--
-- content_i18n shape:
--   { "nl": { "title": "…", "content": "…", "translated_at": "…", "model": "…" } }
--
-- Written ONLY by the translate-section edge function. n8n Supabase nodes must
-- never write this column: they store jsonb values as string primitives (the
-- documented house trap), which would break every reader.

ALTER TABLE public.report_sections
  ADD COLUMN IF NOT EXISTS content_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.report_sections.content_i18n IS
  'Translations of the canonical English content/title, keyed by language code, e.g. {"nl": {"title": "...", "content": "...", "translated_at": "...", "model": "..."}}. Written only by the translate-section edge function.';

COMMENT ON COLUMN public.report_sections.language IS
  'Language of the canonical content column. Always ''en'' for generated prose sections (approach, strengths, development, values, top_career_1/2/3, runner_ups, outside_box, dream_jobs, exec_summary, init_summary). Exceptions that are natively in the user''s language and never translated: chat_highlights, chapter_1_feedback. Display translations live in content_i18n.';

-- Staleness guard: any change to the canonical content or title invalidates
-- every stored translation, no matter which writer made the change (n8n WF6
-- regeneration, edge functions, manual SQL). Without this, a re-generated
-- section would keep serving its OLD translation and silently hide the update
-- from non-English users — worse than showing English.
CREATE OR REPLACE FUNCTION public.clear_stale_translations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.content_i18n := '{}'::jsonb;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_stale_translations ON public.report_sections;
CREATE TRIGGER trg_clear_stale_translations
  BEFORE UPDATE OF content, title ON public.report_sections
  FOR EACH ROW
  WHEN (
    (new.content IS DISTINCT FROM old.content OR new.title IS DISTINCT FROM old.title)
    -- If the writer explicitly set content_i18n in the same UPDATE (only
    -- translate-section does), trust it and don't wipe it.
    AND new.content_i18n IS NOT DISTINCT FROM old.content_i18n
  )
  EXECUTE FUNCTION public.clear_stale_translations();
