-- AI-impact title pins: one Jev label per career title + ownership, first one wins.
--
-- The ai-impact edge function reads this table before asking Jev, so the same career shows the same
-- AI pill on every card type (Top 15 careers in enriched_jobs, outside-the-box and dream-job cards,
-- which are not in enriched_jobs). title_norm = lower-case title with everything but letters and
-- digits removed, so "Campervan" and "Camper Van" share a pin. ownership = own_work (founder,
-- freelance_fractional, "Own Company ...") or employee, same split as aiImpactRules.ownershipOf.
-- To relabel everything (new Jev questions or rules): delete from ai_impact_pins and null out
-- enriched_jobs.ai_impact_level. Service role only; no user ever reads this table.

create table if not exists public.ai_impact_pins (
  title_norm text not null,
  ownership text not null check (ownership in ('own_work', 'employee')),
  level text not null check (level in ('Minimal', 'Moderate', 'High', 'Severe', 'Critical')),
  confidence real,
  probabilities jsonb,
  model text,
  sample_title text,
  source text not null default 'jev',
  created_at timestamptz not null default now(),
  primary key (title_norm, ownership)
);

alter table public.ai_impact_pins enable row level security;
revoke all on public.ai_impact_pins from anon, authenticated;

comment on table public.ai_impact_pins is
  'First Jev AI-impact label per normalized career title + ownership; read and written only by the ai-impact edge function.';

-- Seed from the labels already on enriched_jobs (oldest label per title + ownership wins).
insert into public.ai_impact_pins (title_norm, ownership, level, confidence, probabilities, model, sample_title, source, created_at)
select distinct on (title_norm, ownership)
  title_norm, ownership, ai_impact_level, ai_impact_confidence, ai_impact_probabilities, ai_impact_model,
  career_title, 'enriched_jobs', coalesce(ai_impact_at, now())
from (
  select
    regexp_replace(lower(career_title), '[^a-z0-9]', '', 'g') as title_norm,
    case
      when lower(trim(coalesce(path_type, ''))) in ('founder', 'freelance_fractional') then 'own_work'
      when lower(trim(coalesce(company_size_type, ''))) like 'own company%' then 'own_work'
      else 'employee'
    end as ownership,
    ai_impact_level, ai_impact_confidence, ai_impact_probabilities, ai_impact_model, career_title, ai_impact_at
  from public.enriched_jobs
  where ai_impact_level is not null and coalesce(career_title, '') <> ''
) s
where title_norm <> ''
order by title_norm, ownership, ai_impact_at asc nulls last
on conflict (title_norm, ownership) do nothing;
