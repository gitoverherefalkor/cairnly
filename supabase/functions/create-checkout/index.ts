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

    const { firstName, lastName, email, country, referralCode, preferredLanguage, flavor } = await req.json();

    // Product flavor: 'starter' (cairnly.io/starter, first-job seekers),
    // 'encore' (cairnly.io/encore, pensioners / pre-retirees) or the default
    // professional assessment. Only known literals are accepted; anything else
    // (including absent, for all existing callers) means 'pro'.
    const resolvedFlavor: "pro" | "starter" | "encore" =
      flavor === "starter" || flavor === "encore" ? flavor : "pro";

    // Per-flavor product presentation and price. Amounts are in cents and must
    // stay in sync with src/lib/pricing.ts (what the marketing pages display).
    const FLAVOR_PRODUCTS = {
      pro: {
        name: "Cairnly Assessment",
        description: "Complete assessment with personalized career insights",
        unitAmount: 3900, // EUR 39.00 (beta price)
        cancelPath: "/payment",
      },
      starter: {
        name: "Cairnly Starter Assessment",
        description:
          "Starter assessment with career directions and entry routes for your first serious job",
        unitAmount: 3900, // EUR 39.00
        cancelPath: "/starter/payment",
      },
      encore: {
        name: "Cairnly Encore Assessment",
        description:
          "Encore assessment with personality profile and post-career directions that fit this stage of life",
        unitAmount: 7900, // EUR 79.00
        cancelPath: "/encore/payment",
      },
    } as const;
    const product = FLAVOR_PRODUCTS[resolvedFlavor];

    if (!firstName || !lastName || !email || !country) {
      return errorResponse("First name, last name, email, and country are required", 400, corsHeaders);
    }

    console.log("Creating checkout session for:", email, "Country:", country);

    // Get the origin from request headers or use the live domain
    const origin = req.headers.get("origin") || "https://cairnly.io";

    // Resolve to a Stripe Customer so Stripe Checkout can pre-fill the
    // buyer's name on the payment form — avoids re-typing the name for
    // iDEAL / Bancontact / etc., which Stripe always collects regardless
    // of the chosen method. Re-uses an existing customer when one matches
    // the email; creates one otherwise. A failure here is non-fatal — we
    // fall back to customer_email below.
    let customer: Stripe.Customer | null = null;
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data[0]) {
        customer = existing.data[0];
        if (fullName && customer.name !== fullName) {
          customer = await stripe.customers.update(customer.id, { name: fullName });
        }
      } else {
        customer = await stripe.customers.create({ email, name: fullName });
      }
    } catch (e) {
      console.warn("Could not resolve Stripe customer; falling back to customer_email:", e);
    }

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
    // Omitting payment_method_types makes Stripe Checkout use the methods
    // enabled in the Stripe Dashboard, filtered by the buyer's eligibility
    // (iDEAL for NL buyers, Bancontact for BE, Klarna where supported, etc.).
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: product.unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      // Back/cancel from Stripe returns the buyer to the checkout form, not
      // the marketing homepage — they're mid-purchase and usually want to
      // tweak a field (country, email) and try again.
      cancel_url: `${origin}${product.cancelPath}`,
      // `customer` (with pre-set name) gives us the pre-fill; fall back to
      // `customer_email` only if the customer resolution above failed.
      ...(customer ? { customer: customer.id } : { customer_email: email }),
      metadata: {
        firstName,
        lastName,
        email,
        country,
        // Language the buyer checked out in. Read by payment-success to send
        // the access-code receipt in the right language. Default 'en'.
        preferred_language: preferredLanguage === "nl" ? "nl" : "en",
        // Product flavor. Read by payment-success to mint the access code with
        // the matching survey_type ('starter'/'encore' load that flavor's survey).
        flavor: resolvedFlavor,
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
