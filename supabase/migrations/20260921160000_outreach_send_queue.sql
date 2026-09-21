-- Scheduled sending for outreach mail.
--
-- The problem this solves is not clicking send; it is that seventeen mails
-- cannot leave at once without looking like a blast, so they had to be spread
-- by hand. The queue does the spreading. The Gmail DRAFT stays the unit of
-- work: nothing composes a message here, the sender posts an existing draft id
-- to Gmail's drafts/send. That keeps three useful properties for free — the
-- mail is reviewable before it goes, an edit in Gmail is what actually ships,
-- and deleting the draft cancels the send with no button for it.

create table if not exists public.outreach_send_queue (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  -- chase | initial | reply. Drives priority and nothing else; the content was
  -- decided long before a row lands here.
  soort         text not null check (soort in ('chase', 'initial', 'reply')),
  draft_id      text not null,
  thread_id     text,
  to_email      text,
  -- queued -> sending -> sent, or failed. 'sending' is a claim, not a state
  -- anyone waits in for long: see outreach_send_claim().
  status        text not null default 'queued'
                check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  -- Chases are on a cadence and go first; a first mail can always wait a slot.
  prioriteit    int not null default 2,
  niet_voor     timestamptz,
  claimed_at    timestamptz,
  sent_at       timestamptz,
  gmail_message_id text,
  fout          text,
  pogingen      int not null default 0,
  created_at    timestamptz not null default now()
);

-- One live queue entry per draft. A retry reuses the row rather than adding a
-- second one, which is the whole defence against sending the same mail twice.
create unique index if not exists outreach_send_queue_draft_live_idx
  on public.outreach_send_queue (draft_id)
  where status in ('queued', 'sending');

create index if not exists outreach_send_queue_due_idx
  on public.outreach_send_queue (status, prioriteit, created_at)
  where status = 'queued';

alter table public.outreach_send_queue enable row level security;
-- No policies: the service role reaches past RLS, the browser never reads this
-- table directly, and /ops goes through the ops-outreach function.

-- Single-row state: the kill switch, and the randomised gap between sends.
-- The gap is PERSISTED rather than rolled on each poll; re-rolling every ten
-- minutes would bias every send to the early end of the range.
create table if not exists public.outreach_send_state (
  id               boolean primary key default true check (id),
  gepauzeerd       boolean not null default true,
  next_allowed_at  timestamptz,
  laatste_fout     text,
  updated_at       timestamptz not null default now()
);

alter table public.outreach_send_state enable row level security;

-- Starts paused. Turning sending on is a human act, not a side effect of a
-- migration landing.
insert into public.outreach_send_state (id, gepauzeerd)
values (true, true)
on conflict (id) do nothing;

comment on table public.outreach_send_state is
  'Kill switch and send pacing. gepauzeerd = true stops all sending without touching the n8n workflow.';

/**
 * May a mail leave at this moment? Split out of the claim so the rule can be
 * tested against a table of timestamps instead of against the wall clock.
 *
 * Monday starts at 13:00 because nobody reads a cold mail in a Monday morning
 * inbox, and Friday stops at 12:00 for the same reason in reverse.
 */
create or replace function public.outreach_send_in_window(p_at timestamptz)
returns boolean
language sql
immutable
as $$
  with l as (select (p_at at time zone 'Europe/Amsterdam') as t)
  select case extract(isodow from l.t)
    when 1 then l.t::time >= time '13:00' and l.t::time < time '16:30'
    when 5 then l.t::time >= time '09:00' and l.t::time < time '12:00'
    when 6 then false
    when 7 then false
    else        l.t::time >= time '09:00' and l.t::time < time '16:30'
  end
  from l;
$$;

/**
 * Hand out at most one mail that may be sent right now, and claim it in the
 * same statement.
 *
 * Every rule lives here rather than in the workflow: the window (Monday from
 * 13:00, Friday until 12:00, otherwise 09:00-16:30, never at the weekend),
 * the daily cap, the randomised gap, and the kill switch. A workflow that
 * polls more often than intended therefore cannot send more mail, which is
 * the point of putting it in the database.
 *
 * Returns zero rows when nothing may go out, which is the normal answer for
 * most of the day.
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
  v_now     timestamptz := coalesce(p_now, now());
  v_local   timestamp;
  v_vandaag int;
  v_state   public.outreach_send_state%rowtype;
begin
  v_local := (v_now at time zone 'Europe/Amsterdam');

  -- Every table gets an alias in here. The OUT parameter `id` from the
  -- RETURNS TABLE clause shadows any unqualified column of that name, and an
  -- unaliased `where id` raises "column reference id is ambiguous" at RUNTIME
  -- rather than at create time, so it survives a clean migration and only
  -- shows up the first time something calls the function.
  select st.* into v_state from public.outreach_send_state st where st.id limit 1;
  if not found or v_state.gepauzeerd then
    return;
  end if;

  if v_state.next_allowed_at is not null and v_now < v_state.next_allowed_at then
    return;
  end if;

  if not public.outreach_send_in_window(v_now) then
    return;
  end if;

  select count(*) into v_vandaag
    from public.outreach_send_queue q
   where q.sent_at is not null
     and (q.sent_at at time zone 'Europe/Amsterdam')::date = v_local::date;
  if v_vandaag >= p_max_per_dag then
    return;
  end if;

  -- FOR UPDATE SKIP LOCKED: two overlapping runs take two different rows, or
  -- one takes nothing. Never the same row twice.
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

/** Record a send and roll the next gap: 24 to 53 minutes, as agreed. */
create or replace function public.outreach_send_done(p_id uuid, p_gmail_message_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.outreach_send_queue q
     set status = 'sent', sent_at = now(), gmail_message_id = p_gmail_message_id, fout = null
   where q.id = p_id;

  update public.outreach_send_state st
     set next_allowed_at = now() + make_interval(mins => 24 + floor(random() * 30)::int),
         updated_at = now()
   where st.id;
end $$;

/**
 * A send that did not work. Two tries, then it stops and waits for a human:
 * a mail that keeps failing is a mail with something wrong in it, and
 * retrying it forever only risks sending it twice.
 */
create or replace function public.outreach_send_failed(p_id uuid, p_fout text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.outreach_send_queue q
     set status = case when q.pogingen >= 2 then 'failed' else 'queued' end,
         fout = p_fout,
         claimed_at = null
   where q.id = p_id;

  update public.outreach_send_state st
     set laatste_fout = p_fout, updated_at = now()
   where st.id;
end $$;

revoke all on function public.outreach_send_claim(int, timestamptz) from public, anon, authenticated;
revoke all on function public.outreach_send_done(uuid, text) from public, anon, authenticated;
revoke all on function public.outreach_send_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.outreach_send_claim(int, timestamptz) to service_role;
grant execute on function public.outreach_send_done(uuid, text) to service_role;
grant execute on function public.outreach_send_failed(uuid, text) to service_role;
