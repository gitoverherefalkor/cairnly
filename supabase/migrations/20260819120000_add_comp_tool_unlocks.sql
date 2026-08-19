-- Comped tool unlocks: let us grant the referral-gated tools to a specific user
-- without fabricating referrals for them.
--
-- The three extra tools (Find Job Openings, Tailor Your Resume, Tailor Cover
-- Letters) unlock at 1, 2 and 3 converted referrals. Steps 4-6 on that SAME
-- counter are cash refunds (25/25/50%), queued by the payment-success edge
-- function off `select count(*) from referrals where referrer_user_id = ...`.
--
-- That coupling is why comping someone by inserting referral rows is the wrong
-- move: it silently advances them up the refund ladder, so their first REAL
-- referral lands on sequence 4 and queues an actual Stripe refund. It also puts
-- signups that never happened into the referral numbers.
--
-- This column is read ONLY by the tool gate in useReferralStatus.ts. The refund
-- steps stay driven by the real referral count, so a comp can never move money.
--
-- 0 = no comp (default, every existing user). 3 = all three tools.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS comp_tool_unlocks integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_comp_tool_unlocks_range
  CHECK (comp_tool_unlocks >= 0 AND comp_tool_unlocks <= 3);

COMMENT ON COLUMN public.profiles.comp_tool_unlocks IS
  'Manually granted tool unlocks (0-3), for comping someone the referral-gated tools. Read only by the tool gate; never affects the referral refund ladder, which stays keyed to real referrals.';
