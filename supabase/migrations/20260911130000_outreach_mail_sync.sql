-- Outreach phase 3: mail sync, reply triage, partner hand-off.
-- Design: docs/superpowers/specs/2026-09-11-outreach-mail-sync-design.md
--
-- Additive: three new status values, one link column, one new table, two
-- functions. Nothing existing is dropped or rewritten.

-- ── 1. Statuses ──────────────────────────────────────────────────────────────
-- gereageerd:         the bureau replied, Sjoerd is up (draft waits in Gmail)
-- partner_aangemaakt: a partners row exists for this bureau
-- codes_gemint:       at least one code was minted for that partner
alter table public.outreach_prospects
  drop constraint if exists outreach_prospects_status_check;
alter table public.outreach_prospects
  add constraint outreach_prospects_status_check check (status in (
    'nog_niet_benaderd', 'verzonden', 'opvolging_1', 'opvolging_2',
    'gereageerd',
    'gesprek_gepland', 'gesprek_gevoerd', 'pilot_afgesproken',
    'partner_aangemaakt', 'codes_gemint',
    'pilot_gestart', 'founding_partner',
    'afgewezen', 'geen_fit'
  ));

-- ── 2. Prospect ↔ partner ────────────────────────────────────────────────────
alter table public.outreach_prospects
  add column if not exists partner_slug text references public.partners(slug) on delete set null;
create index if not exists idx_outreach_prospects_partner
  on public.outreach_prospects (partner_slug);
comment on column public.outreach_prospects.partner_slug is
  'The partners row created for this bureau (normally the same slug). Set by ops-partners save, or by outreach_code_request when a reply asks for a test code.';

