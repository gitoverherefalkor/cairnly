-- Wake WF11 when /ops asks for a follow-up, instead of letting it poll.
--
-- WF11 used to run on a clock (every 15 minutes, then hourly as a stopgap),
-- and n8n bills every run. It now has three doors instead:
--
--   1. a Gmail Trigger for new mail (a poll that finds nothing is free),
--   2. a sweep at 08:00, 12:00 and 16:00 on weekdays that re-reads three days
--      (our own sent mail, which the Gmail Trigger skips, plus anything a
--      failed run missed),
--   3. a "sync now" webhook, knocked from here when Sjoerd clicks Draft
--      follow-up in /ops, so the draft does not wait for the next sweep.
--
-- The knock is debounced: a click only marks that a sync is owed
-- (gevraagd_op); pg_cron checks every minute and knocks at most once per three
-- minutes. Five clicks in a row cost one or two runs, and two runs never
-- overlap closely enough to write the same chase twice. (If they ever did,
-- draft_created in outreach-mail-sync only queues the first draft.)
--
-- Same secret as outreach_send_wake(): vault 'n8n_shared_secret', which is the
-- n8n credential "Supabase Edge Functions — Shared Secret".

create table if not exists public.outreach_sync_state (
  id          boolean primary key default true check (id),
  -- A follow-up was requested since the last knock: WF11 owes a run.
  gevraagd_op timestamptz,
  -- Last knock on WF11's sync-now webhook.
  gewekt_op   timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.outreach_sync_state enable row level security;
-- No policies: only pg_cron and the trigger below touch it.

insert into public.outreach_sync_state (id) values (true) on conflict (id) do nothing;

create or replace function public._outreach_followup_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.outreach_sync_state st
     set gevraagd_op = now(), updated_at = now()
   where st.id;
  return null;
end $$;

-- Fires on a new request and on a re-request (the timestamp moves), never on
-- the sync clearing the flag (new value null).
drop trigger if exists outreach_followup_requested on public.outreach_prospects;
create trigger outreach_followup_requested
  after update of followup_requested_at on public.outreach_prospects
  for each row
  when (new.followup_requested_at is not null
        and new.followup_requested_at is distinct from old.followup_requested_at)
  execute function public._outreach_followup_requested();

/**
 * Knock on WF11's sync-now webhook if a sync is owed and the last knock is at
 * least three minutes old. Called by pg_cron every minute; returns true when
 * it knocked. A request that arrives inside the three minutes stays owed and
 * goes out with the next knock, so no click is ever dropped.
 */
create or replace function public.outreach_sync_wake(p_now timestamptz default now())
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_now    timestamptz := coalesce(p_now, now());
  v_secret text;
begin
  select ds.decrypted_secret into v_secret
    from vault.decrypted_secrets ds
   where ds.name = 'n8n_shared_secret'
   limit 1;
  if coalesce(v_secret, '') = '' then
    raise warning 'outreach_sync_wake: n8n_shared_secret missing from vault, WF11 not woken';
    return false;
  end if;

  update public.outreach_sync_state st
     set gewekt_op = v_now, gevraagd_op = null, updated_at = v_now
   where st.id
     and st.gevraagd_op is not null
     and (st.gewekt_op is null or st.gewekt_op <= v_now - interval '3 minutes');
  if not found then
    return false;
  end if;

  perform net.http_post(
    url := 'https://falkoratlas.app.n8n.cloud/webhook/e0a968a9-082e-4d1d-8de7-293101d0bed5',
    body := jsonb_build_object('reason', 'followup_requested', 'at', v_now),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-shared-secret', v_secret
    ),
    timeout_milliseconds := 10000
  );
  return true;
end $$;

revoke all on function public.outreach_sync_wake(timestamptz) from public, anon, authenticated;
revoke all on function public._outreach_followup_requested() from public, anon, authenticated;

-- Every minute, around the clock: it is one cheap query, and a click at 20:00
-- should still get its draft in a minute or two.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'outreach-sync-wake') then
    perform cron.unschedule('outreach-sync-wake');
  end if;
end $$;

select cron.schedule(
  'outreach-sync-wake',
  '* * * * *',
  $$select public.outreach_sync_wake()$$
);
