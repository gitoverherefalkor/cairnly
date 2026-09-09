-- Backfill: the send times of the first bureaus-sep26 batch.
--
-- Seven mails went out on 2026-09-09 from sjoerd@cairnly.io, subject "Vraagje
-- over jullie spoor 2-trajecten". These timestamps are the Sent-folder times,
-- to the second, read once and written here so the scanner filter in
-- outreach_prospect_stats has something to measure against. Everything sent
-- from now on stamps itself when the status is flipped to 'verzonden' in /ops,
-- so this backfill is a one-off for the batch that predates the column.
--
-- Idempotent: only fills a NULL, so re-running never overwrites a later
-- correction or a stamp set through the ops console.

update public.outreach_prospects as p
set verzonden_op = v.sent_at
from (values
  ('careeradvisor',  timestamptz '2026-09-09 10:51:36+00'),
  ('goingconcern',   timestamptz '2026-09-09 10:51:38+00'),
  ('talenta',        timestamptz '2026-09-09 10:51:48+00'),
  ('venv',           timestamptz '2026-09-09 10:51:59+00'),
  ('regioeffect',    timestamptz '2026-09-09 10:52:45+00'),
  ('hrconsultancy',  timestamptz '2026-09-09 10:53:04+00'),
  ('puls',           timestamptz '2026-09-09 11:13:09+00')
) as v(slug, sent_at)
where p.slug = v.slug
  and p.verzonden_op is null;
