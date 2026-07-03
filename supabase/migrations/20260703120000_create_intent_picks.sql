-- Intent chips: anonymous log of which entry-reason visitors pick on the landing page.
-- source distinguishes organic chip clicks from future ad-slug visits, so
-- "most popular intent" analysis uses clean chip data only.
create table public.intent_picks (
  id uuid primary key default gen_random_uuid(),
  intent_key text not null check (intent_key in
    ('default', 'good-at-it', 'ai-worried', 'life-changed', 'understand-myself', 'other')),
  free_text text check (char_length(free_text) <= 500),
  locale text not null check (char_length(locale) <= 5),
  visitor_id uuid not null,
  source text not null default 'chip' check (source in ('chip', 'slug')),
  created_at timestamptz not null default now()
);

alter table public.intent_picks enable row level security;

-- Write-only from the client: no select/update/delete policies for anon.
create policy "anyone can log an intent pick"
  on public.intent_picks for insert
  to anon, authenticated
  with check (true);
