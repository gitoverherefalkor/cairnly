import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
  bullet,
} from "../_shared/email-chrome.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// ─── Localized copy ─────────────────────────────────────────────────────────
// English is the source. Dutch follows the glossary tone (casual je-form, no
// em-dashes, brand terms in English). See LOCALIZATION_PLAYBOOK.md.
type Lang = "en" | "nl";

const COPY = {
  en: {
    confirm: {
      subject: "Confirm Your Cairnly Account",
      title: "Confirm Your Cairnly Account",
      preheader: "Please confirm your email address to activate your account.",
      heading: (n: string) => `Welcome to Cairnly, ${n}!`,
      p1: "Thank you for creating your account. You're just one step away from starting your personalized career discovery journey.",
      p2: "Please confirm your email address by clicking the button below:",
      cta: "Confirm Your Email Address",
      linkHint: "If the button doesn't work, copy and paste this link into your browser:",
      whatsNext: "What's Next?",
      bullets: [
        "Confirm your email address",
        "Complete your personalized career assessment",
        "Receive your detailed career insights report",
        "Discover career opportunities aligned with your strengths",
      ],
      fineprint: "This confirmation link will expire in 24 hours for security reasons. If you didn't create a Cairnly account, you can safely ignore this email.",
    },
    reset: {
      subject: "Reset Your Cairnly Password",
      title: "Reset Your Cairnly Password",
      preheader: "Use this secure link to choose a new password.",
      heading: "Password Reset Request",
      greeting: (n: string) => `Hi ${n},`,
      p2: "We received a request to reset your Cairnly password. Click the button below to create a new password:",
      cta: "Reset Your Password",
      linkHint: "If the button doesn't work, copy and paste this link into your browser:",
      fineprint: "This password reset link will expire in 24 hours for security reasons. If you didn't request a password reset, you can safely ignore this email.",
    },
  },
  nl: {
    confirm: {
      subject: "Bevestig je Cairnly-account",
      title: "Bevestig je Cairnly-account",
      preheader: "Bevestig je e-mailadres om je account te activeren.",
      heading: (n: string) => `Welkom bij Cairnly, ${n}!`,
      p1: "Bedankt voor het aanmaken van je account. Je bent nog maar één stap verwijderd van je persoonlijke loopbaanontdekking.",
      p2: "Bevestig je e-mailadres door op de knop hieronder te klikken:",
      cta: "Bevestig je e-mailadres",
      linkHint: "Werkt de knop niet? Kopieer en plak deze link in je browser:",
      whatsNext: "Wat nu?",
      bullets: [
        "Bevestig je e-mailadres",
        "Vul je persoonlijke loopbaanassessment in",
        "Ontvang je uitgebreide loopbaanrapport",
        "Ontdek loopbaankansen die passen bij je sterke punten",
      ],
      fineprint: "Deze bevestigingslink verloopt over 24 uur om veiligheidsredenen. Heb je geen Cairnly-account aangemaakt? Dan kun je deze e-mail negeren.",
    },
    reset: {
      subject: "Stel je Cairnly-wachtwoord opnieuw in",
      title: "Stel je Cairnly-wachtwoord opnieuw in",
      preheader: "Gebruik deze beveiligde link om een nieuw wachtwoord te kiezen.",
      heading: "Wachtwoord opnieuw instellen",
      greeting: (n: string) => `Hoi ${n},`,
      p2: "We hebben een verzoek ontvangen om je Cairnly-wachtwoord opnieuw in te stellen. Klik op de knop hieronder om een nieuw wachtwoord te kiezen:",
      cta: "Stel je wachtwoord opnieuw in",
      linkHint: "Werkt de knop niet? Kopieer en plak deze link in je browser:",
      fineprint: "Deze link verloopt over 24 uur om veiligheidsredenen. Heb je geen wachtwoordreset aangevraagd? Dan kun je deze e-mail negeren.",
    },
  },
} as const;

function pickLang(user: any): Lang {
  const l = user?.user_metadata?.preferred_language || user?.raw_user_meta_data?.preferred_language || "en";
  return l === "nl" ? "nl" : "en";
}

const linkBlock = (url: string) =>
  `<p style="margin:0;padding:12px 14px;background-color:#F6EFD8;border:1px solid #DCCFAE;border-radius:8px;color:#1F8282;font-size:12px;line-height:1.5;word-break:break-all;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;">${url}</p>`;

// ─── Email body builders ──────────────────────────────────────────────────

