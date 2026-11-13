-- Stuck-report alert: every 15 minutes, ops-push checks for surveys submitted
-- more than 45 minutes ago whose report never became ready, and pushes one
-- notification per submission per day to the Ops browser. Runs every day,
-- weekends included, because customers buy on weekends too.
-- Uses outreach_call_function (vault secret n8n_shared_secret), like the
-- other ops-push jobs. No new tables, so no Data API grants needed.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'ops-push-stuck-reports') then
    perform cron.unschedule('ops-push-stuck-reports');
  end if;
end $$;

select cron.schedule('ops-push-stuck-reports', '*/15 * * * *',
  $$select public.outreach_call_function('ops-push', '{"action":"stuck"}'::jsonb)$$);
