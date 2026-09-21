-- Which agency went how deep into the demo.
--
-- The per-bureau slug rides along in the outreach demo link as utm_content and
-- was, until now, only written server-side to outreach_clicks by the edge
-- middleware. So we could see THAT an agency clicked and nothing about what
-- happened next, even though the demo already records seven annotated moments,
-- scroll depth and CTA clicks for every visitor.
--
-- One column closes that gap. analytics_events already carries utm_source,
-- utm_medium, utm_campaign and prospect on the sample_view row; utm_content is
-- the missing fourth. It holds an agency slug, never a person, so this does not
-- turn the cookieless pageview history into personal data the way a session_id
-- on purchases would.

alter table public.analytics_events
  add column if not exists utm_content text;

comment on column public.analytics_events.utm_content is
  'Per-bureau outreach slug from the demo link. Set on sample_view only; other events in the same session join on session_id.';

-- Only the outreach rows are ever filtered on, and they are a sliver of the table.
create index if not exists analytics_events_utm_content_idx
  on public.analytics_events (utm_content)
  where utm_content is not null;

-- Depth per agency. One row per slug that has at least one demo visit.
--
-- The seven moments are passed in scroll order, so the NUMBER of distinct
-- moments a session reached is a fair reading of how far it got: 0 is a bounce,
-- 7 is the whole conversation. Reported as the best session rather than the
-- average, because one person at an agency reading it properly is the signal;
-- a colleague who opened and closed it is not evidence against them.
create or replace view public.outreach_prospect_demo as
with sessies as (
  select distinct e.utm_content as slug, e.session_id, min(e.created_at) as eerste
  from public.analytics_events e
  where e.utm_content is not null
    and e.event_type = 'sample_view'
  group by e.utm_content, e.session_id
),
diepte as (
  select s.slug,
         s.session_id,
         s.eerste,
         (select count(distinct m.event_key)
            from public.analytics_events m
           where m.session_id = s.session_id
             and m.event_type = 'demo_moment') as momenten,
         exists (select 1
                   from public.analytics_events c
                  where c.session_id = s.session_id
                    and c.event_type = 'cta_click') as cta,
         exists (select 1
                   from public.page_views v
                  where v.session_id = s.session_id
                    and v.engaged) as engaged
    from sessies s
)
select slug,
       count(*)                                   as demo_sessies,
       max(momenten)                              as momenten_max,
       round(avg(momenten), 1)                    as momenten_gemiddeld,
       count(*) filter (where cta)                as sessies_met_cta,
       count(*) filter (where engaged)            as sessies_engaged,
       min(eerste)                                as eerste_bezoek,
       max(eerste)                                as laatste_bezoek
  from diepte
 group by slug;

comment on view public.outreach_prospect_demo is
  'Per outreach slug: how many demo sessions, how deep into the seven moments the best one got, and whether anyone clicked a CTA. Sits next to outreach_prospect_stats, which counts the clicks themselves.';

grant select on public.outreach_prospect_demo to service_role;
