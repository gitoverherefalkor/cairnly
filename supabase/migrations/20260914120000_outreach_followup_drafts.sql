-- Outreach: let /ops ask for a follow-up draft.
--
-- The button in the Outreach tab does not talk to Gmail; it raises a flag here.
-- The next WF11 run asks outreach-mail-sync for work, the function composes the
-- chase, and the SAME Gmail leg that already creates reply drafts creates this
-- one. That is why this is two columns and no workflow change: WF11 creates
-- whatever drafts the function hands back, and does not care what they are.
--
-- followup_requested_at  the moment Sjoerd asked for it (cleared when the
--                        agency leaves the chaseable statuses, so a request
--                        that was overtaken by a hand-sent mail dies quietly)
-- followup_draft_id      the Gmail draft id, written back once it exists.
--                        Pending == requested_at not null AND draft_id null.

alter table public.outreach_prospects
  add column if not exists followup_requested_at timestamptz,
  add column if not exists followup_draft_id      text;

comment on column public.outreach_prospects.followup_requested_at is
  'Set by the "Draft follow-up" button in /ops. outreach-mail-sync composes a draft for every row where this is set and followup_draft_id is null, on the next WF11 run.';
comment on column public.outreach_prospects.followup_draft_id is
  'Gmail draft id of the queued follow-up, written back by outreach-mail-sync once n8n created it. Cleared whenever a new follow-up is requested.';

-- Pending queue: tiny, but this is read on every sync run.
create index if not exists idx_outreach_prospects_followup_pending
  on public.outreach_prospects (followup_requested_at)
  where followup_requested_at is not null and followup_draft_id is null;
