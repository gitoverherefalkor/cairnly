import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders, handleCorsPreFlight, errorResponse, checkRateLimit } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  // Rate limit: 5 checkout attempts per minute per IP
  const rateLimited = checkRateLimit(req, 5, corsHeaders);
  if (rateLimited) return rateLimited;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("Stripe API key not configured");
      return errorResponse("Payment system is not available. Please try again later.", 500, corsHeaders);
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Verify the Stripe account is active before proceeding
    try {
      await stripe.balance.retrieve();
    } catch (stripeError) {
      console.error("Stripe account error:", stripeError);
      return errorResponse("Payment system is temporarily unavailable. Please try again later.", 500, corsHeaders);
    }

    const { firstName, lastName, email, country, referralCode } = await req.json();

    if (!firstName || !lastName || !email || !country) {
      return errorResponse("First name, last name, email, and country are required", 400, corsHeaders);
    }

    console.log("Creating checkout session for:", email, "Country:", country);

    // For now, only use card payments
    const paymentMethods: string[] = ["card"];

    // Get the origin from request headers or use the live domain
    const origin = req.headers.get("origin") || "https://cairnly.io";

    // If the buyer arrived via a referral code, resolve it to a live Stripe
    // promotion code so we can pre-apply the 25% discount.
    let referralPromo: Stripe.PromotionCode | null = null;
    if (referralCode && typeof referralCode === "string") {
      try {
        const promoList = await stripe.promotionCodes.list({
          code: referralCode.trim(),
          active: true,
          limit: 1,
        });
        referralPromo = promoList.data[0] ?? null;
      } catch (e) {
        console.warn("Could not resolve referral code:", e);
      }
    }

    // Build the session. Stripe forbids `discounts` and `allow_promotion_codes`
    // together — so pre-apply the referral discount when we have one, otherwise
    // leave the manual promotion-code field open at Stripe checkout.
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: paymentMethods,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Cairnly Assessment",
              description: "Complete assessment with personalized career insights",
            },
            unit_amount: 3900, // €39.00 (beta price)
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      // Back/cancel from Stripe returns the buyer to the checkout form, not
      // the marketing homepage — they're mid-purchase and usually want to
      // tweak a field (country, email) and try again.
      cancel_url: `${origin}/payment`,
      customer_email: email,
      metadata: {
        firstName,
        lastName,
        email,
        country,
      },
      locale: country === "Netherlands" ? "nl" : country === "Germany" ? "de" : "auto",
    };

    if (referralPromo) {
      sessionParams.discounts = [{ promotion_code: referralPromo.id }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return errorResponse("Failed to create checkout session. Please try again.", 500, corsHeaders);
  }
});
