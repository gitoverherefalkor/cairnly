-- Which subject line an agency got, and how each one did.
--
-- Read the honest caveat before reading the numbers: with 31 agencies left the
-- two arms are about 15 each. Against the observed baseline (40 sent, 27.5%
-- confirmed clicks, 15% replies) that only registers a tripling. This exists
-- because the assignment is worth having anyway — it stops a whole tier
-- landing on one variant — and because the machinery is then ready if the list
-- grows to the ~120 per arm a real test would need.
--
-- 'a' is the subject every mail so far carried, so the 40 already sent are
-- backfilled to 'a' rather than left null. That keeps "sent under a" honest
-- and lets the historical rows join the comparison, with the tier confound
-- visible rather than hidden.

alter table public.outreach_prospects
  add column if not exists subject_variant text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'outreach_prospects_subject_variant_check'
  ) then
    alter table public.outreach_prospects
      add constraint outreach_prospects_subject_variant_check
      check (subject_variant is null or subject_variant in ('a', 'b'));
  end if;
end $$;

comment on column public.outreach_prospects.subject_variant is
  'Which subject line this agency gets. a = "Vraagje over jullie spoor 2-trajecten" (the original), b = "Doen jullie het loopbaanonderzoek in spoor 2 zelf?". Text lives in src/lib/outreach.ts.';

-- Everything already out the door carried subject a.
update public.outreach_prospects
   set subject_variant = 'a'
 where subject_variant is null
   and (verzonden_op is not null or status <> 'nog_niet_benaderd');

-- The rest alternate WITHIN tier, so tier B and tier C each split evenly
-- instead of one variant inheriting the better half of the list.
with te_verdelen as (
  select slug,
         row_number() over (partition by tier order by slug) as rn
    from public.outreach_prospects
   where subject_variant is null
)
update public.outreach_prospects p
   set subject_variant = case when t.rn % 2 = 1 then 'a' else 'b' end
  from te_verdelen t
 where p.slug = t.slug;

-- Per variant: what went out, what came back, and how deep they got.
-- Replies are the metric that matters; clicks are the step before it.
create or replace view public.outreach_subject_stats as
select p.subject_variant                                        as variant,
       count(*)                                                 as bureaus,
       count(*) filter (where p.verzonden_op is not null
                           or p.status <> 'nog_niet_benaderd')  as verstuurd,
       count(*) filter (where coalesce(s.kliks_bevestigd, 0) > 0) as met_klik,
       count(*) filter (where p.status in ('gereageerd', 'codes_gemint',
                                           'partner_aangemaakt', 'afgewezen')) as reacties,
       count(*) filter (where p.status in ('gereageerd', 'codes_gemint',
                                           'partner_aangemaakt'))              as positieve_reacties,
       -- Null until somebody visits with the slug attached; averaged over the
       -- agencies that have a measurement, never over the ones that do not.
       round(avg(d.momenten_max) filter (where d.momenten_max is not null), 1) as momenten_gemiddeld
  from public.outreach_prospects p
  left join public.outreach_prospect_stats s on s.slug = p.slug
  left join public.outreach_prospect_demo  d on d.slug = p.slug
 where p.subject_variant is not null
 group by p.subject_variant;

comment on view public.outreach_subject_stats is
  'Subject-line A/B readout. Underpowered by design at the current list size — read it as a direction, not a result.';

grant select on public.outreach_subject_stats to service_role;
