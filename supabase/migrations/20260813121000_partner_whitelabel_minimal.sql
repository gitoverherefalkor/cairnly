-- Minimal partner white-labeling for the report PDF.
--
-- Scope is deliberately narrow: partner logo on the PDF cover, partner logo in
-- a per-page footer, and a "Powered by Cairnly" line. No seats, no billing, no
-- partner auth, no partner dashboard, no per-partner colours. Those belong to
-- the fuller partner plan, which extends `partners` and reuses these FKs.
--
-- Resolution path for the PDF is profiles.partner_id, because report-print-data
-- already reads the profiles row and can widen its select for free.
--
-- NOTE: reports.access_code_id was considered as a resolution path and
-- rejected -- it is populated on 0 of 27 live reports and is a dead column.

create table if not exists public.partners (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  -- Object path inside the private `partner-logos` bucket, e.g. 'acme/logo.svg'.
  -- NEVER a URL: the deployed CSP's img-src does not allow supabase.co, so the
  -- logo is inlined as a data: URI by report-print-data.
  logo_path       text,
  logo_mime       text,
  -- Optional override for the credit line. NULL renders "Powered by Cairnly".
  powered_by_text text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- No policies: partners are admin-seeded and read only by service-role edge
-- functions. RLS on with zero policies denies anon/authenticated by default,
-- matching report_render_tokens and the support-attachments precedent.
alter table public.partners enable row level security;

-- Grouping anchor: a partner buys a batch of codes. Nothing groups codes by a
-- purchaser today (access_codes.user_id is the redeeming end-user). Nullable --
-- every existing code is a direct Cairnly sale.
alter table public.access_codes
  add column if not exists partner_id uuid references public.partners(id) on delete set null;
create index if not exists idx_access_codes_partner on public.access_codes (partner_id);

-- Resolution point read by report-print-data. Nullable -- NULL means unbranded
-- Cairnly output, which is every user today.
alter table public.profiles
  add column if not exists partner_id uuid references public.partners(id) on delete set null;
create index if not exists idx_profiles_partner on public.profiles (partner_id);

-- Cache key: a user assigned to a partner AFTER their PDF was generated must
-- not keep receiving the unbranded cached copy.
alter table public.report_pdfs
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

-- Private, admin-seeded, service-role only. Same shape as support-attachments.
-- 256 KB cap: base64 inflates ~33%, and the largest live report payload is
-- 67 KB, so an unoptimised logo would dominate the print-data response. For
-- reference this repo's own cairnly_logo_wordmark.png is 771 KB -- assume a
-- partner will hand you something equally unoptimised.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-logos', 'partner-logos', false, 262144, array['image/png', 'image/svg+xml'])
on conflict (id) do nothing;
