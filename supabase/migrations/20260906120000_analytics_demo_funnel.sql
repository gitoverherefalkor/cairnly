-- Demo funnel analytics: depth inside the demo, which CTA led there, and
-- whether a demo visit converts — without linking anything to a person.
--
-- Design note (the reason this looks the way it does): the obvious shortcut
-- is to put the analytics session_id on `purchases` and `intake_sessions` so
-- they can be joined to page_views. Both tables hold an email address, so
-- that one column would turn the whole cookieless, no-PII pageview history
-- into personally identifiable data — exactly what the privacy policy says
-- we do not do. Instead the conversion is recorded as its own EVENT carrying
-- only the session id: same funnel, nothing identifiable touched, and no
-- migration on the tables that hold names.
--
-- Purely additive: two nullable columns, a widened check constraint, two
-- indexes and one read-only function. Reversible by dropping them again.

-- 1. Two new event types.
--    demo_moment  one of the seven annotated moments in the chat replay was
--                 scrolled past (the same seven the moments bar lights up).
--    conversion   an intake chat was started, or a purchase completed. Fired
--                 from the browser, so it carries the analytics session; the
--                 identifiable row is written elsewhere and stays unlinked.
alter table public.analytics_events
  drop constraint if exists analytics_events_event_type_check;

alter table public.analytics_events
  add constraint analytics_events_event_type_check
  check (event_type in ('scroll_depth', 'cta_click', 'sample_view', 'demo_moment', 'conversion'));

-- 2. The key of a keyed event, and which persona a demo page was showing.
alter table public.analytics_events
  add column if not exists event_key text,
  add column if not exists persona text;

comment on column public.analytics_events.event_key is
  'Stable slug identifying WHICH thing happened for keyed events: the moment id for demo_moment (pushback, kept, pillTag, movePill, radar, askRole, dictated), or intake_started / purchase for conversion. Chosen by us in code, never visitor input.';
comment on column public.analytics_events.persona is
  'Which frozen demo persona the page was showing (marcel | emma). page_views stores pathname only, so /demo reads the same for both; this is the split that makes the demo measurable. Resolved in code from language + ?persona=, not copied blindly from the URL.';

alter table public.analytics_events
  add constraint analytics_events_keyed_has_key
  check (event_type not in ('demo_moment', 'conversion') or event_key is not null);

-- 3. One row per (session, key) for the keyed events. A moment can be
--    scrolled past repeatedly and a payment-success page can be reloaded;
--    both are "did this happen in this session", not a count. Mirrors the
--    scroll-depth dedupe index, and backs up the client-side guard.
create unique index if not exists analytics_events_keyed_dedupe_idx
  on public.analytics_events (session_id, event_key)
  where event_type in ('demo_moment', 'conversion');

-- 4. The funnel itself, read-only and admin-gated through ops-feed (the
--    table is service-role only, like page_views). Everything is counted in
--    SESSIONS, not events: "how many people got here", never "how many
--    times". Splitting the conversion counts by whether the session saw the
--    demo is the question this whole thing exists to answer.
create or replace function ops_funnel_stats(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    -- Clamped: this runs behind an admin call, but a stray 100000 would
    -- still scan the whole table.
    select now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90))) as since
  ),
  views as (
    select pv.session_id, pv.path, pv.created_at
    from page_views pv, bounds b
    where pv.created_at > b.since
  ),
  events as (
    select ae.session_id, ae.event_type, ae.event_key, ae.cta_id, ae.persona, ae.created_at
    from analytics_events ae, bounds b
    where ae.created_at > b.since
  ),
  sessions as (select distinct session_id from views),
  -- First time each session opened any demo page (/demo, /demo/dashboard,
  -- /demo/jobs, /demo/survey).
  demo_first as (
    select session_id, min(created_at) as first_demo
    from views
    where path like '/demo%'
    group by session_id
  ),
  conversions as (
    select distinct session_id, event_key
    from events
    where event_type = 'conversion'
  )
  select jsonb_build_object(
    'days', (select greatest(1, least(coalesce(p_days, 7), 90))),
    'sessions', (select count(*) from sessions),
    'demo_sessions', (select count(*) from demo_first),
    -- Conversions among sessions that did / did not see the demo.
    'demo', jsonb_build_object(
      'intake_started', (
        select count(*) from conversions c
        where c.event_key = 'intake_started' and exists (select 1 from demo_first d where d.session_id = c.session_id)
      ),
      'purchase', (
        select count(*) from conversions c
        where c.event_key = 'purchase' and exists (select 1 from demo_first d where d.session_id = c.session_id)
      )
    ),
    'no_demo', jsonb_build_object(
      'intake_started', (
        select count(*) from conversions c
        where c.event_key = 'intake_started' and not exists (select 1 from demo_first d where d.session_id = c.session_id)
      ),
      'purchase', (
        select count(*) from conversions c
        where c.event_key = 'purchase' and not exists (select 1 from demo_first d where d.session_id = c.session_id)
      )
    ),
    -- How deep into the replay people actually get.
    'moments', coalesce((
      select jsonb_agg(t order by t.sessions desc)
      from (
        select event_key as key, count(distinct session_id) as sessions
        from events where event_type = 'demo_moment' and event_key is not null
        group by event_key
      ) t
    ), '[]'::jsonb),
    -- Which persona demo visitors chose to read.
    'personas', coalesce((
      select jsonb_agg(t order by t.sessions desc)
      from (
        select persona, count(distinct session_id) as sessions
        from events where event_type = 'sample_view' and persona is not null
        group by persona
      ) t
    ), '[]'::jsonb),
    -- Which CTA sent them in: the last button clicked at or before the
    -- session's first demo view. Sessions that arrived without clicking one
    -- (direct link, search) fall into the null bucket, which is a real
    -- answer rather than a gap.
    'entry_ctas', coalesce((
      select jsonb_agg(t order by t.sessions desc)
      from (
        select coalesce((
                 select e.cta_id from events e
                 where e.session_id = d.session_id
                   and e.event_type = 'cta_click'
                   and e.created_at <= d.first_demo
                 order by e.created_at desc
                 limit 1
               ), '(direct)') as cta_id,
               count(*) as sessions
        from demo_first d
        group by 1
      ) t
    ), '[]'::jsonb)
  );
$$;

comment on function ops_funnel_stats(integer) is
  'Demo funnel for the ops dashboard: sessions, demo sessions, conversions split by whether the demo was seen, depth inside the replay, persona split and entry CTA. Counts sessions, never events. Read-only.';
