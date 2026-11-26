-- 1. Belt and braces for the outreach pause (20261126120000): flip the send
--    kill switch too, so a stray "Send" in the archived outreach table cannot
--    reach WF12 either. Undo with `gepauzeerd = false`.
update public.outreach_send_state set gepauzeerd = true where id = true;

-- 2. Encore A-tier shortlist (2026-11-26). Which existing outreach prospects
--    are real high-potential partners for Encore (they demonstrably work with
--    older, white-collar candidates). Kept apart from outreach_prospects.tier,
--    which is the Pro campaign's tiering, and read straight from the browser by
--    an admin so no edge function has to change. Rows are added only after
--    Sjoerd approves them.
create table if not exists public.ops_encore_shortlist (
  slug        text primary key references public.outreach_prospects(slug) on delete cascade,
  score       numeric(2,1),
  bewijs      text,
  bewijs_url  text,
  haak        text,
  created_at  timestamptz not null default now()
);

alter table public.ops_encore_shortlist enable row level security;

drop policy if exists "ops admins read encore shortlist" on public.ops_encore_shortlist;
create policy "ops admins read encore shortlist"
  on public.ops_encore_shortlist for select
  to authenticated
  using (public.is_ops_admin(auth.jwt() ->> 'email'));

grant select on public.ops_encore_shortlist to authenticated;
grant select, insert, update, delete on public.ops_encore_shortlist to service_role;
