-- The clock of the outreach control center. Apply AFTER outreach-prepare and
-- ops-push are deployed (rollout step 7), not before.
--
-- pg_cron runs in UTC; Amsterdam is UTC+2 in summer and UTC+1 in winter. Each
-- job therefore fires at both candidate UTC hours, and the function itself
-- only acts when the Amsterdam clock is right (outreach-prepare: 07:30 and
-- 14:45; ops-push: 08:30 and 15:00, each with a 20-minute tolerance). The
-- call that lands at the wrong hour answers "not the moment" and costs one
-- cheap edge invocation, no n8n execution.
--
-- The shared secret comes from the vault ('n8n_shared_secret', the same value
-- as the edge secret N8N_SHARED_SECRET), exactly like outreach_send_wake().

create or replace function public.outreach_call_function(p_name text, p_body jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select ds.decrypted_secret into v_secret
    from vault.decrypted_secrets ds
   where ds.name = 'n8n_shared_secret'
   limit 1;
  if coalesce(v_secret, '') = '' then
    raise warning 'outreach_call_function: n8n_shared_secret missing from vault, % not called', p_name;
    return;
  end if;
  perform net.http_post(
    url := 'https://pcoyafgsirrznhmdaiji.supabase.co/functions/v1/' || p_name,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-shared-secret', v_secret),
    timeout_milliseconds := 150000
  );
end $$;

revoke all on function public.outreach_call_function(text, jsonb) from public, anon, authenticated;

do $$
declare
  j text;
begin
  foreach j in array array[
    'outreach-prepare-morning', 'outreach-prepare-afternoon',
    'ops-push-digest-morning', 'ops-push-digest-afternoon', 'ops-push-alarm'
  ] loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end $$;

-- 07:30 Amsterdam = 05:30 UTC (summer) / 06:30 UTC (winter)
select cron.schedule('outreach-prepare-morning', '30 5,6 * * 1-5',
  $$select public.outreach_call_function('outreach-prepare')$$);
-- 14:45 Amsterdam = 12:45 / 13:45 UTC
select cron.schedule('outreach-prepare-afternoon', '45 12,13 * * 1-5',
  $$select public.outreach_call_function('outreach-prepare')$$);
-- 08:30 Amsterdam = 06:30 / 07:30 UTC
select cron.schedule('ops-push-digest-morning', '30 6,7 * * 1-5',
  $$select public.outreach_call_function('ops-push', '{"action":"digest","slot":"morning"}'::jsonb)$$);
-- 15:00 Amsterdam = 13:00 / 14:00 UTC
select cron.schedule('ops-push-digest-afternoon', '0 13,14 * * 1-5',
  $$select public.outreach_call_function('ops-push', '{"action":"digest","slot":"afternoon"}'::jsonb)$$);
-- Paused-with-mail-due alarm: once an hour through the working day; the
-- function pings at most once a day.
select cron.schedule('ops-push-alarm', '15 7-15 * * 1-5',
  $$select public.outreach_call_function('ops-push', '{"action":"alarm"}'::jsonb)$$);
