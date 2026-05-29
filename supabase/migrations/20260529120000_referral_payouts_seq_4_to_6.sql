-- Correct the referral_payouts sequence range.
--
-- The unlock ladder is 6 steps per converted referral: tools on referrals
-- 1–3, refunds on referrals 4–6 (25% / 25% / 50%). The original table
-- constrained referral_sequence_number to 1–3 (when refunds were mistakenly
-- mapped to the first three referrals). Refunds now fire on 4–6, so the
-- constraint must move to that range.
--
-- Safe to apply: there are no referral_payouts rows yet (the only one created
-- was a test row, already deleted), so no existing data violates either bound.

ALTER TABLE public.referral_payouts
  DROP CONSTRAINT IF EXISTS referral_payouts_referral_sequence_number_check;

ALTER TABLE public.referral_payouts
  ADD CONSTRAINT referral_payouts_referral_sequence_number_check
  CHECK (referral_sequence_number BETWEEN 4 AND 6);

COMMENT ON COLUMN public.referral_payouts.referral_sequence_number IS
'Which referral triggered this payout: 4, 5, or 6. Referrals 1–3 unlock tools (no payout). Tiers: 4→25%, 5→25%, 6→50% (cumulative 100%).';
