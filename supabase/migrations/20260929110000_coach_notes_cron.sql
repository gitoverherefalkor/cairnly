-- Coach notes: which reports need (re)writing, and the clock that does it.
-- Apply AFTER the coach-notes edge function is deployed.
--
-- A report is due when its chat transcript still exists and its notes are
-- missing or older than the last chat message. Covers (decision P, option a):
--   * the one-off backfill of existing users whose transcript has not been
--     purged yet (their notes must exist before purge_expired_assessment_data
--     at 03:11 UTC removes the transcript), and
--   * refreshing notes after new coach conversations.
-- Existing users are told about the notes on their first coach visit.

CREATE OR REPLACE FUNCTION public.coach_notes_due(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (report_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.report_id
  FROM (
    SELECT cm.report_id, max(cm.created_at) AS last_at
    FROM chat_messages cm
    WHERE cm.report_id IS NOT NULL
    GROUP BY cm.report_id
  ) m
  JOIN reports r ON r.id = m.report_id
  LEFT JOIN coach_notes n ON n.report_id = m.report_id
  WHERE n.report_id IS NULL
     OR n.source_through IS NULL
     OR n.source_through < m.last_at
  -- Oldest transcripts first: those are closest to being purged.
  ORDER BY m.last_at ASC
  LIMIT greatest(1, least(p_limit, 100));
$$;

REVOKE ALL ON FUNCTION public.coach_notes_due(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coach_notes_due(INTEGER) TO service_role;

-- Every 3 hours, plus 02:15 UTC so notes are fresh right before the 03:11
-- purge. Each call handles up to 25 reports; only stale ones cost an LLM call.
-- Reuses the shared-secret caller from the outreach cron (generic despite the
-- name: POSTs to any edge function with x-shared-secret from the vault).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'coach-notes-refresh') THEN
    PERFORM cron.unschedule('coach-notes-refresh');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'coach-notes-prepurge') THEN
    PERFORM cron.unschedule('coach-notes-prepurge');
  END IF;
END $$;

SELECT cron.schedule('coach-notes-refresh', '40 */3 * * *',
  $$select public.outreach_call_function('coach-notes', '{"backfill": true, "limit": 25}'::jsonb)$$);
SELECT cron.schedule('coach-notes-prepurge', '15 2 * * *',
  $$select public.outreach_call_function('coach-notes', '{"backfill": true, "limit": 100}'::jsonb)$$);
