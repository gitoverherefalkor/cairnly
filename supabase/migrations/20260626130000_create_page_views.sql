-- First-party, privacy-light web analytics. Each page view is a row written by
-- the public track-view edge function (service role). No IP, no PII — just a
-- random per-tab session id, the path, and an optional external referrer.
-- Read only by ops-feed via the ops_traffic_stats() function.

create table if not exists page_views (
  id          uuid        primary key default gen_random_uuid(),
  session_id  text        not null,
  path        text        not null,
  referrer    text,
  created_at  timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on page_views (created_at desc);
create index if not exists page_views_session_idx on page_views (session_id);

alter table page_views enable row level security;
-- No policies: service-role only (track-view writes, ops-feed reads).

-- Aggregate traffic stats for the ops dashboard. A "visit" is a session; a
-- "bounce" is a session with exactly one page view. Window: last 7 days.
create or replace function ops_traffic_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select * from page_views where created_at > now() - interval '7 days'
  ),
  sessions as (
    select session_id, count(*) as views from recent group by session_id
  )
  select jsonb_build_object(
    'visits_7d', (select count(*) from sessions),
    'visits_today', (
      select count(distinct session_id) from page_views
      where created_at >= date_trunc('day', now())
    ),
    'pageviews_7d', (select count(*) from recent),
    'bounce_rate_7d', coalesce(
      round(100.0 * (select count(*) from sessions where views = 1)
            / nullif((select count(*) from sessions), 0)),
      0),
    'top_pages', coalesce((
      select jsonb_agg(t)
      from (
        select path, count(*) as views
        from recent group by path order by count(*) desc limit 6
      ) t
    ), '[]'::jsonb)
  );
$$;
