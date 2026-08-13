-- Report PDF pipeline: render tokens, generated-PDF records, private bucket.
--
-- Headless Chromium (running in the Vercel renderer) has no Supabase session,
-- so it cannot read report data directly. Instead the orchestrator mints a
-- single-use, short-lived token here; the print route presents it to the
-- public report-print-data function, which validates and burns it before
-- returning data via the service role.

create table if not exists public.report_render_tokens (
  token       uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_report_render_tokens_report
  on public.report_render_tokens (report_id);
create index if not exists idx_report_render_tokens_expiry
  on public.report_render_tokens (expires_at);

-- No RLS policies: only the service role ever touches this table. RLS on with
-- zero policies means any anon/authenticated access is denied by default.
alter table public.report_render_tokens enable row level security;

-- ── Generated PDFs ──────────────────────────────────────────────────────────

create table if not exists public.report_pdfs (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references public.reports(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  storage_path   text not null,
  byte_size      integer,
  language       text not null default 'en',
  generated_at   timestamptz not null default now(),
  -- Bump when the print layout changes so stale PDFs can be regenerated.
  layout_version integer not null default 1
);

comment on column public.report_pdfs.language is
  'The language the report is STAMPED as (copied from report_sections.language). '
  'Not a guarantee about the language of the rendered prose: WF3/WF4 narrative '
  'content is currently hard-forced to English even when sections say nl.';

create unique index if not exists idx_report_pdfs_one_per_report
  on public.report_pdfs (report_id);

alter table public.report_pdfs enable row level security;

-- Users may see that their own PDF exists (the dashboard needs this to decide
-- whether to show a download button). Writes stay service-role only.
drop policy if exists "own report pdfs are readable" on public.report_pdfs;
create policy "own report pdfs are readable"
  on public.report_pdfs for select
  to authenticated
  using (user_id = auth.uid());

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Private bucket. The edge functions (service role) are the only reader and
-- writer; users receive time-limited signed URLs, never direct object access.
--
-- NOTE: the FKs above are deliberately `on delete cascade`. A RESTRICT would
-- abort the auth.users BEFORE DELETE trigger (20260616130000), permanently
-- breaking account deletion. The consequence is that the report_pdfs row is
-- gone before anything could use storage_path to clean up, so erasure of the
-- objects themselves is handled by a prefix sweep in delete-user-data.

insert into storage.buckets (id, name, public)
values ('report-pdfs', 'report-pdfs', false)
on conflict (id) do nothing;

-- ── Housekeeping ────────────────────────────────────────────────────────────
-- Expired render tokens are dead weight. Purge daily at 03:20 UTC.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-expired-render-tokens') then
    perform cron.unschedule('purge-expired-render-tokens');
  end if;
end $$;

select cron.schedule(
  'purge-expired-render-tokens',
  '20 3 * * *',
  $$ delete from public.report_render_tokens where expires_at < now() - interval '1 day' $$
);
