-- Sample-report views for the partner channel.
--
-- /partners/voorbeeldrapport is handed out per prospect as
-- ?p=<slug> (plus utm_* on campaign links), and we want to know which bureau
-- actually opened the specimen. The existing beacon could not carry that:
-- page_views records location.pathname only (query strings are dropped), and
-- analytics_events was hard-limited to scroll_depth and cta_click.
--
-- Purely additive: a widened check constraint plus four nullable columns.
-- Nothing existing is rewritten, no data is touched. Reversible by narrowing
-- the constraint back and dropping the columns.

-- 1. Allow the new event type.
alter table public.analytics_events
  drop constraint if exists analytics_events_event_type_check;

alter table public.analytics_events
  add constraint analytics_events_event_type_check
  check (event_type in ('scroll_depth', 'cta_click', 'sample_view'));

-- 2. Attribution columns. Nullable and only ever written by sample_view rows
--    today, but there is nothing type-specific about them — any future event
--    can carry campaign attribution without another migration.
alter table public.analytics_events
  add column if not exists prospect text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

comment on column public.analytics_events.prospect is
  'Per-prospect tag from the ?p= parameter on an outreach link (e.g. the bureau slug). Sanitized to a slug charset client-side and sliced server-side. Not PII: it is a label we chose, not something the visitor typed.';
comment on column public.analytics_events.utm_source is
  'utm_source from the landing URL, when present.';
comment on column public.analytics_events.utm_medium is
  'utm_medium from the landing URL, when present.';
comment on column public.analytics_events.utm_campaign is
  'utm_campaign from the landing URL, when present.';

-- 3. "Who opened the sample report, and when" is the whole point of the
--    feature, so index the lookup rather than sequential-scanning the events
--    table as it grows.
create index if not exists analytics_events_prospect_idx
  on public.analytics_events (prospect, created_at desc)
  where prospect is not null;
