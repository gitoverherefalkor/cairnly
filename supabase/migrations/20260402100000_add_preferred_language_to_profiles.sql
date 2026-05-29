-- Add preferred_language to profiles for multilingual support
-- Defaults to 'en' so all existing users continue in English
--
-- NOTE (2026-05-29): this file was authored in April but never applied to the
-- production DB — the column was missing for months, which 400'd every
-- useLanguage profile sync (PGRST204). Re-applied 2026-05-29 via Supabase MCP
-- under migration name `add_preferred_language_to_profiles`. Made idempotent
-- so a future replay of this file is a safe no-op.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en';
