-- Record the Stripe promotion code used on every purchase, not only referral
-- codes (those already land in referrals.promotion_code_used). Lets us tell a
-- free 100%-off checkout or a campaign discount apart from a full-price sale.
--
-- Deliberately no amount_paid/currency here: access_codes.price_paid and
-- access_codes.currency already hold what Stripe charged, and a second copy
-- on purchases would drift.
alter table public.purchases
  add column if not exists promo_code text;

comment on column public.purchases.promo_code is
  'Stripe promotion code applied at checkout (any kind, referral or not). Null when none.';
