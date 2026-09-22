-- Wake WF12 only when a mail is actually due, instead of letting it poll.
--
-- Why: n8n bills one execution per workflow run, whether the run sends
-- anything or not. WF12 as first built polled every ten minutes around the
-- clock: 144 runs a day, ~4,300 a month, to send at most 8 mails a day. At
-- the plan limit n8n refuses runs outright, WF1 for paying customers
-- included, so outreach polling was eating the product's budget.
--
-- Now the database asks itself, every minute of the working day, whether a
-- mail may leave (free: it is a query), and only when the answer is yes does
-- it knock on WF12's webhook. WF12 still calls outreach-send 'next', which
-- still claims through outreach_send_claim(), so nothing about WHAT goes out
-- or the pacing rules changes. One n8n execution per mail sent.
--
-- Side effect worth having: the random 24-53 minute gap used to be rounded
-- up to the next ten-minute poll, so gaps landed on 30/40/50/60. Checking
-- every minute makes the gap random to the minute.
--
-- The knock carries the same shared secret n8n already sends the other way
-- (vault 'n8n_shared_secret' = edge secret N8N_SHARED_SECRET = the n8n
-- credential "Supabase Edge Functions — Shared Secret"). WF12's webhook
-- checks it with header auth. No new secret exists anywhere.

alter table public.outreach_send_state
  add column if not exists gewekt_op timestamptz;

comment on column public.outreach_send_state.gewekt_op is
  'Last time outreach_send_wake() knocked on WF12. Throttles the knock to one per 3 minutes.';

/**
 * Why may nothing leave right now? NULL means a mail may go.
 *
 * The single home of every pacing rule: the kill switch, the randomised gap,
 * the window, the daily cap, and (new) one mail in flight at a time. Both
 * the claim and the wake-up read it, so they cannot drift apart.
 */
