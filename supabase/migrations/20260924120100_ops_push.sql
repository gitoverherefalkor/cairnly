-- Web Push for the /ops outreach cockpit.
--
-- One admin, one or two browsers. A subscription is what Chrome hands out
-- after "allow notifications"; ops_push_log is the dedupe that keeps a ping
-- to once per (kind, key, Amsterdam day), inserted before sending.
-- Design: docs/superpowers/specs/2026-09-24-outreach-control-center-design.md §6

create table if not exists public.ops_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_email    text not null,
  created_at    timestamptz not null default now(),
  last_ok_at    timestamptz,
  failed_count  int not null default 0
);

alter table public.ops_push_subscriptions enable row level security;
-- No policies: only the service role (ops-outreach, ops-push) reads or writes.

create table if not exists public.ops_push_log (
  kind     text not null,
  key      text not null,
  day      date not null,
  sent_at  timestamptz not null default now(),
  primary key (kind, key, day)
);

alter table public.ops_push_log enable row level security;

comment on table public.ops_push_subscriptions is
  'Browser push subscriptions of /ops admins. Written by ops-outreach (push_subscribe); read by the push senders. A 404/410 from the push service deletes the row.';
comment on table public.ops_push_log is
  'One row per ping sent (kind, key, Amsterdam day). Inserted before sending, so a second call the same day stays quiet.';
