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

// ─── Email body builders ──────────────────────────────────────────────────

function confirmationEmailBody(firstName: string, confirmationUrl: string): string {
  return bodyRow(
    h1(`Welcome to Cairnly, ${firstName}!`) +
    paragraph("Thank you for creating your account. You're just one step away from starting your personalized career discovery journey.") +
    paragraph("Please confirm your email address by clicking the button below:")
  ) +
  ctaRow("Confirm Your Email Address", confirmationUrl) +
  `<tr><td style="padding:0 48px 8px;background-color:#ECE4D2;" class="px-mob">
    ${paragraph("If the button doesn't work, copy and paste this link into your browser:", { size: 13, color: "#6B7480", mb: 8 })}
    <p style="margin:0;padding:12px 14px;background-color:#F6EFD8;border:1px solid #DCCFAE;border-radius:8px;color:#1F8282;font-size:12px;line-height:1.5;word-break:break-all;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;">${confirmationUrl}</p>
  </td></tr>
  <tr><td style="padding:32px 48px 8px;background-color:#ECE4D2;" class="px-mob">
    ${callout("What's Next?", `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${bullet("Confirm your email address")}
        ${bullet("Complete your personalized career assessment")}
        ${bullet("Receive your detailed career insights report")}
        ${bullet("Discover career opportunities aligned with your strengths")}
      </table>
    `)}
    ${fineprint("This confirmation link will expire in 24 hours for security reasons. If you didn't create a Cairnly account, you can safely ignore this email.")}
  </td></tr>
  <tr><td style="height:20px;font-size:0;line-height:0;background-color:#ECE4D2;">&nbsp;</td></tr>`;
}

function passwordResetEmailBody(firstName: string, confirmationUrl: string): string {
  return bodyRow(
    h1("Password Reset Request") +
    paragraph(`Hi ${firstName},`) +
    paragraph("We received a request to reset your Cairnly password. Click the button below to create a new password:")
  ) +
  ctaRow("Reset Your Password", confirmationUrl) +
  `<tr><td style="padding:0 48px 8px;background-color:#ECE4D2;" class="px-mob">
    ${paragraph("If the button doesn't work, copy and paste this link into your browser:", { size: 13, color: "#6B7480", mb: 8 })}
    <p style="margin:0;padding:12px 14px;background-color:#F6EFD8;border:1px solid #DCCFAE;border-radius:8px;color:#1F8282;font-size:12px;line-height:1.5;word-break:break-all;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;">${confirmationUrl}</p>
    ${fineprint("This password reset link will expire in 24 hours for security reasons. If you didn't request a password reset, you can safely ignore this email.")}
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

    const html = isPasswordReset
      ? renderEmail({
          title: "Reset Your Cairnly Password",
          preheader: "Use this secure link to choose a new password.",
          bodyHtml: passwordResetEmailBody(firstName, confirmationUrl),
        })
      : renderEmail({
          title: "Confirm Your Cairnly Account",
          preheader: "Please confirm your email address to activate your account.",
          bodyHtml: confirmationEmailBody(firstName, confirmationUrl),
        });

    const { error } = await resend.emails.send({
      from: "Cairnly <no-reply@cairnly.io>",
      to: [user.email],
      subject: isPasswordReset ? "Reset Your Cairnly Password" : "Confirm Your Cairnly Account",
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
