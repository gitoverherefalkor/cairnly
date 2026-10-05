-- Partners pre-chat (/partners): the intake chat gets an audience switch, and a
-- partner conversation can end as a lead row that /ops works through.
--
-- Same table as the homepage chat on purpose: one engine, one transcript
-- shape. `audience` keeps the two apart; every existing row is 'consumer'.
-- Built generic so a future HR chat on /employers adds a value here, not a
-- table.
--
-- Still service-role only (RLS on, no policies): the intake-chat function
-- writes, ops-partners reads and updates for the admin.

alter table public.intake_sessions
  add column if not exists audience text not null default 'consumer',
  -- The offer card the server computed at pitch time (partner audience only).
  add column if not exists offer jsonb,
  -- Which button the practitioner pressed with their email.
  add column if not exists offer_chosen text,
  -- Lead pipeline in /ops. Null until an email arrives.
  add column if not exists lead_status text,
  add column if not exists lead_at timestamptz;

alter table public.intake_sessions
  drop constraint if exists intake_sessions_audience_check,
  add constraint intake_sessions_audience_check
    check (audience in ('consumer', 'partner')),
  drop constraint if exists intake_sessions_offer_chosen_check,
  add constraint intake_sessions_offer_chosen_check
    check (offer_chosen is null or offer_chosen in ('pilot_call', 'free_credits', 'call')),
  drop constraint if exists intake_sessions_lead_status_check,
  add constraint intake_sessions_lead_status_check
    check (lead_status is null or lead_status in
      ('new', 'credits_sent', 'pilot_call_booked', 'pilot_running', 'buying', 'lost'));

create index if not exists intake_sessions_audience_created_idx
  on public.intake_sessions (audience, created_at desc);

-- Pilot slots: how many more agencies the free 10-credit pilot can take. The
-- offer card stops offering the pilot at zero. A number Sjoerd edits in /ops,
-- not a count derived from leads: pilots also start from outreach, outside
-- this chat. Single row (id is always true).
create table if not exists public.partner_prechat_settings (
  id boolean primary key default true check (id),
  pilot_slots_left integer not null default 5 check (pilot_slots_left >= 0),
  updated_at timestamptz not null default now()
);

alter table public.partner_prechat_settings enable row level security;

insert into public.partner_prechat_settings (id) values (true)
  on conflict (id) do nothing;
