-- Outreach click tracking, phase 2 of the outreach dashboard.
--
-- ~20 cold emails go to re-integration bureaus, each with one demo link of
-- the form /demo?p=partners&persona=marcel&utm_source=outreach&utm_medium=
-- email&utm_campaign=bureaus-sep26&utm_content=<slug>. `utm_content` is the
-- per-bureau key. This migration adds:
--
--   outreach_prospects       one row per bureau (seeded from
--                            supabase/seed/outreach_prospects_seed.csv by the
--                            next migration). Only `status` and `notities`
--                            are ever edited by hand, in /ops.
--   outreach_clicks          one row per /demo request carrying utm_content,
--                            written server-side (Vercel Edge Middleware ->
--                            outreach-click function -> service role). No IP,
--                            no email. Unknown slugs are logged too, so there
--                            is deliberately no foreign key.
--   outreach_prospect_stats  per-slug counts joined by the ops tab.
--
-- Access: both tables have RLS on with zero policies, i.e. service-role only,
-- reached exclusively through the admin-gated ops-outreach function (same
-- pattern as page_views, analytics_events, marketing_posts). The view runs as
-- security_invoker and is revoked from anon/authenticated so PostgREST cannot
-- read it either.
--
-- Purely additive; reversible by dropping the view and the two tables.

-- 1. Prospects ─────────────────────────────────────────────────────────────
create table if not exists public.outreach_prospects (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  naam           text,
  tier           text,
  categorie      text,
  to_email       text,
  domain         text,
  alt_domain     text,
  contactpersoon text,
  plaats         text,
  campaign       text,
  bow_slug       text,
  openingshaak   text,
  status         text not null default 'nog_niet_benaderd',
  notities       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Text + check rather than a Postgres enum: adding a value is one
  -- `alter table ... drop/add constraint`, not an enum migration.
  constraint outreach_prospects_status_check check (status in (
    'nog_niet_benaderd', 'verzonden', 'opvolging_1', 'opvolging_2',
    'gesprek_gepland', 'gesprek_gevoerd', 'pilot_afgesproken', 'pilot_gestart',
    'founding_partner', 'afgewezen', 'geen_fit'
  )),
  constraint outreach_prospects_tier_check check (tier is null or tier in ('A', 'B', 'C'))
);

comment on table public.outreach_prospects is
  'Outreach targets (re-integration bureaus). slug = the utm_content value in the demo link sent to them. Seeded from supabase/seed/outreach_prospects_seed.csv; only status and notities are edited by hand (in /ops).';
comment on column public.outreach_prospects.slug is
  'The utm_content value baked into that bureau''s demo link. Clicks are matched on this.';

alter table public.outreach_prospects enable row level security;
revoke all on public.outreach_prospects from anon, authenticated;

-- 2. Clicks ────────────────────────────────────────────────────────────────
create table if not exists public.outreach_clicks (
  id          uuid primary key default gen_random_uuid(),
  -- No FK: a typo'd or not-yet-seeded utm_content must still be recorded,
  -- otherwise the raw log cannot show what went wrong.
  slug        text,
  campaign    text,
  persona     text,
  p           text,
  utm_source  text,
  utm_medium  text,
  user_agent  text,
  referer     text,
  is_bot      boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.outreach_clicks is
  'One row per /demo request that carried utm_content. Written server-side only. Holds user-agent, referer and the utm fields; deliberately no IP and no email (B2B outreach under legitimate interest, kept minimal).';
comment on column public.outreach_clicks.is_bot is
  'True when the user-agent matched the link-scanner list in the outreach-click function (Outlook SafeLinks, Google proxies, curl, ...). A list, not a guarantee; phase 3 adds time-based filtering against send time.';

create index if not exists outreach_clicks_slug_created_idx
  on public.outreach_clicks (slug, created_at);

alter table public.outreach_clicks enable row level security;
revoke all on public.outreach_clicks from anon, authenticated;

-- 3. Per-slug stats ────────────────────────────────────────────────────────
-- Days are counted in Europe/Amsterdam so a click at 23:30 and one at 00:30
-- are two days the way Sjoerd reads a calendar, not the way UTC does.
create or replace view public.outreach_prospect_stats
with (security_invoker = true) as
select
  slug,
  count(*) filter (where not is_bot)                                           as kliks_totaal,
  count(distinct (created_at at time zone 'Europe/Amsterdam')::date)
    filter (where not is_bot)                                                  as kliks_uniek_dagen,
  min(created_at) filter (where not is_bot)                                    as eerste_klik,
  max(created_at) filter (where not is_bot)                                    as laatste_klik,
  count(*) filter (where is_bot)                                               as bot_kliks
from public.outreach_clicks
where slug is not null
group by slug;

comment on view public.outreach_prospect_stats is
  'Per utm_content slug: non-bot click count, distinct Amsterdam days with a non-bot click (the number the ops tab shows), first/last non-bot click, and bot click count. Join on outreach_prospects.slug.';

revoke all on public.outreach_prospect_stats from anon, authenticated;