-- ── 3. Mail log ──────────────────────────────────────────────────────────────
-- One row per Gmail message that could be tied to a prospect. Written only by
-- the outreach-mail-sync edge function (service role). RLS on, no policies.
create table if not exists public.outreach_mails (
  id               uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id  text not null,
  slug             text,
  direction        text not null check (direction in ('out', 'in')),
  -- out: eerste (first touch) | opvolging (2nd/3rd touch) | antwoord (our reply after theirs)
  -- in:  reactie
  kind             text not null check (kind in ('eerste', 'opvolging', 'antwoord', 'reactie')),
  from_email       text,
  to_email         text,
  subject          text,
  snippet          text,
  sent_at          timestamptz not null,
  -- inbound only
  sentiment        text check (sentiment is null or sentiment in
                     ('positief', 'code', 'vraag', 'later', 'afwijzing', 'auto', 'overig')),
  samenvatting     text,
  draft_id         text,
  status_voor      text,
  status_na        text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_outreach_mails_slug_sent on public.outreach_mails (slug, sent_at desc);
create index if not exists idx_outreach_mails_thread on public.outreach_mails (gmail_thread_id);
alter table public.outreach_mails enable row level security;
comment on table public.outreach_mails is
  'Outreach mail log, synced from Gmail by n8n WF11 via the outreach-mail-sync function. gmail_message_id is the dedupe key. draft_id = the Gmail draft n8n created for an inbound reply (never sent automatically).';

-- ── 4. Ladder ────────────────────────────────────────────────────────────────
create or replace function public.outreach_status_rank(p_status text)
returns int
language sql
immutable
as $$
  select case p_status
    when 'nog_niet_benaderd'  then 0
    when 'verzonden'          then 1
    when 'opvolging_1'        then 2
    when 'opvolging_2'        then 3
    when 'gereageerd'         then 4
    when 'gesprek_gepland'    then 5
    when 'gesprek_gevoerd'    then 6
    when 'pilot_afgesproken'  then 7
    when 'partner_aangemaakt' then 8
    when 'codes_gemint'       then 9
    when 'pilot_gestart'      then 10
    when 'founding_partner'   then 11
    else null  -- afgewezen / geen_fit are not on the ladder
  end
$$;

-- The single "automation never moves a bureau backwards" rule. Every automatic
-- status change (sent-mail sync, reply triage, partner save, mint) goes through
-- here; the dropdown in /ops stays a direct, human write.
--
--   * a target at or below the current rung is a no-op;
--   * afgewezen is accepted from every state except pilot_gestart,
--     founding_partner and geen_fit (a running pilot saying no is a human call);
--   * from afgewezen, anything from gereageerd upwards re-opens the bureau
--     (they changed their mind: a reply, a code request);
--   * geen_fit is never set here and is never left automatically;
--   * target verzonden stamps verzonden_op when it is still empty, whatever the
--     status outcome, so the scanner filter gets the real send time.
-- Returns the resulting status.
create or replace function public.outreach_advance_status(
  p_slug   text,
  p_status text,
  p_at     timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_next    text;
begin
  select status into v_current
    from public.outreach_prospects
   where slug = p_slug
     for update;
  if v_current is null then
    return null;
  end if;

  v_next := v_current;

  if p_status = 'geen_fit' or v_current = 'geen_fit' then
    v_next := v_current;
  elsif p_status = 'afgewezen' then
    if v_current not in ('pilot_gestart', 'founding_partner') then
      v_next := 'afgewezen';
    end if;
  elsif v_current = 'afgewezen' then
    if public.outreach_status_rank(p_status) >= public.outreach_status_rank('gereageerd') then
      v_next := p_status;
    end if;
  elsif public.outreach_status_rank(p_status) > public.outreach_status_rank(v_current) then
    v_next := p_status;
  end if;

  if v_next <> v_current then
    update public.outreach_prospects
       set status = v_next, updated_at = now()
     where slug = p_slug;
  end if;

  if p_status = 'verzonden' then
    update public.outreach_prospects
       set verzonden_op = p_at
     where slug = p_slug and verzonden_op is null;
  end if;

  return v_next;
end;
$$;

-- ── 5. Code request ──────────────────────────────────────────────────────────
-- A bureau replied "code" (or plain interest): make sure a partner exists for
-- it, link it, mint ONE code valid six weeks, move the ladder to codes_gemint,
-- and hand back the /p/:slug link for the reply draft. Partner slug = prospect
-- slug unless the prospect was already linked to another partner.
create or replace function public.outreach_code_request(
  p_slug text,
  p_lang text default 'nl'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect     public.outreach_prospects%rowtype;
  v_partner_slug text;
  v_code         text;
  v_lang         text := case when p_lang = 'en' then 'en' else 'nl' end;
  v_created      boolean := false;
begin
  select * into v_prospect from public.outreach_prospects where slug = p_slug;
  if not found then
    raise exception 'Unknown prospect %', p_slug;
  end if;

  v_partner_slug := coalesce(v_prospect.partner_slug, v_prospect.slug);

  insert into public.partners (slug, name)
  values (v_partner_slug, left(coalesce(v_prospect.naam, v_prospect.slug), 80))
  on conflict (slug) do nothing;
  v_created := found;

  update public.outreach_prospects
     set partner_slug = v_partner_slug, updated_at = now()
   where slug = p_slug and partner_slug is distinct from v_partner_slug;

  select code into v_code
    from public.mint_partner_codes(v_partner_slug, 1, now() + interval '6 weeks');

  perform public.outreach_advance_status(p_slug, 'codes_gemint', now());

  return jsonb_build_object(
    'code', v_code,
    'link', 'https://cairnly.io/p/' || v_partner_slug || '?code=' || v_code || '&lang=' || v_lang,
    'partner_slug', v_partner_slug,
    'partner_created', v_created
  );
end;
$$;

-- Both functions write partner/prospect state and mint codes: service role only.
revoke all on function public.outreach_status_rank(text) from public, anon, authenticated;
grant  execute on function public.outreach_status_rank(text) to service_role;
revoke all on function public.outreach_advance_status(text, text, timestamptz) from public, anon, authenticated;
grant  execute on function public.outreach_advance_status(text, text, timestamptz) to service_role;
revoke all on function public.outreach_code_request(text, text) from public, anon, authenticated;
grant  execute on function public.outreach_code_request(text, text) to service_role;
