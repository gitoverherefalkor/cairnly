-- WF5C's Postgres credential connects as n8n_chat_user (a limited role that
-- otherwise only owns n8n_chat_histories). Let it call the two coach
-- functions WF5C needs. Both are SECURITY DEFINER, so this grants these two
-- entry points only, not direct table access.
GRANT EXECUTE ON FUNCTION public.get_coach_snapshot(UUID) TO n8n_chat_user;
GRANT EXECUTE ON FUNCTION public.coach_save_next_step(UUID, TEXT, INTEGER, TEXT) TO n8n_chat_user;
