-- Scroll depth is now tracked on /partners as well as on the homepage
-- (useScrollDepthTracking, 2026-10-06). The dedupe index was per
-- (session_id, milestone), so a visitor who scrolled the homepage past 50%
-- could never record 50% on /partners in the same session. Per path now.
-- Every existing row is unique on the narrower key, so it is unique on this one.

drop index if exists public.analytics_events_scroll_dedupe_idx;

create unique index if not exists analytics_events_scroll_dedupe_idx
  on public.analytics_events (session_id, path, milestone)
  where event_type = 'scroll_depth';
