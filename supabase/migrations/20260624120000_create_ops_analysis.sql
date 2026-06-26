-- ops_analysis: AI-analysis cache for the ops/admin dashboard feed.
-- Written exclusively by the ops-feed edge function (service_role).
-- No public RLS policies — the edge function enforces admin-only access.

create table if not exists ops_analysis (
  id                 uuid        primary key default gen_random_uuid(),
  item_key           text        not null unique,
  source             text        not null,
  severity           text        not null,
  summary            text        not null,
  stage              text,
  recommended_action text,
  raw_data           jsonb       not null default '{}',
  analyzed_at        timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

create index if not exists ops_analysis_item_key_idx on ops_analysis (item_key);
create index if not exists ops_analysis_source_severity_idx on ops_analysis (source, severity);
create index if not exists ops_analysis_analyzed_at_idx on ops_analysis (analyzed_at desc);

alter table ops_analysis enable row level security;
-- No policies: only accessible via service_role key (ops-feed edge function).
