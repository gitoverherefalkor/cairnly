-- Marketing reach for the ops dashboard (cairnly.io/ops → Marketing tab).
--
-- Two tables + one RPC:
--   marketing_posts       one row per LinkedIn post (verbatim body + metadata +
--                         soft calls: comment sentiment and gut read).
--   marketing_post_stats  hand-entered engagement snapshots. Reach keeps
--                         climbing for days, so numbers are appended as
--                         timestamped snapshots (day 3 vs day 14), never
--                         overwritten — the growth curve is preserved.
--   ops_traffic_series()  hourly visitor buckets from page_views, so post
--                         timestamps can be overlaid on the real traffic to
--                         eyeball whether a post moved site visits.
--
-- Both tables mirror page_views: RLS on, NO policies → service-role only. The
-- Marketing tab reads/writes exclusively through the admin-gated ops-marketing
-- edge function (service role), never directly from the browser.

-- ─── Posts ────────────────────────────────────────────────────────────────────
create table if not exists marketing_posts (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- When it went live (or is scheduled for). Null while still a draft.
  posted_at         timestamptz,
  status            text        not null default 'draft'
                                check (status in ('draft', 'scheduled', 'posted')),
  -- Kept separable: Sjoerd now, his wife will post under the Cairnly banner
  -- later in her own voice.
  author            text        not null default 'Sjoerd',
  profile           text        not null default 'personal'
                                check (profile in ('personal', 'company')),
  -- Free text on purpose — new post types / hook styles shouldn't need a
  -- migration. The UI offers presets but doesn't hard-constrain them.
  post_type         text,
  hook_style        text,
  has_image         boolean     not null default false,
  image_type        text,
  is_series         boolean     not null default false,
  series_name       text,
  -- The actual verbatim post text, pasted in once live. This is what makes the
  -- "what kind of post works" analysis useful later.
  body              text        not null default '',
  -- Soft calls.
  comment_sentiment text        check (comment_sentiment in ('positive', 'mixed', 'critical', 'quiet')),
  gut_read          text        check (gut_read in ('win', 'neutral', 'miss')),
  notes             text
);

create index if not exists marketing_posts_posted_at_idx on marketing_posts (posted_at desc nulls first);

alter table marketing_posts enable row level security;
-- No policies: service-role only (ops-marketing reads + writes).

-- ─── Stat snapshots ───────────────────────────────────────────────────────────
create table if not exists marketing_post_stats (
  id          uuid        primary key default gen_random_uuid(),
  post_id     uuid        not null references marketing_posts (id) on delete cascade,
  captured_at timestamptz not null default now(),
  impressions integer     not null default 0,
  reactions   integer     not null default 0,
  comments    integer     not null default 0,
  reposts     integer     not null default 0
);

create index if not exists marketing_post_stats_post_idx on marketing_post_stats (post_id, captured_at desc);

alter table marketing_post_stats enable row level security;
-- No policies: service-role only.

-- ─── Traffic time series for the overlay ──────────────────────────────────────
-- Hourly visitor + pageview buckets over the last p_days days. The Marketing
-- tab draws post-publish markers on top of this to read the uptick by eye.
create or replace function ops_traffic_series(p_days integer default 14)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', bucket,
        'visits', visits,
        'pageviews', pageviews
      ) order by bucket
    ),
    '[]'::jsonb
  )
  from (
    select
      date_trunc('hour', created_at) as bucket,
      count(distinct session_id)     as visits,
      count(*)                       as pageviews
    from page_views
    where created_at > now() - (p_days || ' days')::interval
    group by 1
  ) t;
$$;
