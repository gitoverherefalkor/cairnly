-- Adds a dismissed_at flag to ops_analysis so admins can resolve/dismiss any
-- ops feed item (support ticket, n8n error, assessment miss, feedback) from
-- the dashboard. Support tickets additionally flip support_requests.status to
-- 'resolved' at the source; other types are hidden via this flag.

alter table ops_analysis
  add column if not exists dismissed_at timestamptz;

create index if not exists ops_analysis_dismissed_at_idx
  on ops_analysis (dismissed_at);
