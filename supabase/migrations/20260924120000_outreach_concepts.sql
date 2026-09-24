-- Outreach control center: concepts live in the database, not in Gmail.
--
-- Design: docs/superpowers/specs/2026-09-24-outreach-control-center-design.md
--
-- Until now a suggested mail became a Gmail draft and the queue carried the
-- draft id. From here a suggestion is a row in outreach_concepts: /ops shows
-- it open and editable, Sjoerd (or, for boilerplate, the auto-approve rule)
-- approves it, the queue carries the concept id, and outreach-send composes
-- the message itself at send time.
--
-- The send rules gain LANES. Cold mail (first mails, chases, check-ins) keeps
-- every rule it had: window, randomised gap, 8 a day. Replies to someone who
-- wrote to us are not cold mail, so they get their own lane: weekdays
-- 08:00-18:00, no daily cap, and they never move the cold gap. A "Send now"
-- is a direct row: it skips window and gap, but a direct cold mail still
-- counts toward the cap. The kill switch stops every lane.

-- ── 1. Concepts ─────────────────────────────────────────────────────────────

create table if not exists public.outreach_concepts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  soort           text not null check (soort in ('initial', 'chase', 'checkin', 'reply')),
  -- chase 1 or 2; null for everything else
  step            int,
  -- voorstel → ingepland → verzonden, or weggegooid / verouderd / geen_antwoord
  status          text not null default 'voorstel'
                  check (status in ('voorstel', 'ingepland', 'verzonden', 'weggegooid', 'verouderd', 'geen_antwoord')),
  to_email        text not null,
  subject         text not null,
  -- Plain text with [label](url) links; what will be sent.
  body            text not null,
  -- What the generator wrote, kept so edits can be learned from later.
  body_origineel  text not null,
  -- The approved template the body was built on; /ops highlights the difference.
  skeleton        text,
  variant         text,
  -- The facts the concept assumed (status, clicks, last mails). outreach-send
  -- re-checks them at send time and drops the concept when they changed.
  basis           jsonb not null default '{}'::jsonb,
  thread_id       text,
  in_reply_to     text,
  references_hdr  text,
  answers_mail_id uuid references public.outreach_mails (id) on delete set null,
  rfc_message_id  text unique,
  validatie       jsonb not null default '{"ok": false, "problems": []}'::jsonb,
  verouderd_reden text,
  bewerkt_op      timestamptz,
  goedgekeurd_door text check (goedgekeurd_door is null or goedgekeurd_door in ('auto', 'sjoerd')),
  goedgekeurd_op  timestamptz,
  verzonden_op    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One live concept per agency per kind (per chase step). Two sync runs or a
-- sync and a prepare that overlap cannot both write a chase for one agency.
create unique index if not exists outreach_concepts_live_idx
  on public.outreach_concepts (slug, soort, coalesce(step, 0))
  where status in ('voorstel', 'ingepland');

create index if not exists outreach_concepts_status_idx
  on public.outreach_concepts (status, created_at desc);

alter table public.outreach_concepts enable row level security;
-- No policies: the browser never reads this table; /ops goes through ops-outreach.

comment on table public.outreach_concepts is
  'Outreach mail that still has to leave, and its fate. Written by outreach-mail-sync (replies) and outreach-prepare (first mails, chases, check-ins); approved in /ops or by the auto-approve rule; sent by outreach-send via WF12.';

-- ── 2. Prospects: opt-out and broken address ────────────────────────────────

alter table public.outreach_prospects
  add column if not exists niet_mailen_op timestamptz,
  add column if not exists email_ongeldig_op timestamptz;

comment on column public.outreach_prospects.niet_mailen_op is
  'They asked not to be mailed. Permanent: nothing is generated or sent for this agency again.';
comment on column public.outreach_prospects.email_ongeldig_op is
  'A mail to to_email bounced. Cleared when the address is corrected in /ops.';

-- ── 3. Mails: full text, Message-ID, two new sentiments ────────────────────

alter table public.outreach_mails
  add column if not exists body_text text,
  add column if not exists rfc_message_id text;

create index if not exists idx_outreach_mails_rfc_message_id
  on public.outreach_mails (rfc_message_id);

alter table public.outreach_mails drop constraint if exists outreach_mails_sentiment_check;
alter table public.outreach_mails
  add constraint outreach_mails_sentiment_check
  check (sentiment is null or sentiment in
    ('positief', 'code', 'vraag', 'later', 'afwijzing', 'stop', 'bounce', 'auto', 'overig'));

