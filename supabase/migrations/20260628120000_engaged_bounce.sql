-- Move bounce from "single pageview" to an engaged-session definition, which is
-- far truer for a single-page app. A view fires an "engage" ping after 10s on
-- the page; that marks the session engaged. A session is a bounce only if it had
-- one pageview AND never became engaged (i.e. the visitor left within ~10s).

alter table page_views
  add column if not exists engaged boolean not null default false;

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
    select session_id, count(*) as views, bool_or(engaged) as engaged
    from recent group by session_id
  )
  select jsonb_build_object(
    'visits_7d', (select count(*) from sessions),
    'visits_today', (
      select count(distinct session_id) from page_views
      where created_at >= date_trunc('day', now())
    ),
    'pageviews_7d', (select count(*) from recent),
    'bounce_rate_7d', coalesce(
      round(100.0 * (select count(*) from sessions where views = 1 and not engaged)
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
