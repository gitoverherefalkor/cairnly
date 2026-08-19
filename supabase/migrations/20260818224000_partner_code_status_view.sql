-- Per-partner rollup: how far did each batch of codes actually get?
--
-- This is the evidence a partner asks for and the number the Q4 pitch to the
-- slower channels (sector funds, larger outplacers) rests on.
--
-- Reports are joined through profiles.partner_id, NOT reports.access_code_id.
-- That column is populated on 0 of 27 live reports and is dead; the white-label
-- migration rejected it as a resolution path for the same reason.
--
-- security_invoker = true so the caller's RLS applies. Without it a Postgres
-- view runs with the OWNER's rights and would hand any signed-in user the whole
-- partner book. Grants are then narrowed to service_role on top of that.

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
  )                                                                 AS reports_completed
FROM public.partners p
LEFT JOIN public.access_codes ac ON ac.partner_id = p.id
GROUP BY p.id, p.slug, p.name, p.is_active;

REVOKE ALL ON public.partner_code_status FROM PUBLIC;
REVOKE ALL ON public.partner_code_status FROM anon;
REVOKE ALL ON public.partner_code_status FROM authenticated;
GRANT  SELECT ON public.partner_code_status TO service_role;
