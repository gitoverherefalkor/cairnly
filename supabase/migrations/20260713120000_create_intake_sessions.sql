-- Intake chat sessions (landing-page pre-payment conversational funnel)
-- Stores the anonymous intake chat transcript, extraction and email so the
-- funnel can be resumed via magic link and measured via status transitions.
-- Service-role only: RLS enabled with no policies; all access goes through
-- the intake-chat edge function. Links to purchases by email match (no FK).

create table public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- which "what brings you here?" pill seeded the chat ('default' when none)
  intent text not null default 'default',
  language text not null default 'en',
  -- what opened the chat: main CTA, an intent pill, or a magic-link resume
  source text not null default 'cta',
  -- funnel: active -> pitched -> email_captured
  status text not null default 'active',
  -- full transcript: [{role: 'assistant'|'user', text, at}]
  messages jsonb not null default '[]'::jsonb,
  -- mapper-compatible survey pre-fill fields extracted at pitch time
  extraction jsonb,
  pitch text,
  email text,
  -- secret token for the magic-link resume email
  resume_token uuid not null default gen_random_uuid(),
  user_turns integer not null default 0,
  total_tokens integer not null default 0
);

alter table public.intake_sessions enable row level security;

create index intake_sessions_email_idx on public.intake_sessions (email);
create unique index intake_sessions_resume_token_idx on public.intake_sessions (resume_token);
