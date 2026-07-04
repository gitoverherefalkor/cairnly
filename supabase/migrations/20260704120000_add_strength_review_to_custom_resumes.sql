-- Adds the strength_review jsonb column to custom_resumes for the Résumé
-- Strengthen coaching layer (see docs/superpowers/specs/
-- 2026-07-01-resume-strengthen-coaching-design.md). Holds analysis status,
-- deterministic strength scores, and the surfaced issues with their
-- pending/applied/skipped state. Nullable: rows without a review simply
-- haven't been analyzed.

alter table custom_resumes
  add column if not exists strength_review jsonb;
