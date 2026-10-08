-- Jev AI-impact label per career (docs/jev-cairnly-ontwerp-2026-09-23.md, 2.3b).
-- Shadow columns: written by the ai-impact edge function, read by nothing yet.
-- The old ai_impact_rating column is left untouched and stays the live label.
-- Rollback: drop these five columns.

alter table public.enriched_jobs
  add column if not exists ai_impact_level text,
  add column if not exists ai_impact_confidence real,
  add column if not exists ai_impact_probabilities jsonb,
  add column if not exists ai_impact_model text,
  add column if not exists ai_impact_at timestamptz;

alter table public.enriched_jobs
  drop constraint if exists enriched_jobs_ai_impact_level_check;
alter table public.enriched_jobs
  add constraint enriched_jobs_ai_impact_level_check
  check (ai_impact_level is null or ai_impact_level in ('Minimal', 'Moderate', 'High', 'Severe', 'Critical'));

comment on column public.enriched_jobs.ai_impact_level is
  'Jev label: how much of the work AI takes over (2.3b). Set by the ai-impact edge function.';
