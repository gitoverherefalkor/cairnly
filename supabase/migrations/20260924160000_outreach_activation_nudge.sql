-- Outreach: a nudge when a partner's test code sits unused.
--
-- An agency that asked for a test code and got one has said yes once already.
-- When nobody redeems it within four working days of the mail that carried it,
-- outreach-prepare writes one short nudge into the cockpit ("heb je al tijd
-- gehad om de testcode te proberen?"). It always waits for Sjoerd: it follows
-- a real conversation, the same policy as check-ins.
--
-- Two changes, both additive:
--   1. a fifth concept kind, 'activation', on the concepts table and the queue;
--   2. partner_code_status gains when the first code was minted and how many
--      codes are still open (unclaimed, not expired), which is what the /ops
--      "Codes activated" card and the nudge's clock need. New columns go at the
--      end, so CREATE OR REPLACE VIEW keeps every existing reader working.

-- ── 1. The new kind ──────────────────────────────────────────────────────────

alter table public.outreach_concepts drop constraint if exists outreach_concepts_soort_check;
alter table public.outreach_concepts
  add constraint outreach_concepts_soort_check
  check (soort in ('initial', 'chase', 'checkin', 'reply', 'activation'));

alter table public.outreach_send_queue drop constraint if exists outreach_send_queue_soort_check;
alter table public.outreach_send_queue
  add constraint outreach_send_queue_soort_check
  check (soort in ('chase', 'initial', 'reply', 'checkin', 'activation'));

-- ── 2. The view ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.partner_code_status
WITH (security_invoker = true) AS
SELECT
  p.id        AS partner_id,
  p.slug,
  p.name,
  p.is_active,
  count(ac.id)                                                      AS codes_issued,
  count(ac.id) FILTER (WHERE ac.user_id IS NOT NULL)                AS codes_claimed,
  count(ac.id) FILTER (WHERE ac.usage_count > 0)                    AS surveys_started,
  count(ac.id) FILTER (
    WHERE ac.user_id IS NULL
      AND ac.expires_at IS NOT NULL
      AND ac.expires_at < now()
  )                                                                 AS expired_unused,
  (
    SELECT count(*)
      FROM public.reports r
      JOIN public.profiles pr ON pr.id = r.user_id
     WHERE pr.partner_id = p.id
       AND r.status = 'completed'
  )                                                                 AS reports_completed,
  min(ac.created_at)                                                AS first_code_at,
  count(ac.id) FILTER (
    WHERE ac.user_id IS NULL
      AND (ac.expires_at IS NULL OR ac.expires_at >= now())
  )                                                                 AS codes_open
FROM public.partners p
LEFT JOIN public.access_codes ac ON ac.partner_id = p.id
GROUP BY p.id, p.slug, p.name, p.is_active;

REVOKE ALL ON public.partner_code_status FROM PUBLIC;
REVOKE ALL ON public.partner_code_status FROM anon;
REVOKE ALL ON public.partner_code_status FROM authenticated;
GRANT  SELECT ON public.partner_code_status TO service_role;
