-- Encore v2: let each n8n stage (WF2P, WF3P, WF4P) claim a report once.
--
-- On 2026-11-11 one webhook call from WF2P arrived at WF3P as three separate
-- HTTP requests (three Cloudflare ray ids within 70 ms), so the whole scoring
-- and report chain ran three times and wrote three sets of sections. The
-- duplication happens outside our nodes, so each stage now claims
-- (report_id, stage) first and drops the run when another run holds it.
--
-- The claim expires after p_ttl_minutes, so a deliberate rerun of the same
-- report later still works. Called only by n8n with the service role.

create table if not exists public.workflow_stage_claims (
  report_id  uuid        not null,
  stage      text        not null,
  claimed_at timestamptz not null default now(),
  primary key (report_id, stage)
);

alter table public.workflow_stage_claims enable row level security;

grant select, insert, update, delete on public.workflow_stage_claims to service_role;

-- Returns {"claimed": true} for the first caller, {"claimed": false} for any
-- caller while a fresh claim exists. Concurrent callers are serialised by the
-- primary key, so exactly one of them wins.
create or replace function public.claim_workflow_stage(
  p_report_id   uuid,
  p_stage       text,
  p_ttl_minutes integer default 10
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  won boolean;
begin
  insert into public.workflow_stage_claims (report_id, stage, claimed_at)
  values (p_report_id, p_stage, now())
  on conflict (report_id, stage) do update
    set claimed_at = now()
    where public.workflow_stage_claims.claimed_at < now() - make_interval(mins => p_ttl_minutes)
  returning true into won;

  return jsonb_build_object('claimed', coalesce(won, false));
end;
$$;

revoke all on function public.claim_workflow_stage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.claim_workflow_stage(uuid, text, integer) to service_role;
