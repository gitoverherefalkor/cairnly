-- Access-code data-integrity fix.
--
-- Bug: `access_codes.is_used` is never written by any code path (true on 0 of 80
-- codes). All entitlement gating uses `usage_count >= max_usage`, so this had no
-- functional impact — it is a data-hygiene / reporting-correctness issue. The
-- single authoritative consumption point is the consume_access_code RPC, so we
-- set is_used there, plus a one-time backfill of historical rows.
--
-- (user_id binding was already fixed in May 2026; the only historical gap is a
-- handful of pre-fix codes whose user_id never got bound — backfilled below from
-- the matching purchase email.)

-- 1. Consume RPC now also marks the code used. Signature/predicate/grants
--    unchanged from 20260513120300 — only `is_used = TRUE` is added to the SET.
CREATE OR REPLACE FUNCTION public.consume_access_code(p_code_id uuid)
 RETURNS TABLE(id uuid, code text, usage_count integer, max_usage integer, used_at timestamp with time zone, user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller UUID := auth.uid();
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    RETURN QUERY
    UPDATE public.access_codes ac
    SET
        usage_count = ac.usage_count + 1,
        used_at = NOW(),
        is_used = TRUE
    WHERE ac.id = p_code_id
      AND (ac.user_id IS NULL OR ac.user_id = v_caller)
      AND ac.usage_count < ac.max_usage
      AND COALESCE(ac.is_active, TRUE) = TRUE
      AND (ac.expires_at IS NULL OR ac.expires_at > NOW())
    RETURNING ac.id, ac.code, ac.usage_count, ac.max_usage, ac.used_at, ac.user_id;
END;
$function$;

-- 2a. Backfill: bind user_id for unbound codes whose purchase email matches
--     exactly one auth user (the buyer). The count(*) = 1 guard avoids any
--     ambiguous bind. Anonymized (deleted) purchases won't match a live user.
UPDATE public.access_codes ac
SET user_id = sub.uid
FROM (
  SELECT pu.access_code_id,
         (array_agg(DISTINCT u.id))[1] AS uid,
         count(DISTINCT u.id) AS n
  FROM public.purchases pu
  JOIN auth.users u ON lower(u.email) = lower(pu.email)
  WHERE pu.access_code_id IS NOT NULL
  GROUP BY pu.access_code_id
  HAVING count(DISTINCT u.id) = 1
) sub
WHERE ac.id = sub.access_code_id
  AND ac.user_id IS NULL;

-- 2b. Backfill: mark codes used where a survey was submitted or usage recorded.
UPDATE public.access_codes ac
SET is_used = TRUE,
    usage_count = GREATEST(ac.usage_count, 1),
    used_at = COALESCE(ac.used_at, NOW())
WHERE ac.is_used IS DISTINCT FROM TRUE
  AND (EXISTS (SELECT 1 FROM public.answers a
                WHERE a.access_code_id = ac.id AND a.status = 'submitted')
       OR ac.usage_count > 0);
