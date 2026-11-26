-- Encore numbers for the new Encore home tab of /ops (2026-11-26).
--
-- Called straight from the browser with the admin's own session
-- (supabase.rpc('ops_encore_stats', { p_days })), gated by is_ops_admin(), so
-- no edge function has to change or redeploy.
--
-- Definitions (window = last p_days days, and the same length before that for
-- the comparison):
--   visits       sessions that saw any /encore page
--   landed       sessions whose FIRST page view was an /encore page
--   bounce_rate  of those landed sessions: one page view and never engaged
--                (same engaged-bounce rule as ops_traffic_stats)
--   to_payment   sessions that reached /encore/payment
--   paid         Stripe payments only (purchases with a payment intent or
--                checkout session) for an Encore access code. Free, partner
--                and hand-minted codes do not count.
--   claimed      Encore codes claimed by an account (any source)
--   survey_done  Encore users who finished the questionnaire in the window
--
-- Returns counts only, never names.

create or replace function public.ops_encore_stats(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_from timestamptz := now() - make_interval(days => p_days);
  v_prev timestamptz := now() - make_interval(days => p_days * 2);
  v_encore constant text := 'Encore%';
  v_out jsonb;
begin
  if not (public.is_ops_admin(auth.jwt() ->> 'email') or v_role = 'service_role' or v_role = '') then
    raise exception 'not authorized';
  end if;

  with pv as (
    select session_id, path, engaged, created_at
    from page_views
    where created_at > v_prev
  ),
  sess as (
    select
      session_id,
      min(created_at) as first_at,
      (array_agg(path order by created_at))[1] as first_path,
      count(*) as views,
      bool_or(engaged) as engaged,
      bool_or(path ilike '/encore%') as saw_encore,
      bool_or(path ilike '/encore/payment%') as saw_payment
    from pv
    group by session_id
  ),
  w as (
    select
      case when first_at > v_from then 'cur' else 'prev' end as win,
      *
    from sess
  ),
  traffic as (
    select
      win,
      count(*) filter (where saw_encore) as visits,
      count(*) filter (where first_path ilike '/encore%') as landed,
      count(*) filter (where first_path ilike '/encore%' and views = 1 and not engaged) as bounced,
      count(*) filter (where saw_payment) as to_payment
    from w
    group by win
  ),
  enc_codes as (
    select id, user_id, used_at from access_codes where survey_type like v_encore
  ),
  paid as (
    select
      count(*) filter (where p.created_at > v_from) as cur,
      count(*) filter (where p.created_at > v_prev and p.created_at <= v_from) as prev,
      count(*) as total
    from purchases p
    join enc_codes c on c.id = p.access_code_id
    where p.stripe_payment_intent_id is not null or p.stripe_session_id is not null
  ),
  claimed as (
    select
      count(*) filter (where used_at > v_from) as cur,
      count(*) filter (where used_at > v_prev and used_at <= v_from) as prev,
      count(*) filter (where user_id is not null) as total
    from enc_codes
  ),
  survey as (
    select
      count(*) filter (where e.survey_completed_at > v_from) as cur,
      count(*) filter (where e.survey_completed_at > v_prev and e.survey_completed_at <= v_from) as prev,
      count(*) filter (where e.survey_completed_at is not null) as total
    from user_engagement_tracking e
    where e.user_id in (select user_id from enc_codes where user_id is not null)
  )
  select jsonb_build_object(
    'days', p_days,
    'visits',      jsonb_build_object('cur', coalesce((select visits from traffic where win = 'cur'), 0),
                                      'prev', coalesce((select visits from traffic where win = 'prev'), 0)),
    'landed',      jsonb_build_object('cur', coalesce((select landed from traffic where win = 'cur'), 0),
                                      'prev', coalesce((select landed from traffic where win = 'prev'), 0)),
    'bounce_rate', jsonb_build_object(
                     'cur',  (select round(100.0 * bounced / nullif(landed, 0)) from traffic where win = 'cur'),
                     'prev', (select round(100.0 * bounced / nullif(landed, 0)) from traffic where win = 'prev')),
    'to_payment',  jsonb_build_object('cur', coalesce((select to_payment from traffic where win = 'cur'), 0),
                                      'prev', coalesce((select to_payment from traffic where win = 'prev'), 0)),
    'paid',        (select to_jsonb(paid) from paid),
    'claimed',     (select to_jsonb(claimed) from claimed),
    'survey_done', (select to_jsonb(survey) from survey)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.ops_encore_stats(int) from public, anon;
grant execute on function public.ops_encore_stats(int) to authenticated, service_role;

comment on function public.ops_encore_stats(int) is
  'Encore traffic, bounce and Stripe-paid counts for /ops. Admin-gated via is_ops_admin().';
