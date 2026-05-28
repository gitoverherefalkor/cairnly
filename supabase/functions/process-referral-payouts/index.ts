// Daily cron worker: process referral payouts that have passed their 14-day
// holding window.
//
// Triggered by pg_cron (see migration 20260528130100_referral_payouts_cron.sql)
// once per day at 02:00 UTC. The cron call carries the service_role JWT in the
// Authorization header; this function is JWT-verified at the Supabase gateway
// (verify_jwt = true, the default — not overridden in config.toml).
//
// What it does for each pending+eligible payout row:
//   1. Atomically flip status pending -> processing (locks the row).
//   2. Call stripe.refunds.create({ payment_intent, amount, metadata }).
//   3. Fast path: if Stripe returns refund.status='succeeded' synchronously
//      (common for cards), mark the payout 'succeeded' immediately.
//      Otherwise, the stripe-refund-webhook will flip the status when the
//      refund.created/refund.failed event arrives.
//   4. On Stripe error: mark the row 'failed' with the error message.
//
// Bounded batch size (100 rows) to keep one runaway run from hammering
// Stripe; daily cadence means backlog catches up in subsequent days.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const BATCH_LIMIT = 100;

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    // Same service-role env var name used by the other edge functions in this
    // project (see payment-success). Naming is historical; it's the
    // service_role key.
    Deno.env.get("NEW_N8N_SERVICE_ROLE_KEY")!,
  );

  // Pull a bounded batch of pending payouts whose holding window has elapsed.
  // Partial index idx_referral_payouts_pending_eligible makes this O(rows
  // ready), not O(table).
  const { data: payouts, error: queryError } = await supabase
    .from("referral_payouts")
    .select(
      "id, referrer_payment_intent_id, payout_amount_cents, currency, referrer_user_id, referral_sequence_number",
    )
    .eq("status", "pending")
    .lte("eligible_at", new Date().toISOString())
    .order("eligible_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (queryError) {
    console.error("Failed to query pending payouts:", queryError);
    return new Response(
      JSON.stringify({ error: "Query failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!payouts || payouts.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, succeeded: 0, failed: 0, skipped: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const payout of payouts) {
    // Atomic claim: only proceed if WE flip the row from pending to
    // processing. Two simultaneous cron runs (shouldn't happen at daily
    // cadence, but defensive) would each see the row in their SELECT, but
    // only one wins the UPDATE.
    const { data: claimed, error: claimError } = await supabase
      .from("referral_payouts")
      .update({ status: "processing" })
      .eq("id", payout.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      console.warn("Could not claim payout (already claimed?)", {
        id: payout.id,
        claimError,
      });
      skipped++;
      continue;
    }

    try {
      const refund = await stripe.refunds.create({
        payment_intent: payout.referrer_payment_intent_id,
        amount: payout.payout_amount_cents,
        // Currency is implied by the payment_intent; we don't pass it.
        metadata: {
          referral_payout_id: payout.id,
          referrer_user_id: payout.referrer_user_id,
          referral_sequence_number: String(payout.referral_sequence_number),
          source: "process-referral-payouts",
        },
      });

      console.log("Stripe refund initiated", {
        payoutId: payout.id,
        refundId: refund.id,
        refundStatus: refund.status,
      });

      // Fast path: many card refunds settle synchronously.
      if (refund.status === "succeeded") {
        await supabase
          .from("referral_payouts")
          .update({
            status: "succeeded",
            stripe_refund_id: refund.id,
            processed_at: new Date().toISOString(),
          })
          .eq("id", payout.id);
      } else {
        // Async — record the refund ID so the webhook can match it back.
        // Status stays 'processing' until the webhook flips it.
        await supabase
          .from("referral_payouts")
          .update({ stripe_refund_id: refund.id })
          .eq("id", payout.id);
      }
      succeeded++;
    } catch (e) {
      const reason = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      console.error("Stripe refund failed", {
        payoutId: payout.id,
        reason,
      });
      await supabase
        .from("referral_payouts")
        .update({
          status: "failed",
          failure_reason: reason,
          processed_at: new Date().toISOString(),
        })
        .eq("id", payout.id);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({
      processed: payouts.length,
      succeeded,
      failed,
      skipped,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
