-- Atomic monthly budget for the post-report coach, used by chat-proxy.
-- p_delta = 1 reserves a message (refused at the limit), p_delta = -1 refunds
-- one when n8n fails, so a failed reply never costs the user a message.
-- Returns messages used this month after the change, or -1 when the limit is
-- already reached (nothing changed).

CREATE OR REPLACE FUNCTION public.coach_usage_bump(
  p_report_id UUID,
  p_user_id UUID,
  p_limit INTEGER,
  p_delta INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month DATE := date_trunc('month', now())::date;
  v_used INTEGER;
BEGIN
  IF p_delta > 0 THEN
    INSERT INTO coach_usage (report_id, month, user_id, messages_used)
    VALUES (p_report_id, v_month, p_user_id, 0)
    ON CONFLICT (report_id, month) DO NOTHING;

    UPDATE coach_usage
       SET messages_used = messages_used + p_delta,
           last_message_at = now()
     WHERE report_id = p_report_id AND month = v_month
       AND messages_used + p_delta <= p_limit
    RETURNING messages_used INTO v_used;

    RETURN coalesce(v_used, -1);
  END IF;

  UPDATE coach_usage
     SET messages_used = greatest(0, messages_used + p_delta)
   WHERE report_id = p_report_id AND month = v_month
  RETURNING messages_used INTO v_used;
  RETURN coalesce(v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.coach_usage_bump(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coach_usage_bump(UUID, UUID, INTEGER, INTEGER) TO service_role;