function confirmationEmailBody(firstName: string, confirmationUrl: string, c: typeof COPY[Lang]["confirm"]): string {
  return bodyRow(
    h1(c.heading(firstName)) +
    paragraph(c.p1) +
    paragraph(c.p2)
  ) +
  ctaRow(c.cta, confirmationUrl) +
  `<tr><td style="padding:0 48px 8px;background-color:#ECE4D2;" class="px-mob">
    ${paragraph(c.linkHint, { size: 13, color: "#6B7480", mb: 8 })}
    ${linkBlock(confirmationUrl)}
  </td></tr>
  <tr><td style="padding:32px 48px 8px;background-color:#ECE4D2;" class="px-mob">
    ${callout(c.whatsNext, `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${c.bullets.map((b) => bullet(b)).join("")}
      </table>
    `)}
    ${fineprint(c.fineprint)}
  </td></tr>
  <tr><td style="height:20px;font-size:0;line-height:0;background-color:#ECE4D2;">&nbsp;</td></tr>`;
}

function passwordResetEmailBody(firstName: string, confirmationUrl: string, c: typeof COPY[Lang]["reset"]): string {
  return bodyRow(
    h1(c.heading) +
    paragraph(c.greeting(firstName)) +
    paragraph(c.p2)
  ) +
  ctaRow(c.cta, confirmationUrl) +
  `<tr><td style="padding:0 48px 8px;background-color:#ECE4D2;" class="px-mob">
    ${paragraph(c.linkHint, { size: 13, color: "#6B7480", mb: 8 })}
    ${linkBlock(confirmationUrl)}
    ${fineprint(c.fineprint)}
  </td></tr>
  <tr><td style="height:24px;font-size:0;line-height:0;background-color:#ECE4D2;">&nbsp;</td></tr>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  try {
    const payload = await req.text();

    // Parse the payload - it could be from the webhook or direct call
    let webhookData;
    try {
      webhookData = JSON.parse(payload);
    } catch (e) {
      console.error("Failed to parse payload as JSON:", e);
      return errorResponse("Invalid JSON payload", 400, corsHeaders);
    }

    // Handle different payload structures
    let user, emailData;

    if (webhookData.user) {
      user = webhookData.user;
      emailData = webhookData.email_data;
    } else if (webhookData.record) {
      user = webhookData.record;
      emailData = webhookData.email_data;
    } else {
      user = webhookData;
      emailData = webhookData.email_data || {};
    }

    if (!user || !user.email) {
      console.error("No user email found in payload");
      return errorResponse("No user email found", 400, corsHeaders);
    }

    const firstName = user.user_metadata?.first_name || user.raw_user_meta_data?.first_name || "there";

    // Build confirmation URL - handle different possible token formats
    let confirmationUrl;
    const emailActionType = emailData?.email_action_type || 'signup';

    if (emailData && emailData.token_hash) {
      const redirectTo = emailData.redirect_to || "https://cairnly.io/dashboard";

      // Extract the origin from redirect_to to determine the correct base URL
      let baseUrl;
      try {
        const redirectUrl = new URL(redirectTo);
        baseUrl = redirectUrl.origin;
      } catch {
        baseUrl = "https://cairnly.io";
      }

      confirmationUrl = `${baseUrl}/auth/confirm?token=${emailData.token_hash}&type=${emailActionType}&redirect_to=${encodeURIComponent(redirectTo)}`;
    } else {
      confirmationUrl = "https://cairnly.io/auth";
    }

    // Check if this is a password reset email
    const isPasswordReset = emailActionType === 'recovery';

    // Pick language from the user's saved preference (set at signup). Default 'en'.
    const lang = pickLang(user);

    const html = isPasswordReset
      ? renderEmail({
          title: COPY[lang].reset.title,
          preheader: COPY[lang].reset.preheader,
          bodyHtml: passwordResetEmailBody(firstName, confirmationUrl, COPY[lang].reset),
        })
      : renderEmail({
          title: COPY[lang].confirm.title,
          preheader: COPY[lang].confirm.preheader,
          bodyHtml: confirmationEmailBody(firstName, confirmationUrl, COPY[lang].confirm),
        });

    const { error } = await resend.emails.send({
      from: "Cairnly <no-reply@cairnly.io>",
      to: [user.email],
      subject: isPasswordReset ? COPY[lang].reset.subject : COPY[lang].confirm.subject,
      html,
    });

    if (error) {
      console.error("Email sending error:", error);
      return errorResponse("Failed to send confirmation email", 500, corsHeaders);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Confirmation email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-confirmation-email function:", error);
    return errorResponse("Failed to send email. Please try again.", 500, corsHeaders);
  }
});
