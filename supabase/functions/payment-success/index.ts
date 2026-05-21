import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreFlight, errorResponse } from "../_shared/cors.ts";
import {
  renderEmail,
  bodyRow,
  ctaRow,
  h1,
  paragraph,
  fineprint,
  callout,
  escapeHtml,
} from "../_shared/email-chrome.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Function to generate a cryptographically secure access code
function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed similar looking characters
  const totalChars = 16; // 4 groups of 4
  const randomBytes = new Uint8Array(totalChars);
  crypto.getRandomValues(randomBytes);

  let code = "";
  for (let i = 0; i < totalChars; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars.charAt(randomBytes[i] % chars.length);
  }
  return code;
}

// Function to send the access code email
async function sendAccessCodeEmail(email: string, firstName: string, lastName: string, accessCode: string) {
  try {
    const bodyHtml = bodyRow(
      h1("Your Purchase was Successful!") +
      paragraph(`Hello ${firstName} ${lastName},`) +
      paragraph("Thank you for purchasing Cairnly. You can continue right where you left off, your assessment is ready on the platform.") +
      paragraph('<strong style="color:#122E3B;font-weight:700;">Keep this access code safe.</strong> It\'s your backup, use it to log back in any time and pick up your assessment.') +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
  <tr><td style="background-color:#122E3B;background-image:linear-gradient(135deg,#122E3B 0%,#213F4F 100%);border-radius:14px;padding:28px 24px;text-align:center;">
    <p class="code-mob" style="margin:0;color:#FFFFFF;font-size:26px;font-weight:700;letter-spacing:5px;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;">${accessCode}</p>
  </td></tr>
</table>` +
      paragraph(
        'Need to get back to your assessment? Head to your <a href="https://cairnly.io/dashboard" style="color:#1F8282;text-decoration:underline;font-weight:600;">dashboard</a>, you can start a new assessment or continue an existing one from there.',
        { mb: 0 },
      ) +
      fineprint("Your access code is valid for one year from today. If you have any questions, please contact our support team."),
    );

    const html = renderEmail({
      title: "Your Cairnly Access Code",
      preheader: "Your purchase was successful. Keep your access code safe.",
      bodyHtml,
    });

    const { error } = await resend.emails.send({
      from: "Cairnly <no-reply@cairnly.io>",
      to: [email],
      subject: "Your Cairnly Access Code",
      html,
    });

    if (error) {
      console.error("Email sending error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}

// "A friend joined Cairnly through your code" — sent to the referrer the
// moment a new conversion crosses the 1, 2, or 3 friend threshold (those
// are the conversions that actually unlock a tool). After 3, no email —
// nothing new to celebrate.
const REFERRAL_UNLOCK_TIERS: Array<{
  count: number;
  toolLabel: string;
  toolBody: string; // sentence describing what it does
  next: { count: number; toolLabel: string } | null;
  cta: { label: string; href: string };
}> = [
  {
    count: 1,
    toolLabel: "Find Open Roles",
    toolBody: "live job openings matched to your top career recommendations",
    next: { count: 2, toolLabel: "Tailor Your Resume" },
    cta: { label: "Find open roles now", href: "https://cairnly.io/jobs" },
  },
  {
    count: 2,
    toolLabel: "Tailor Your Resume",
    toolBody: "an AI rewrite of your uploaded resume tailored to specific jobs you want to apply for",
    next: { count: 3, toolLabel: "Tailor Cover Letters" },
    cta: { label: "See your unlocked tool", href: "https://cairnly.io/dashboard" },
  },
  {
    count: 3,
    toolLabel: "Tailor Cover Letters",
    toolBody: "cover letters customised to each job on your shortlist",
    next: null,
    cta: { label: "See your unlocked tool", href: "https://cairnly.io/dashboard" },
  },
];

async function sendReferralUnlockEmail(args: {
  referrerEmail: string;
  referrerFirstName: string | null;
  referrerCode: string | null;
  inviteeFirstName: string | null;
  // deno-lint-ignore no-explicit-any
  supabase: any;
  referrerUserId: string;
}): Promise<void> {
  const { referrerEmail, referrerFirstName, referrerCode, inviteeFirstName, supabase, referrerUserId } = args;

  // Count how many converted referrals this user has now (post-insert).
  const { count, error: countError } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", referrerUserId);

  if (countError) {
    console.error("Referral count query failed:", countError);
    return;
  }

  const tier = REFERRAL_UNLOCK_TIERS.find((t) => t.count === (count ?? 0));
  if (!tier) {
    // Past the 3rd unlock — nothing new to celebrate, skip.
    return;
  }

  if (!Deno.env.get("RESEND_API_KEY")) {
    console.warn("RESEND_API_KEY not set; skipping referral unlock email");
    return;
  }

  const firstName = referrerFirstName?.trim() || "there";
  const inviteeName = inviteeFirstName?.trim() || "someone";
  const subject = `You just unlocked ${tier.toolLabel} for free`;
  const codeBlock = referrerCode
    ? `<p style="margin:0;color:#122E3B;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;">Your code: <strong style="font-family:'Poppins','Inter',Arial,sans-serif;letter-spacing:1.5px;color:#1F8282;font-weight:700;">${escapeHtml(referrerCode)}</strong> &nbsp;·&nbsp; <a href="https://cairnly.io/dashboard?share=1" style="color:#1F8282;text-decoration:underline;font-weight:600;">Share it again</a></p>`
    : `<p style="margin:0;color:#122E3B;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;"><a href="https://cairnly.io/dashboard?share=1" style="color:#1F8282;text-decoration:underline;font-weight:600;">Share your code again →</a></p>`;

  const nextLine = tier.next
    ? paragraph(
        `Invite one more friend and <strong style="color:#122E3B;font-weight:700;">${escapeHtml(tier.next.toolLabel)}</strong> opens up too.`,
      )
    : paragraph(
        `That's all three tools unlocked. Thank you for helping three people find some clarity, it genuinely matters.`,
      );

  const bodyHtml =
    bodyRow(
      h1("A friend joined Cairnly through your code") +
        paragraph(
          `Hey ${escapeHtml(firstName)}, ${escapeHtml(inviteeName)} just used your code and took their first step toward better career clarity.`,
        ) +
        paragraph(
          `<strong style="color:#122E3B;font-weight:700;">${tier.count} of 3 friends joined.</strong> ${escapeHtml(tier.toolLabel)} is now live on your dashboard — ${tier.toolBody}.`,
        ) +
        nextLine +
        paragraph(
          `Each invite helps someone find clarity, and earns you a tool for your own job hunt.`,
        ) +
        callout("YOUR REFERRAL CODE", codeBlock),
    ) +
    ctaRow(tier.cta.label, tier.cta.href) +
    `<tr><td style="padding:0 48px 24px;background-color:#ECE4D2;" class="px-mob">${fineprint("You're receiving this because someone just joined Cairnly using your referral code.")}</td></tr>`;

  const html = renderEmail({
    title: subject,
    preheader: `${tier.toolLabel} is now live on your dashboard.`,
    bodyHtml,
  });

  const { error: emailError } = await resend.emails.send({
    from: "Cairnly <no-reply@cairnly.io>",
    to: [referrerEmail],
    subject,
    html,
  });

  if (emailError) {
    console.error("Failed to send referral unlock email:", emailError);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // --- Stripe webhook signature verification ---
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let session: Stripe.Checkout.Session;

    if (stripeWebhookSecret && req.headers.get("stripe-signature")) {
      // Webhook mode: verify signature from Stripe
      const body = await req.text();
      const sig = req.headers.get("stripe-signature")!;

      try {
        const event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret);
        if (event.type !== "checkout.session.completed") {
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        session = event.data.object as Stripe.Checkout.Session;
      } catch (err) {
        console.error("Stripe webhook signature verification failed:", err);
        return errorResponse("Invalid webhook signature", 400, corsHeaders);
      }
    } else {
      // Fallback: frontend calls with sessionId (existing flow)
      const { sessionId } = await req.json();

      if (!sessionId) {
        return errorResponse("Session ID is required", 400, corsHeaders);
      }

      // Retrieve session from Stripe
      session = await stripe.checkout.sessions.retrieve(sessionId);
    }

    if (session.payment_status !== "paid") {
      return errorResponse("Payment is not complete", 400, corsHeaders);
    }

    // Re-retrieve the session with discount details expanded so we can see
    // which referral promotion code (if any) was used. Required for BOTH
    // entry paths — neither the raw webhook event object nor a plain
    // retrieve() carries the expanded promotion-code data.
    let referralPromoCode: string | null = null;
    let referrerUserId: string | null = null;
    try {
      const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["discounts.promotion_code", "total_details.breakdown.discounts"],
      });
      // deno-lint-ignore no-explicit-any
      const applied: any =
        (expandedSession.discounts && expandedSession.discounts[0]?.promotion_code) ||
        expandedSession.total_details?.breakdown?.discounts?.[0]?.discount?.promotion_code;
      if (applied && typeof applied === "object") {
        referralPromoCode = applied.code ?? null;
        referrerUserId = applied.metadata?.referrer_user_id ?? null;
      }
    } catch (e) {
      console.warn("Could not read discount info from session:", e);
    }

    // Create a Supabase client (using service role key to bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );

    // Idempotency: if a purchase row already exists for this Stripe session,
    // return the previously-minted access code rather than minting a new one.
    // Without this guard, Stripe webhook retries or duplicate success-page
    // calls would mint duplicate codes and re-email the customer.
    const { data: existingPurchase } = await supabase
      .from("purchases")
      .select("access_code_id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (existingPurchase?.access_code_id) {
      const { data: existingCode } = await supabase
        .from("access_codes")
        .select("code")
        .eq("id", existingPurchase.access_code_id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          accessCode: existingCode?.code ?? null,
          alreadyProcessed: true,
          message: "Payment already processed",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate a new access code
    const accessCode = generateAccessCode();

    // Calculate expiration date (1 year from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Extract pricing information from session
    const amountTotal = session.amount_total ? session.amount_total / 100 : 39;
    const currency = session.currency?.toUpperCase() || 'EUR';

    // Store the access code in the database with pricing info
    const { data: codeData, error: codeError } = await supabase
      .from("access_codes")
      .insert({
        code: accessCode,
        expires_at: expiresAt.toISOString(),
        price_paid: amountTotal,
        currency: currency,
        survey_type: 'Office / Business Pro - 2025 v1 EN'
      })
      .select("id")
      .single();

    if (codeError) {
      console.error("Error creating access code:", codeError);
      return errorResponse("Failed to process payment. Please contact support.", 500, corsHeaders);
    }

    // Extract customer information from session metadata
    const customerEmail = session.customer_details?.email;
    const firstName = session.metadata?.firstName || "Customer";
    const lastName = session.metadata?.lastName || "";
    const country = session.metadata?.country || "Unknown";

    // Store the purchase details. Race-safe: if another concurrent call won
    // the insert, the UNIQUE constraint on stripe_session_id throws and we
    // fall back to the existing code (whoever inserted wins).
    const { error: purchaseError } = await supabase
      .from("purchases")
      .insert({
        email: customerEmail,
        first_name: firstName,
        last_name: lastName,
        country: country,
        stripe_session_id: session.id,
        access_code_id: codeData.id,
      });

    if (purchaseError) {
      // 23505 = unique_violation — another concurrent call beat us to it.
      // Roll back our orphaned access_codes row and return the winner's code.
      if (purchaseError.code === '23505') {
        console.warn(`Race detected on stripe_session_id=${session.id}, falling back to existing code`);
        await supabase.from("access_codes").delete().eq("id", codeData.id);

        const { data: winnerPurchase } = await supabase
          .from("purchases")
          .select("access_code_id")
          .eq("stripe_session_id", session.id)
          .maybeSingle();
        const { data: winnerCode } = winnerPurchase?.access_code_id
          ? await supabase.from("access_codes").select("code").eq("id", winnerPurchase.access_code_id).maybeSingle()
          : { data: null };

        return new Response(
          JSON.stringify({
            success: true,
            accessCode: winnerCode?.code ?? null,
            alreadyProcessed: true,
            message: "Payment already processed",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("Error recording purchase:", purchaseError);
      return errorResponse("Failed to record purchase. Please contact support.", 500, corsHeaders);
    }

    // --- Referral credit -------------------------------------------------
    // If the buyer used a referral promotion code, credit the referrer with
    // one successful referral. This is purely additive — any failure here is
    // logged but never fails the purchase response.
    if (referrerUserId) {
      try {
        // Self-referral guard: a user cannot credit themselves by buying with
        // their own code. Compare the buyer email to the referrer's email.
        const { data: referrerProfile } = await supabase
          .from("profiles")
          .select("email, first_name, referral_code")
          .eq("id", referrerUserId)
          .maybeSingle();

        const isSelfReferral =
          !!referrerProfile?.email &&
          !!customerEmail &&
          referrerProfile.email.toLowerCase() === customerEmail.toLowerCase();

        if (isSelfReferral) {
          console.warn("Self-referral blocked", { referrerUserId });
        } else {
          const { error: referralError } = await supabase
            .from("referrals")
            .insert({
              referrer_user_id: referrerUserId,
              invitee_email: customerEmail,
              stripe_session_id: session.id,
              promotion_code_used: referralPromoCode,
              amount_paid: amountTotal,
              currency: currency,
            });
          // 23505 = duplicate stripe_session_id — already credited. Fine.
          if (referralError && referralError.code !== "23505") {
            console.error("Failed to record referral:", referralError);
          } else if (!referralError && referrerProfile?.email) {
            // Send the "friend joined, tool unlocked" email to the referrer.
            // Only fires on conversions 1, 2, and 3 (the moments a tool
            // actually unlocks). After 3 there's nothing new to celebrate.
            await sendReferralUnlockEmail({
              referrerEmail: referrerProfile.email,
              referrerFirstName: referrerProfile.first_name ?? null,
              referrerCode: referrerProfile.referral_code ?? null,
              inviteeFirstName: firstName,
              supabase,
              referrerUserId,
            }).catch((e) => console.error("Referral unlock email failed (non-fatal):", e));
          }
        }
      } catch (e) {
        console.error("Referral processing error (non-fatal):", e);
      }
    }

    // Try to update the profile if user exists with this email
    if (customerEmail) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", customerEmail)
        .maybeSingle();

      if (existingProfile) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            first_name: firstName,
            last_name: lastName,
            country: country,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingProfile.id);

        if (profileError) {
          console.warn("Could not update profile:", profileError);
        }
      }
    }

    // Send the access code via email
    if (customerEmail) {
      const emailSent = await sendAccessCodeEmail(customerEmail, firstName, lastName, accessCode);
      if (!emailSent) {
        console.warn("Warning: Email could not be sent, but purchase was successful");
      }
    }

    // Return access code and purchase data to the frontend for display and auth pre-fill.
    // This is the same HTTPS session that processed the payment — the user owns this data.
    return new Response(
      JSON.stringify({
        success: true,
        accessCode: accessCode,
        purchaseData: {
          email: customerEmail,
          firstName: firstName,
          lastName: lastName
        },
        message: "Payment processed successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error processing payment:", error);
    return errorResponse("An error occurred processing your payment. Please contact support.", 500, corsHeaders);
  }
});
