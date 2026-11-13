-- Progress per individual free code, for the Ops "Free codes" tab.
--
-- One row per code minted in Ops (issued_to set). Shows which product the code
-- unlocks and how far the person got, so Sjoerd can track invited testers:
--
--   signed up        the code was redeemed (access_codes.user_id set)
--   survey started   an answers row exists for the code (draft or submitted)
--   survey submitted an answers row for the code has status 'submitted'
--   report ready     the person's latest report is 'pending_review' or 'completed'
--                    (n8n moves it there when the report is written)
--   chat started     the person sent at least one chat message
--   report final     the latest report is 'completed' (chat feedback processed)
--
-- reports has no access_code_id in practice, so report and chat are matched on
-- the redeeming user. Read-only, service role only (the edge function reads it).

CREATE OR REPLACE VIEW public.free_code_status
WITH (security_invoker = true) AS
SELECT
  ac.id,
  ac.code,
  ac.survey_type,
  CASE
    WHEN ac.survey_type ILIKE 'Encore%'  THEN 'encore'
    WHEN ac.survey_type ILIKE 'Starter%' THEN 'starter'
    ELSE 'pro'
  END                                        AS product,
  ac.issued_to,
  ac.issued_on,
  ac.created_at,
  ac.is_active,
  ac.user_id,
  ac.used_at,
  ans.started                                AS survey_started,
  ans.submitted_at                           AS survey_submitted_at,
  rep.status                                 AS report_status,
  coalesce(rep.status IN ('pending_review', 'completed'), false) AS report_ready,
  chat.first_at                              AS chat_started_at
FROM public.access_codes ac
LEFT JOIN LATERAL (
  SELECT true AS started,
         max(a.submitted_at) FILTER (WHERE a.status = 'submitted') AS submitted_at
    FROM public.answers a
   WHERE a.access_code_id = ac.id
  HAVING count(*) > 0
) ans ON true
LEFT JOIN LATERAL (
  SELECT r.status
    FROM public.reports r
   WHERE ac.user_id IS NOT NULL AND r.user_id = ac.user_id
   ORDER BY r.created_at DESC
   LIMIT 1
) rep ON true
LEFT JOIN LATERAL (
  SELECT min(m.created_at) AS first_at
    FROM public.chat_messages m
   WHERE ac.user_id IS NOT NULL AND m.user_id = ac.user_id AND m.sender = 'user'
) chat ON true
WHERE ac.issued_to IS NOT NULL;

COMMENT ON VIEW public.free_code_status IS
  'Ops free-code tracker: product and progress (signed up, survey, report, chat) per individual free code.';

-- Backend-only: the ops-free-codes edge function reads it with the service role.
REVOKE ALL ON public.free_code_status FROM PUBLIC;
REVOKE ALL ON public.free_code_status FROM anon;
REVOKE ALL ON public.free_code_status FROM authenticated;
GRANT  SELECT ON public.free_code_status TO service_role;
