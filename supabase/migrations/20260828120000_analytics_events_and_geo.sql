-- First-party analytics extension: country on page_views (via Vercel geo
-- header, proxied through /api/geo — track-view is called directly from the
-- browser to Supabase so Vercel's x-vercel-ip-country header never reaches
-- it otherwise), plus a generic analytics_events table for scroll-depth and
-- CTA-click engagement signals. Joins to page_views on session_id, which is
-- already the same per-tab sessionStorage id usePageViewTracking generates.

alter table public.page_views
  add column if not exists country text;

comment on column public.page_views.country is
  'ISO 3166-1 alpha-2, derived server-side from Vercel''s x-vercel-ip-country header via /api/geo. Not user-supplied.';

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  event_type text not null check (event_type in ('scroll_depth', 'cta_click')),
  path text not null,
  milestone integer check (milestone in (25, 50, 75, 100)),
  cta_id text,
  country text,
  created_at timestamptz not null default now(),
  constraint analytics_events_scroll_has_milestone
    check (event_type != 'scroll_depth' or milestone is not null),
  constraint analytics_events_click_has_cta_id
    check (event_type != 'cta_click' or cta_id is not null)
);

comment on table public.analytics_events is
  'Cookieless, no-PII engagement events (scroll depth milestones, CTA clicks). session_id joins to page_views.session_id.';

create index if not exists analytics_events_session_id_idx on public.analytics_events (session_id);
create index if not exists analytics_events_event_type_created_at_idx on public.analytics_events (event_type, created_at);

-- One row per (session, milestone) — belt-and-braces de-dupe alongside the
-- frontend's own sessionStorage guard, so a retried beacon or a race between
-- tabs can't double-count a scroll milestone. Clicks are NOT deduped: every
-- click on a CTA is a real, separate signal (repeat clicks can mean
-- hesitation/friction), unlike scroll milestones which are a one-time "did
-- they reach this point" flag.
create unique index if not exists analytics_events_scroll_dedupe_idx
  on public.analytics_events (session_id, milestone)
  where event_type = 'scroll_depth';

alter table public.analytics_events enable row level security;
-- No policies: service-role only, same lockdown pattern as page_views. All
-- writes go through the track-view edge function with the service role key.
