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

// ─── Localized copy ─────────────────────────────────────────────────────────
// English is the source. Dutch follows the i18n glossary (casual je-form, no
// em-dashes, brand + feature names stay in English). Mirrors the inline-COPY
// pattern used by send-confirmation-email / send-reminder-email.
type Lang = "en" | "nl";

const pickLang = (v: string | null | undefined): Lang => (v === "nl" ? "nl" : "en");

const ACCESS_CODE_COPY = {
  en: {
    subject: "Your Cairnly Access Code",
    preheader: "Your purchase was successful. Keep your access code safe.",
    heading: "Your Purchase was Successful!",
    greeting: (f: string, l: string) => `Hello ${f} ${l},`,
    p1: "Thank you for purchasing Cairnly. You can continue right where you left off, your assessment is ready on the platform.",
    keepSafe:
      '<strong style="color:#122E3B;font-weight:700;">Keep this access code safe.</strong> It\'s your backup, use it to log back in any time and pick up your assessment.',
    backToDashboard:
      'Need to get back to your assessment? Head to your <a href="https://cairnly.io/dashboard" style="color:#1F8282;text-decoration:underline;font-weight:600;">dashboard</a>, you can start a new assessment or continue an existing one from there.',
    fineprint:
      "Your access code is valid for one year from today. If you have any questions, please contact our support team.",
  },
  nl: {
    subject: "Je Cairnly-toegangscode",
    preheader: "Je aankoop is gelukt. Bewaar je toegangscode goed.",
    heading: "Je aankoop is gelukt!",
    greeting: (f: string, l: string) => `Hallo ${f} ${l},`,
    p1: "Bedankt voor je aankoop van Cairnly. Je kunt verdergaan waar je was gebleven, je assessment staat klaar op het platform.",
    keepSafe:
      '<strong style="color:#122E3B;font-weight:700;">Bewaar deze toegangscode goed.</strong> Het is je back-up: gebruik hem om op elk moment weer in te loggen en verder te gaan met je assessment.',
    backToDashboard:
      'Wil je terug naar je assessment? Ga naar je <a href="https://cairnly.io/dashboard" style="color:#1F8282;text-decoration:underline;font-weight:600;">dashboard</a>, daar kun je een nieuw assessment starten of verdergaan met een bestaand assessment.',
    fineprint:
      "Je toegangscode is vanaf vandaag een jaar geldig. Heb je vragen? Neem dan contact op met ons supportteam.",
  },
} as const;

