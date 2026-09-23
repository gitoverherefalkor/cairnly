-- "No reply needed" on an outreach row.
--
-- Some replies need no answer ("I'll pass it on, my colleagues will be in
-- touch"), yet they kept the agency on "Waiting on you" forever, because that
-- counter only asks who wrote last. ops-outreach now compares this stamp with
-- the newest incoming mail: dismissed only while it is newer than their last
-- mail, so a NEW mail from them puts the agency back on the list by itself.
-- Nothing is ever sent or deleted because of it; the Gmail thread is untouched.

alter table public.outreach_prospects
  add column if not exists reply_dismissed_at timestamptz;

comment on column public.outreach_prospects.reply_dismissed_at is
  'Set by /ops "No reply needed". Only counts while newer than the agency''s latest incoming mail.';
