-- Referral payouts: pay a referrer back a percentage of their own purchase
-- for each successful referral, up to a 100% cumulative cap.
--
-- Tiering (% of referrer's net amount paid):
--   Referral 1: 25%
--   Referral 2: 25%
--   Referral 3: 50%
--   Referral 4+: no payout (cap reached)
--
-- Payout mechanism: Stripe refund issued 14 days after the referred purchase
-- (so we're past the chargeback window). Refund goes to the referrer's
-- original payment method via their payment_intent.
--
-- Self-protecting against edge cases:
--   - Referrer never bought   -> no stripe_payment_intent_id -> no payout row created
--   - Referrer used 100% promo -> price_paid=0 -> payout amount = 0 -> no row created
--   - Race on sequence number  -> UNIQUE(referrer_user_id, seq) crashes the loser
--   - Zero-amount payout       -> CHECK > 0 blocks at DB level


-- 1. Track the Stripe payment_intent on every new purchase ------------------
-- Required to issue a refund to the referrer. Nullable: old purchases
-- (testers, the one early real user) won't have this. payment-success will
-- start populating it for all new buyers.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Indexed for the stripe-refund-webhook dispute path, which has to find a
-- purchase by payment_intent to figure out which referrer was disputed.
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_payment_intent_id
  ON public.purchases (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;


-- 2. referral_payouts table -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One-to-one with the referral row that triggered this payout. Restrict
  -- delete: if the referral goes away the payout history shouldn't silently
  -- vanish.
  referral_id uuid NOT NULL UNIQUE
    REFERENCES public.referrals(id) ON DELETE RESTRICT,

  -- Denormalised so queries don't need to join through referrals.
  referrer_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The referrer's original payment_intent. This is where the refund lands.
  referrer_payment_intent_id text NOT NULL,

  -- 1, 2, or 3. Tier 4+ never gets a row created.
  referral_sequence_number integer NOT NULL
    CHECK (referral_sequence_number BETWEEN 1 AND 3),

  payout_amount_cents integer NOT NULL CHECK (payout_amount_cents > 0),
  -- Audit trail of which tier % was applied. 25 for tiers 1/2, 50 for tier 3.
  payout_pct integer NOT NULL CHECK (payout_pct IN (25, 50)),
  currency text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  -- 14 days after the referred purchase. After this, the cron will pick it up.
  eligible_at timestamptz NOT NULL,
  -- When the refund actually went through (succeeded/failed/cancelled).
  processed_at timestamptz,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- waiting for eligible_at to pass
    'processing',  -- cron called Stripe refund API, awaiting webhook
    'succeeded',   -- Stripe confirmed refund went through
    'failed',      -- Stripe rejected the refund
    'cancelled'    -- cancelled by a dispute on the referrer's own payment
  )),
  stripe_refund_id text,
  failure_reason text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Race protection: if two referred purchases land at the same instant,
  -- only one can claim each sequence slot. The loser's INSERT errors with
  -- 23505 and the application code logs it and moves on.
  CONSTRAINT referral_payouts_referrer_seq_key
    UNIQUE (referrer_user_id, referral_sequence_number)
);

-- Hot path for the daily cron: "show me pending payouts whose time has come".
-- Partial index keeps it tiny — only pending rows are ever in here.
CREATE INDEX IF NOT EXISTS idx_referral_payouts_pending_eligible
  ON public.referral_payouts (eligible_at)
  WHERE status = 'pending';

-- For dashboard queries: "show me all my payouts".
CREATE INDEX IF NOT EXISTS idx_referral_payouts_referrer_user_id
  ON public.referral_payouts (referrer_user_id);


-- 3. RLS -------------------------------------------------------------------
-- A user can SEE their own payouts (powers any future "referral earnings"
-- panel on the dashboard). All writes are service-role only — payouts can
-- only be created by payment-success and processed by process-referral-payouts.
ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'referral_payouts'
      AND policyname = 'Users can view their own payouts'
  ) THEN
    CREATE POLICY "Users can view their own payouts"
      ON public.referral_payouts FOR SELECT
      USING (auth.uid() = referrer_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'referral_payouts'
      AND policyname = 'Service role full access on referral_payouts'
  ) THEN
    CREATE POLICY "Service role full access on referral_payouts"
      ON public.referral_payouts FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

COMMENT ON TABLE public.referral_payouts IS
'One row per referral payout owed to a referrer. Inserted by payment-success when a referral is recorded. Processed 14 days later by process-referral-payouts (pg_cron). Refund issued via Stripe to referrer_payment_intent_id. Tier %s: 25/25/50, capped at 3 referrals = 100% recovery.';
