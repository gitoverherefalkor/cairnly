-- Pause outreach sending (Sjoerd, 2026-11-26): the Pro agency campaign
-- (bureaus-sep26) is archived while the ops dashboard refocuses on Encore.
--
-- What stops:
--   - outreach-prepare-morning / -afternoon: no new concepts are written.
--   - outreach-send-wake: WF12 is no longer knocked, so nothing is sent.
-- What keeps running:
--   - outreach-sync-wake: WF11 still reads the mailbox, so replies keep
--     landing and "gereageerd" stays correct.
--
-- Concepts that were scheduled go back to 'voorstel' (nothing is deleted) and
-- any queue row still waiting is cancelled.
--
-- To resume: re-run the cron.schedule calls below (commented) with the
-- schedules that were live on 2026-11-26.
--   select cron.schedule('outreach-send-wake', '* 6-17 * * 1-5', $$select public.outreach_send_wake()$$);
--   select cron.schedule('outreach-prepare-morning', '30 5,6 * * 1-5', $$select public.outreach_call_function('outreach-prepare')$$);
--   select cron.schedule('outreach-prepare-afternoon', '45 12,13 * * 1-5', $$select public.outreach_call_function('outreach-prepare')$$);

do $$
declare j text;
begin
  foreach j in array array['outreach-send-wake', 'outreach-prepare-morning', 'outreach-prepare-afternoon'] loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end $$;

update public.outreach_send_queue
   set status = 'cancelled'
 where status = 'queued';

update public.outreach_concepts
   set status = 'voorstel'
 where status = 'ingepland';