create or replace function public.outreach_send_blocked(
  p_max_per_dag int default 8,
  p_now timestamptz default now()
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now     timestamptz := coalesce(p_now, now());
  v_state   public.outreach_send_state%rowtype;
  v_vandaag int;
begin
  select st.* into v_state from public.outreach_send_state st where st.id limit 1;
  if not found or v_state.gepauzeerd then
    return 'gepauzeerd';
  end if;

  if v_state.next_allowed_at is not null and v_now < v_state.next_allowed_at then
    return 'tussenruimte';
  end if;

  if not public.outreach_send_in_window(v_now) then
    return 'buiten venster';
  end if;

  select count(*) into v_vandaag
    from public.outreach_send_queue q
   where q.sent_at is not null
     and (q.sent_at at time zone 'Europe/Amsterdam')::date = (v_now at time zone 'Europe/Amsterdam')::date;
  if v_vandaag >= p_max_per_dag then
    return 'dagmaximum';
  end if;

  -- A mail claimed but not yet reported back. The gap is only rolled when
  -- the send is reported, so without this a slow n8n run could let a second
  -- mail through seconds after the first. Ten minutes, so a run that died
  -- after claiming does not block sending forever.
  if exists (
    select 1 from public.outreach_send_queue q
     where q.status = 'sending'
       and q.claimed_at > v_now - interval '10 minutes'
  ) then
    return 'bezig';
  end if;

  return null;
end $$;

/** Is there a mail that may leave right now? Reads, never claims. */
create or replace function public.outreach_send_due(
  p_max_per_dag int default 8,
  p_now timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.outreach_send_blocked(p_max_per_dag, coalesce(p_now, now())) is null
     and exists (
       select 1 from public.outreach_send_queue q
        where q.status = 'queued'
          and (q.niet_voor is null or q.niet_voor <= coalesce(p_now, now()))
     );
$$;

/**
 * Hand out at most one mail that may be sent right now, and claim it in the
 * same statement. Same contract as before; the rules moved into
 * outreach_send_blocked() and gained the in-flight check.
 *
 * Returns zero rows when nothing may go out.
 */
create or replace function public.outreach_send_claim(
  p_max_per_dag int default 8,
  p_now timestamptz default now()
)
returns table (
  id uuid, slug text, soort text, draft_id text, thread_id text, to_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
begin
  -- Every table gets an alias in here. The OUT parameter `id` from the
  -- RETURNS TABLE clause shadows any unqualified column of that name, and an
  -- unaliased `where id` raises "column reference id is ambiguous" at RUNTIME
  -- rather than at create time.

  -- Serialise claims on the single state row. Two runs that arrive together
  -- queue here; the second then sees the first one's 'sending' row and
  -- stops at 'bezig' instead of taking the next mail in the same minute.
  perform 1 from public.outreach_send_state st where st.id for update;

  if public.outreach_send_blocked(p_max_per_dag, v_now) is not null then
    return;
  end if;

  return query
  update public.outreach_send_queue q
     set status = 'sending',
         claimed_at = v_now,
         pogingen = q.pogingen + 1
   where q.id = (
     select q2.id
       from public.outreach_send_queue q2
      where q2.status = 'queued'
        and (q2.niet_voor is null or q2.niet_voor <= v_now)
      order by q2.prioriteit, q2.created_at
      limit 1
      for update skip locked
   )
  returning q.id, q.slug, q.soort, q.draft_id, q.thread_id, q.to_email;
end $$;

/**
 * Knock on WF12 when a mail is due. Called by pg_cron every minute of the
 * working day; returns true when it knocked.
 *
 * One knock per three minutes at most: WF12 claims within seconds of a
 * knock, and if n8n is slow a second knock only buys a second, empty run.
 *
 * The daily cap here is the SQL default (8), which must stay equal to
 * MAX_PER_DAG in supabase/functions/outreach-send. If they differ the wrong
 * way round, this keeps knocking for mail the claim will refuse.
 */
create or replace function public.outreach_send_wake(p_now timestamptz default now())
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_now    timestamptz := coalesce(p_now, now());
  v_secret text;
begin
  if not public.outreach_send_due(8, v_now) then
    return false;
  end if;

  update public.outreach_send_state st
     set gewekt_op = v_now
   where st.id
     and (st.gewekt_op is null or st.gewekt_op <= v_now - interval '3 minutes');
  if not found then
    return false;
  end if;

  select ds.decrypted_secret into v_secret
    from vault.decrypted_secrets ds
   where ds.name = 'n8n_shared_secret'
   limit 1;
  if coalesce(v_secret, '') = '' then
    raise warning 'outreach_send_wake: n8n_shared_secret missing from vault, WF12 not woken';
    return false;
  end if;

  perform net.http_post(
    url := 'https://falkoratlas.app.n8n.cloud/webhook/d56ec58d-99d7-4c1e-bfd0-e6ffce6b894a',
    body := jsonb_build_object('due_at', v_now),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-shared-secret', v_secret
    ),
    timeout_milliseconds := 10000
  );
  return true;
end $$;

revoke all on function public.outreach_send_blocked(int, timestamptz) from public, anon, authenticated;
revoke all on function public.outreach_send_due(int, timestamptz) from public, anon, authenticated;
revoke all on function public.outreach_send_wake(timestamptz) from public, anon, authenticated;
grant execute on function public.outreach_send_blocked(int, timestamptz) to service_role;
grant execute on function public.outreach_send_due(int, timestamptz) to service_role;

-- Every minute, 07:00-15:59 UTC on weekdays. That covers the Amsterdam
-- window (09:00-16:30) in both summer and winter time; the exact edges,
-- Monday from 13:00 and Friday until 12:00 are decided by
-- outreach_send_in_window(), not by this schedule. Outside those hours the
-- job does not even run. While sending is paused, it runs and does nothing.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'outreach-send-wake') then
    perform cron.unschedule('outreach-send-wake');
  end if;
end $$;

select cron.schedule(
  'outreach-send-wake',
  '* 7-15 * * 1-5',
  $$select public.outreach_send_wake()$$
);