-- ── 4. Send state: the auto-approve switch ──────────────────────────────────

alter table public.outreach_send_state
  add column if not exists auto_goedkeuren boolean not null default false,
  add column if not exists alarm_gepauzeerd_op date;

comment on column public.outreach_send_state.auto_goedkeuren is
  'Boilerplate (first mails, chases, clear-rejection replies) is approved without Sjoerd. Off = every concept waits for him. Launches off.';

-- ── 5. Queue: concept rows, direct sends, check-ins ─────────────────────────

alter table public.outreach_send_queue
  add column if not exists concept_id uuid references public.outreach_concepts (id),
  add column if not exists direct boolean not null default false;

alter table public.outreach_send_queue alter column draft_id drop not null;

alter table public.outreach_send_queue drop constraint if exists outreach_send_queue_soort_check;
alter table public.outreach_send_queue
  add constraint outreach_send_queue_soort_check
  check (soort in ('chase', 'initial', 'reply', 'checkin'));

create unique index if not exists outreach_send_queue_concept_live_idx
  on public.outreach_send_queue (concept_id)
  where status in ('queued', 'sending');

-- ── 6. The rules, per lane ──────────────────────────────────────────────────

/** Replies go out on weekdays between 08:00 and 18:00 Amsterdam. */
create or replace function public.outreach_reply_in_window(p_at timestamptz)
returns boolean
language sql
immutable
as $$
  with l as (select (p_at at time zone 'Europe/Amsterdam') as t)
  select extract(isodow from l.t) between 1 and 5
     and l.t::time >= time '08:00' and l.t::time < time '18:00'
  from l;
$$;

/** Which lane a queue row travels in. */
create or replace function public.outreach_queue_lane(p_direct boolean, p_soort text)
returns text
language sql
immutable
as $$
  select case
    when p_direct and p_soort = 'reply' then 'direct_reply'
    when p_direct then 'direct_cold'
    when p_soort = 'reply' then 'reply'
    else 'cold'
  end;
$$;

-- The old two-argument version is replaced by one with a lane; dropping it
-- first keeps a two-argument call from being ambiguous.
drop function if exists public.outreach_send_blocked(int, timestamptz);

/**
 * Why may nothing leave in this lane right now? NULL means a mail may go.
 *
 * Every lane: the kill switch, and one mail in flight at a time.
 * cold:        + the persisted random gap, the cold window, the daily cap.
 * reply:       + the reply window (weekdays 08:00-18:00). No cap, no gap.
 * direct_cold: + the daily cap only. Sjoerd pressed Send; the cap still holds.
 * direct_reply: nothing more.
 * The cap counts cold mail only: a reply is not what the cap protects against.
 */
