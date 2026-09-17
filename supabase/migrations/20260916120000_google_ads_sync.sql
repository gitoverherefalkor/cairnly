-- Google Ads daily sync tables for the /ops dashboard.
-- Written by the google-ads-ingest edge function (service role only).
-- RLS on with no policies: the browser never reads these directly, ops functions do.

create table if not exists public.google_ads_campaign_daily (
  date              date        not null,
  campaign_id       bigint      not null,
  campaign_name     text        not null,
  campaign_status   text,
  impressions       integer     not null default 0,
  clicks            integer     not null default 0,
  cost_eur          numeric(12,2) not null default 0,
  conversions       numeric(10,2) not null default 0,
  conversion_value  numeric(12,2) not null default 0,
  synced_at         timestamptz not null default now(),
  primary key (date, campaign_id)
);

create table if not exists public.google_ads_keyword_daily (
  date              date        not null,
  campaign_id       bigint      not null,
  ad_group_id       bigint      not null,
  criterion_id      bigint      not null,
  ad_group_name     text,
  keyword           text        not null,
  match_type        text,
  impressions       integer     not null default 0,
  clicks            integer     not null default 0,
  cost_eur          numeric(12,2) not null default 0,
  conversions       numeric(10,2) not null default 0,
  synced_at         timestamptz not null default now(),
  primary key (date, ad_group_id, criterion_id)
);

create table if not exists public.google_ads_search_term_daily (
  date              date        not null,
  campaign_id       bigint      not null,
  ad_group_id       bigint      not null,
  ad_group_name     text,
  search_term       text        not null,
  term_status       text,       -- ADDED / EXCLUDED / NONE
  impressions       integer     not null default 0,
  clicks            integer     not null default 0,
  cost_eur          numeric(12,2) not null default 0,
  conversions       numeric(10,2) not null default 0,
  synced_at         timestamptz not null default now(),
  primary key (date, ad_group_id, search_term)
);

create table if not exists public.google_ads_sync_log (
  id            bigint generated always as identity primary key,
  synced_at     timestamptz not null default now(),
  date_from     date,
  date_to       date,
  campaign_rows integer,
  keyword_rows  integer,
  term_rows     integer,
  ok            boolean not null,
  error         text
);

alter table public.google_ads_campaign_daily    enable row level security;
alter table public.google_ads_keyword_daily     enable row level security;
alter table public.google_ads_search_term_daily enable row level security;
alter table public.google_ads_sync_log          enable row level security;

create index if not exists google_ads_search_term_daily_date_idx on public.google_ads_search_term_daily (date desc);
create index if not exists google_ads_keyword_daily_date_idx     on public.google_ads_keyword_daily (date desc);
