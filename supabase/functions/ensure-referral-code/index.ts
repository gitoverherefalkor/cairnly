import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  checkRateLimit,
  getAuthenticatedUser,
} from "../_shared/cors.ts";

// Generates an 8-character referral code. Same unambiguous alphabet as the
// access-code generator, but no hyphens — referral codes must stay visually
// distinct from access codes so users and support don't confuse them.
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 8; i++) code += chars.charAt(bytes[i] % chars.length);
  return code;
}

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  const rateLimited = checkRateLimit(req, 10, corsHeaders);
  if (rateLimited) return rateLimited;

  try {
    // Authenticate from the JWT — the user id comes from the verified token,
    // never from the request body.
    const authed = await getAuthenticatedUser(req, corsHeaders);
    if (authed instanceof Response) return authed;
    const userId = authed.userId;

    const couponId = Deno.env.get("STRIPE_REFERRAL_COUPON_ID");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!couponId || !stripeKey) {
      // Log the specific missing var server-side; keep the client message generic.
      console.error(
        `Referral config missing: ${!couponId ? "STRIPE_REFERRAL_COUPON_ID " : ""}${!stripeKey ? "STRIPE_SECRET_KEY" : ""}`.trim(),
      );
      return errorResponse("Referral system is not available right now.", 500, corsHeaders);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("NEW_N8N_SERVICE_ROLE_KEY")!,
    );

    // Already minted? Return it immediately — no Stripe call.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to read profile:", profileError);
      return errorResponse("Could not load your referral code.", 500, corsHeaders);
    }

    if (profile?.referral_code) {
      return new Response(
        JSON.stringify({ referralCode: profile.referral_code }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mint a new code. Retry on the (extremely rare) collision.
    let referralCode = "";
    let promotionCodeId = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      referralCode = generateReferralCode();
      try {
        const promo = await stripe.promotionCodes.create({
          coupon: couponId,
          code: referralCode,
          metadata: { referrer_user_id: userId },
          // No max_redemptions / expires_at — the code is reusable forever.
        });
        promotionCodeId = promo.id;
        break;
      } catch (err) {
        // Stripe rejects a duplicate `code` string. This happens if (a) two
        // codes collided, or (b) a previous run created the Stripe code but
        // failed to persist it. Look the existing code up: if it belongs to
        // this user, reuse it (idempotent); otherwise try a fresh code.
        const existing = await stripe.promotionCodes
          .list({ code: referralCode, limit: 1 })
          .catch(() => null);
        const found = existing?.data?.[0];
        if (found && found.metadata?.referrer_user_id === userId) {
          promotionCodeId = found.id;
          break;
        }
        if (found) {
          // Genuine collision with another user's code — try again.
          continue;
        }
        console.error("Stripe promotion code creation failed:", err);
        return errorResponse(
          "Could not create your referral code. Please try again.",
          500,
          corsHeaders,
        );
      }
    }

    if (!promotionCodeId) {
      return errorResponse(
        "Could not create your referral code. Please try again.",
        500,
        corsHeaders,
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        referral_code: referralCode,
        stripe_promotion_code_id: promotionCodeId,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to save referral code to profile:", updateError);
      // The Stripe code exists; a retry will find and reuse it via the catch
      // path above, so the function stays idempotent.
      return errorResponse(
        "Could not save your referral code. Please try again.",
        500,
        corsHeaders,
      );
    }

    return new Response(
      JSON.stringify({ referralCode }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("ensure-referral-code error:", error);
    return errorResponse("An error occurred. Please try again.", 500, corsHeaders);
  }
});