create or replace function public.outreach_send_blocked(
  p_max_per_dag int default 8,
  p_now timestamptz default now(),
  p_lane text default 'cold'
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

  -- A mail claimed but not yet reported back. Ten minutes, so a run that died
  -- after claiming does not block sending forever.
  if exists (
    select 1 from public.outreach_send_queue q
     where q.status = 'sending'
       and q.claimed_at > v_now - interval '10 minutes'
  ) then
    return 'bezig';
  end if;

  if p_lane = 'reply' then
    if not public.outreach_reply_in_window(v_now) then
      return 'buiten venster';
    end if;
    return null;
  end if;

  if p_lane = 'direct_reply' then
    return null;
  end if;

  if p_lane = 'cold' then
    if v_state.next_allowed_at is not null and v_now < v_state.next_allowed_at then
      return 'tussenruimte';
    end if;
    if not public.outreach_send_in_window(v_now) then
      return 'buiten venster';
    end if;
  end if;

  -- cold and direct_cold: the daily cap on cold mail.
  select count(*) into v_vandaag
    from public.outreach_send_queue q
   where q.sent_at is not null
     and q.soort <> 'reply'
     and (q.sent_at at time zone 'Europe/Amsterdam')::date = (v_now at time zone 'Europe/Amsterdam')::date;
  if v_vandaag >= p_max_per_dag then
    return 'dagmaximum';
  end if;

  return null;
end $$;

/** Is there a mail that may leave right now, in any lane? Reads, never claims. */
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
  select exists (
    select 1 from public.outreach_send_queue q
     where q.status = 'queued'
       and (q.niet_voor is null or q.niet_voor <= coalesce(p_now, now()))
       and public.outreach_send_blocked(p_max_per_dag, coalesce(p_now, now()),
                                        public.outreach_queue_lane(q.direct, q.soort)) is null
  );
$$;

-- The return shape gains concept_id, so the old function has to go first.
drop function if exists public.outreach_send_claim(int, timestamptz);

/**
 * Hand out at most one mail that may leave right now, and claim it in the
 * same statement. Direct sends first, then replies, chases and check-ins,
 * then first mails; oldest first within a priority. A row whose lane is
 * blocked is skipped, so a reply can go while the cold gap is running.
 */
create or replace function public.outreach_send_claim(
  p_max_per_dag int default 8,
  p_now timestamptz default now()
)
returns table (
  id uuid, slug text, soort text, draft_id text, thread_id text, to_email text, concept_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
begin
  -- Every table is aliased: the OUT parameter `id` shadows an unqualified
  -- column of that name, and that only fails at RUNTIME.

  -- Serialise claims on the single state row (see the 2026-09-22 migration).
  perform 1 from public.outreach_send_state st where st.id for update;

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
        and public.outreach_send_blocked(p_max_per_dag, v_now,
                                         public.outreach_queue_lane(q2.direct, q2.soort)) is null
      order by q2.direct desc, q2.prioriteit, q2.created_at
      limit 1
      for update skip locked
   )
  returning q.id, q.slug, q.soort, q.draft_id, q.thread_id, q.to_email, q.concept_id;
end $$;

/**
 * Record a send. Cold mail rolls the next gap (24 to 53 minutes); a reply
 * leaves the cold rhythm alone.
 */
create or replace function public.outreach_send_done(p_id uuid, p_gmail_message_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_soort text;
begin
  update public.outreach_send_queue q
     set status = 'sent', sent_at = now(), gmail_message_id = p_gmail_message_id, fout = null
   where q.id = p_id
  returning q.soort into v_soort;

  if v_soort is not null and v_soort <> 'reply' then
    update public.outreach_send_state st
       set next_allowed_at = now() + make_interval(mins => 24 + floor(random() * 30)::int),
           updated_at = now()
     where st.id;
  end if;
end $$;

/**
 * Knock on WF12 when a mail is due. Once per three minutes at most, or once
 * per thirty seconds when Sjoerd pressed Send, so "now" means about now.
 */
create or replace function public.outreach_send_wake(p_now timestamptz default now())
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_now      timestamptz := coalesce(p_now, now());
  v_secret   text;
  v_throttle interval := interval '3 minutes';
begin
  if not public.outreach_send_due(8, v_now) then
    return false;
  end if;

  if exists (
    select 1 from public.outreach_send_queue q
     where q.status = 'queued' and q.direct
       and (q.niet_voor is null or q.niet_voor <= v_now)
  ) then
    v_throttle := interval '30 seconds';
  end if;

  update public.outreach_send_state st
     set gewekt_op = v_now
   where st.id
     and (st.gewekt_op is null or st.gewekt_op <= v_now - v_throttle);
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

revoke all on function public.outreach_reply_in_window(timestamptz) from public, anon, authenticated;
revoke all on function public.outreach_queue_lane(boolean, text) from public, anon, authenticated;
revoke all on function public.outreach_send_blocked(int, timestamptz, text) from public, anon, authenticated;
revoke all on function public.outreach_send_due(int, timestamptz) from public, anon, authenticated;
revoke all on function public.outreach_send_claim(int, timestamptz) from public, anon, authenticated;
revoke all on function public.outreach_send_done(uuid, text) from public, anon, authenticated;
revoke all on function public.outreach_send_wake(timestamptz) from public, anon, authenticated;
grant execute on function public.outreach_reply_in_window(timestamptz) to service_role;
grant execute on function public.outreach_queue_lane(boolean, text) to service_role;
grant execute on function public.outreach_send_blocked(int, timestamptz, text) to service_role;
grant execute on function public.outreach_send_due(int, timestamptz) to service_role;
grant execute on function public.outreach_send_claim(int, timestamptz) to service_role;
grant execute on function public.outreach_send_done(uuid, text) to service_role;

-- The reply lane runs to 18:00 Amsterdam, which is 16:00 UTC in summer and
-- 17:00 in winter; the cold window starts at 09:00 (07:00/08:00 UTC). Every
-- minute from 06:00 to 17:59 UTC on weekdays covers both; the exact edges
-- are decided by the window functions, not by this schedule.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'outreach-send-wake') then
    perform cron.unschedule('outreach-send-wake');
  end if;
end $$;

select cron.schedule(
  'outreach-send-wake',
  '* 6-17 * * 1-5',
  $$select public.outreach_send_wake()$$
);