// Function to send the access code email
async function sendAccessCodeEmail(email: string, firstName: string, lastName: string, accessCode: string, lang: Lang) {
  try {
    const c = ACCESS_CODE_COPY[lang];
    const bodyHtml = bodyRow(
      h1(c.heading) +
      paragraph(c.greeting(firstName, lastName)) +
      paragraph(c.p1) +
      paragraph(c.keepSafe) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px 0;">
  <tr><td style="background-color:#122E3B;background-image:linear-gradient(135deg,#122E3B 0%,#213F4F 100%);border-radius:14px;padding:28px 24px;text-align:center;">
    <p class="code-mob" style="margin:0;color:#FFFFFF;font-size:26px;font-weight:700;letter-spacing:5px;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;">${accessCode}</p>
  </td></tr>
</table>` +
      paragraph(c.backToDashboard, { mb: 0 }) +
      fineprint(c.fineprint),
    );

    const html = renderEmail({
      title: c.subject,
      preheader: c.preheader,
      bodyHtml,
    });

    const { error } = await resend.emails.send({
      from: "Cairnly <no-reply@cairnly.io>",
      to: [email],
      subject: c.subject,
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

// Referral payout tiers — % of the referrer's net amount paid, keyed by
// referral sequence position. The unlock ladder is 6 steps per converted
// referral:
//   1 → Find Job Openings   (tool, no payout)
//   2 → Tailor Your Resume  (tool, no payout)
//   3 → Tailor Cover Letters(tool, no payout)
//   4 → 25% refund
//   5 → 25% refund
//   6 → 50% refund  (cumulative 100% — purchase fully refunded)
//   7+ → nothing (cap reached)
// So tools come first (1–3), then the money comes back (4–6). Refunds are
// issued via Stripe 14 days after the triggering purchase.
const REFERRAL_PAYOUT_TIERS: Record<number, number> = {
  4: 25,
  5: 25,
  6: 50,
};

// Schedule a referral payout for a successful referral. Best-effort: any
// failure here is logged but never breaks the purchase flow. The actual
// refund is issued later by the process-referral-payouts cron, 14 days after
// the referred purchase (so we're past Stripe's chargeback window).
//
// Skip-without-error cases (these are NOT failures, just "nothing to pay"):
//   - Referrals 1–3 (tool unlocks)                -> no payout tier, skip
//   - Referrer has no completed purchase recorded -> nothing to refund TO
//   - Referrer paid 0 (100%-off promo)            -> payout would be 0
//   - Sequence number > 6                          -> cap reached
async function queueReferralPayout(args: {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  referralId: string;
  referrerUserId: string;
  referrerEmail: string;
  fallbackCurrency: string;
}): Promise<void> {
  const { supabase, referralId, referrerUserId, referrerEmail, fallbackCurrency } = args;

  try {
    // Sequence number = total referrals for this user (we just inserted, so
    // this includes the current one). Theoretical race: two near-simultaneous
    // referrals could both see the same count. The UNIQUE constraint on
    // (referrer_user_id, sequence) in the DB catches that — one of the two
    // INSERTs gets a 23505 and we log + skip.
    const { count: totalReferrals, error: countError } = await supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", referrerUserId);

    if (countError || !totalReferrals) {
      console.error("Failed to count referrals for payout:", countError);
      return;
    }

    const sequenceNumber = totalReferrals;
    const tierPct = REFERRAL_PAYOUT_TIERS[sequenceNumber];
    if (!tierPct) {
      // Referrals 1–3 (tool unlocks, no money) or 7+ (cap reached). No payout
      // owed at this sequence position — quietly skip.
      return;
    }

    // Find the referrer's own purchase to read both the payment_intent (the
    // refund destination) and the price_paid (the basis for the % payout).
    // Use ilike for case-insensitive email match — purchases.email casing has
    // historically been inconsistent. Most-recent-with-payment-intent wins.
    const { data: referrerPurchase } = await supabase
      .from("purchases")
      .select("stripe_payment_intent_id, access_code_id, created_at")
      .ilike("email", referrerEmail)
      .not("stripe_payment_intent_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!referrerPurchase?.stripe_payment_intent_id || !referrerPurchase.access_code_id) {
      console.warn(
        "Referrer has no completed purchase with a stored payment_intent — skipping payout",
        { referrerUserId, referrerEmail },
      );
      return;
    }

    const { data: referrerCode } = await supabase
      .from("access_codes")
      .select("price_paid, currency")
      .eq("id", referrerPurchase.access_code_id)
      .maybeSingle();

    const netPaid = Number(referrerCode?.price_paid ?? 0);
    if (!netPaid || netPaid <= 0) {
      console.log(
        "Referrer paid 0 (free / 100%-off promo) — no payout possible",
        { referrerUserId },
      );
      return;
    }

    const payoutAmountCents = Math.round(netPaid * 100 * (tierPct / 100));
    if (payoutAmountCents <= 0) {
      return;
    }

    const currency = referrerCode?.currency || fallbackCurrency;

    // 14-day delay before the cron will issue the refund — keeps us safely
    // past the typical Stripe chargeback window for the *referred* purchase.
    const eligibleAt = new Date();
    eligibleAt.setDate(eligibleAt.getDate() + 14);

    const { error: payoutError } = await supabase
      .from("referral_payouts")
      .insert({
        referral_id: referralId,
        referrer_user_id: referrerUserId,
        referrer_payment_intent_id: referrerPurchase.stripe_payment_intent_id,
        referral_sequence_number: sequenceNumber,
        payout_amount_cents: payoutAmountCents,
        payout_pct: tierPct,
        currency,
        eligible_at: eligibleAt.toISOString(),
      });

    if (payoutError) {
      // 23505 = unique_violation on (referrer_user_id, sequence_number) —
      // a concurrent referral grabbed the same slot. The winner's payout is
      // valid; ours is a no-op duplicate, log and move on.
      if (payoutError.code === "23505") {
        console.warn("Payout slot already taken (concurrent referral race) — skipping", {
          referrerUserId,
          sequenceNumber,
        });
      } else {
        console.error("Failed to insert referral payout:", payoutError);
      }
    } else {
      console.log("Referral payout queued", {
        referrerUserId,
        sequenceNumber,
        tierPct,
        payoutAmountCents,
        currency,
        eligibleAt: eligibleAt.toISOString(),
      });
    }
  } catch (e) {
    console.error("Payout queueing error (non-fatal):", e);
  }
}

// "A friend joined Cairnly through your code" — sent to the referrer the
// moment a new conversion crosses the 1, 2, or 3 friend threshold (those
// are the conversions that actually unlock a tool). After 3, no email —
// nothing new to celebrate.
// Tool LABELS stay in English in both languages on purpose: the dashboard
// referral toolkit (useReferralStatus.ts) still renders these names in English
// even for Dutch users, so the email must match what they actually click.
// Only the descriptive `toolBody` and the CTA label are localized.
const REFERRAL_UNLOCK_TIERS: Array<{
  count: number;
  toolLabel: string;
  toolBody: Record<Lang, string>; // sentence describing what it does
  next: { count: number; toolLabel: string } | null;
  cta: { label: Record<Lang, string>; href: string };
}> = [
  {
    count: 1,
    toolLabel: "Find Open Roles",
    toolBody: {
      en: "live job openings matched to your top career recommendations",
      nl: "live vacatures die passen bij je beste loopbaanaanbevelingen",
    },
    next: { count: 2, toolLabel: "Tailor Your Resume" },
    cta: { label: { en: "Find open roles now", nl: "Vind nu vacatures" }, href: "https://cairnly.io/jobs" },
  },
  {
    count: 2,
    toolLabel: "Tailor Your Resume",
    toolBody: {
      en: "an AI rewrite of your uploaded resume tailored to specific jobs you want to apply for",
      nl: "een AI-herschrijving van je geüploade cv, op maat gemaakt voor de specifieke vacatures waarop je wilt solliciteren",
    },
    next: { count: 3, toolLabel: "Tailor Cover Letters" },
    cta: { label: { en: "See your unlocked tool", nl: "Bekijk je ontgrendelde tool" }, href: "https://cairnly.io/dashboard" },
  },
  {
    count: 3,
    toolLabel: "Tailor Cover Letters",
    toolBody: {
      en: "cover letters customised to each job on your shortlist",
      nl: "motivatiebrieven op maat voor elke vacature op je shortlist",
    },
    next: null,
    cta: { label: { en: "See your unlocked tool", nl: "Bekijk je ontgrendelde tool" }, href: "https://cairnly.io/dashboard" },
  },
];

// Prose around the unlock tiers. Tool names interpolated into these strings
// stay in English (see note on REFERRAL_UNLOCK_TIERS). No em-dashes in either
// language per the glossary.
const UNLOCK_COPY = {
  en: {
    subject: (tool: string) => `You just unlocked ${tool} for free`,
    preheader: (tool: string) => `${tool} is now live on your dashboard.`,
    nameFallback: "there",
    inviteeFallback: "someone",
    heading: "A friend joined Cairnly through your code",
    intro: (first: string, invitee: string) =>
      `Hey ${first}, ${invitee} just used your code and took their first step toward better career clarity.`,
    unlock: (count: number, tool: string, body: string) =>
      `<strong style="color:#122E3B;font-weight:700;">${count} of 3 friends joined.</strong> ${tool} is now live on your dashboard: ${body}.`,
    next: (nextTool: string) =>
      `Invite one more friend and <strong style="color:#122E3B;font-weight:700;">${nextTool}</strong> opens up too.`,
    allDone: `That's all three tools unlocked. Thank you for helping three people find some clarity, it genuinely matters.`,
    incentive: `Each invite helps someone find clarity, and earns you a tool for your own job hunt.`,
    codeLabel: "YOUR REFERRAL CODE",
    yourCode: "Your code:",
    shareAgain: "Share it again",
    shareAgainOnly: "Share your code again →",
    fineprint: "You're receiving this because someone just joined Cairnly using your referral code.",
  },
  nl: {
    subject: (tool: string) => `Je hebt zojuist ${tool} gratis ontgrendeld`,
    preheader: (tool: string) => `${tool} staat nu live op je dashboard.`,
    nameFallback: "daar",
    inviteeFallback: "iemand",
    heading: "Een vriend is via jouw code lid geworden van Cairnly",
    intro: (first: string, invitee: string) =>
      `Hoi ${first}, ${invitee} heeft zojuist jouw code gebruikt en de eerste stap gezet naar meer loopbaanduidelijkheid.`,
    unlock: (count: number, tool: string, body: string) =>
      `<strong style="color:#122E3B;font-weight:700;">${count} van de 3 vrienden aangemeld.</strong> ${tool} staat nu live op je dashboard: ${body}.`,
    next: (nextTool: string) =>
      `Nodig nog één vriend uit en ook <strong style="color:#122E3B;font-weight:700;">${nextTool}</strong> komt beschikbaar.`,
    allDone: `Daarmee heb je alle drie de tools ontgrendeld. Bedankt dat je drie mensen hebt geholpen aan wat meer duidelijkheid, dat betekent echt veel.`,
    incentive: `Elke uitnodiging helpt iemand aan meer duidelijkheid, en levert jou een tool op voor je eigen zoektocht naar werk.`,
    codeLabel: "JOUW REFERRALCODE",
    yourCode: "Jouw code:",
    shareAgain: "Deel hem opnieuw",
    shareAgainOnly: "Deel je code opnieuw →",
    fineprint: "Je ontvangt deze e-mail omdat iemand zich zojuist bij Cairnly heeft aangemeld met jouw referralcode.",
  },
} as const;

async function sendReferralUnlockEmail(args: {
  referrerEmail: string;
  referrerFirstName: string | null;
  referrerCode: string | null;
  inviteeFirstName: string | null;
  // deno-lint-ignore no-explicit-any
  supabase: any;
  referrerUserId: string;
  lang: Lang;
}): Promise<void> {
  const { referrerEmail, referrerFirstName, referrerCode, inviteeFirstName, supabase, referrerUserId, lang } = args;

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

  const t = UNLOCK_COPY[lang];
  const firstName = referrerFirstName?.trim() || t.nameFallback;
  const inviteeName = inviteeFirstName?.trim() || t.inviteeFallback;
  const subject = t.subject(tier.toolLabel);
  const codeBlock = referrerCode
    ? `<p style="margin:0;color:#122E3B;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;">${t.yourCode} <strong style="font-family:'Poppins','Inter',Arial,sans-serif;letter-spacing:1.5px;color:#1F8282;font-weight:700;">${escapeHtml(referrerCode)}</strong> &nbsp;·&nbsp; <a href="https://cairnly.io/dashboard?share=1" style="color:#1F8282;text-decoration:underline;font-weight:600;">${t.shareAgain}</a></p>`
    : `<p style="margin:0;color:#122E3B;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;"><a href="https://cairnly.io/dashboard?share=1" style="color:#1F8282;text-decoration:underline;font-weight:600;">${t.shareAgainOnly}</a></p>`;

  const nextLine = tier.next
    ? paragraph(t.next(escapeHtml(tier.next.toolLabel)))
    : paragraph(t.allDone);

  const bodyHtml =
    bodyRow(
      h1(t.heading) +
        paragraph(t.intro(escapeHtml(firstName), escapeHtml(inviteeName))) +
        paragraph(t.unlock(tier.count, escapeHtml(tier.toolLabel), tier.toolBody[lang])) +
        nextLine +
        paragraph(t.incentive) +
        callout(t.codeLabel, codeBlock),
    ) +
    ctaRow(tier.cta.label[lang], tier.cta.href) +
    `<tr><td style="padding:0 48px 24px;background-color:#ECE4D2;" class="px-mob">${fineprint(t.fineprint)}</td></tr>`;

  const html = renderEmail({
    title: subject,
    preheader: t.preheader(tier.toolLabel),
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
    // Buyer's language for transactional emails, from the Stripe session metadata
    // (set in create-checkout from the frontend's cairnly_language). Default 'en'.
    const buyerLang: Lang = session.metadata?.preferred_language === "nl" ? "nl" : "en";
    const country = session.metadata?.country || "Unknown";

    // Language for the buyer's receipt email. Primary signal is the UI language
    // threaded through create-checkout metadata. Fallback for sessions created
    // before this field existed (or webhook replays): infer from country, else
    // default English.
    const buyerLang: Lang = pickLang(
      session.metadata?.preferred_language || (country === "Netherlands" ? "nl" : "en"),
    );

    // Capture the Stripe payment_intent for this purchase. Required later
    // for the referral-payout system (refunds are issued against a
    // payment_intent). On a Checkout Session in mode='payment' this is a
    // string ID; defensive about other shapes.
    const stripePaymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

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
        stripe_payment_intent_id: stripePaymentIntentId,
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
          .select("email, first_name, referral_code, preferred_language")
          .eq("id", referrerUserId)
          .maybeSingle();

        const isSelfReferral =
          !!referrerProfile?.email &&
          !!customerEmail &&
          referrerProfile.email.toLowerCase() === customerEmail.toLowerCase();

        if (isSelfReferral) {
          console.warn("Self-referral blocked", { referrerUserId });
        } else {
          const { data: newReferral, error: referralError } = await supabase
            .from("referrals")
            .insert({
              referrer_user_id: referrerUserId,
              invitee_email: customerEmail,
              stripe_session_id: session.id,
              promotion_code_used: referralPromoCode,
              amount_paid: amountTotal,
              currency: currency,
            })
            .select("id")
            .maybeSingle();
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
              // The referrer is a different person from the buyer — their email
              // follows THEIR saved language preference, not the buyer's.
              lang: pickLang(referrerProfile.preferred_language),
            }).catch((e) => console.error("Referral unlock email failed (non-fatal):", e));

            // Queue the cashback payout (25/25/50% of the referrer's net
            // paid, refunded 14 days from now via Stripe). Strictly
            // additive — any failure here logs and moves on, never breaks
            // the purchase response.
            if (newReferral?.id) {
              await queueReferralPayout({
                supabase,
                referralId: newReferral.id,
                referrerUserId,
                referrerEmail: referrerProfile.email,
                fallbackCurrency: currency,
              }).catch((e) => console.error("Payout queueing failed (non-fatal):", e));
            }
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
      const emailSent = await sendAccessCodeEmail(customerEmail, firstName, lastName, accessCode, buyerLang);
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
