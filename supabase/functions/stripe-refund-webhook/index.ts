// Stripe webhook for refund / dispute events affecting referral payouts.
//
// Registered as a SEPARATE webhook endpoint in the Stripe Dashboard from
// payment-success (which handles checkout.session.completed). Each endpoint
// is filtered to its own event types, so there's no overlap and no risk of
// touching the purchase flow.
//
// Required env vars:
//   STRIPE_SECRET_KEY                  (already set, shared with other fns)
//   STRIPE_REFUND_WEBHOOK_SECRET       (new — signing secret of this endpoint)
//   SUPABASE_URL                       (already set)
//   NEW_N8N_SERVICE_ROLE_KEY           (already set — service-role key)
//
// Events handled (configure these on the Stripe webhook endpoint):
//   refund.created   -> mark payout 'succeeded' (or 'failed' if rejected)
//   refund.updated   -> same logic (status may change asynchronously)
//   refund.failed    -> mark payout 'failed' with reason
//   charge.dispute.created -> cancel any pending payouts for the referrer
//                             whose ORIGINAL purchase is being disputed
//                             (anti-fraud: stop paying out money to someone
//                             who's clawing back their own purchase)
//
// verify_jwt = false (set in config.toml) — Stripe doesn't send JWTs; auth
// is via stripe-signature header verification.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_REFUND_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("STRIPE_REFUND_WEBHOOK_SECRET not configured");
    return new Response("Server misconfigured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("NEW_N8N_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "refund.created":
      case "refund.updated": {
        const refund = event.data.object as Stripe.Refund;
        const payoutId = refund.metadata?.referral_payout_id;
        if (!payoutId) {
          console.log("Refund event without referral_payout_id metadata — ignoring", {
            refundId: refund.id,
            eventType: event.type,
          });
          break;
        }

        if (refund.status === "succeeded") {
          await supabase
            .from("referral_payouts")
            .update({
              status: "succeeded",
              stripe_refund_id: refund.id,
              processed_at: new Date().toISOString(),
            })
            .eq("id", payoutId)
            .in("status", ["pending", "processing"]);
          console.log("Payout marked succeeded", { payoutId, refundId: refund.id });
        } else if (refund.status === "failed" || refund.status === "canceled") {
          await supabase
            .from("referral_payouts")
            .update({
              status: "failed",
              failure_reason: refund.failure_reason || refund.status || "refund did not succeed",
              processed_at: new Date().toISOString(),
            })
            .eq("id", payoutId)
            .in("status", ["pending", "processing"]);
          console.log("Payout marked failed", {
            payoutId,
            refundId: refund.id,
            refundStatus: refund.status,
          });
        }
        // status='pending' or 'requires_action' — wait for the next event.
        break;
      }

      case "refund.failed": {
        const refund = event.data.object as Stripe.Refund;
        const payoutId = refund.metadata?.referral_payout_id;
        if (!payoutId) {
          console.log("refund.failed without referral_payout_id metadata — ignoring");
          break;
        }
        await supabase
          .from("referral_payouts")
          .update({
            status: "failed",
            failure_reason: refund.failure_reason || "refund.failed event",
            processed_at: new Date().toISOString(),
          })
          .eq("id", payoutId)
          .in("status", ["pending", "processing"]);
        console.log("Payout marked failed (refund.failed event)", { payoutId });
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const paymentIntentId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id ?? null;

        if (!paymentIntentId) {
          console.warn("Dispute event without payment_intent — cannot link to referrer");
          break;
        }

        // Find the purchase being disputed.
        const { data: disputedPurchase } = await supabase
          .from("purchases")
          .select("email")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();

        if (!disputedPurchase?.email) {
          // Dispute on a payment we don't recognize — could be a Stripe test
          // event or a charge from another flow. Safe to ignore.
          console.log("Dispute on a payment_intent not in our purchases table — ignoring", {
            paymentIntentId,
            disputeId: dispute.id,
          });
          break;
        }

        // Resolve email to user_id via profiles.
        const { data: disputedProfile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", disputedPurchase.email)
          .maybeSingle();

        if (!disputedProfile?.id) {
          console.log("Disputed purchase email has no profile row — nothing to cancel", {
            email: disputedPurchase.email,
          });
          break;
        }

        // Cancel any still-pending payouts for this referrer. This is the
        // anti-fraud bite: someone who's disputing their original purchase
        // shouldn't simultaneously collect referral cashback on the same
        // money. Already-paid-out (succeeded) payouts stay — at that point
        // the money is gone, and an alert here would be useful but is out
        // of scope for this MVP.
        const { data: cancelled, error: cancelError } = await supabase
          .from("referral_payouts")
          .update({
            status: "cancelled",
            failure_reason: `dispute on referrer's original payment: ${dispute.id}`,
            processed_at: new Date().toISOString(),
          })
          .eq("referrer_user_id", disputedProfile.id)
          .eq("status", "pending")
          .select("id");

        if (cancelError) {
          console.error("Failed to cancel pending payouts after dispute:", cancelError);
        } else {
          console.warn("Dispute filed — cancelled pending payouts for referrer", {
            disputeId: dispute.id,
            referrerUserId: disputedProfile.id,
            cancelledCount: cancelled?.length ?? 0,
          });
        }
        break;
      }

      default:
        console.log("Unhandled Stripe event type (ignored):", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return new Response("Handler error", { status: 500 });
  }
});
