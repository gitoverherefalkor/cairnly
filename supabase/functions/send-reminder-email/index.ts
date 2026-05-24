import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import {
  renderEmail,
  bodyRow,
  ctaRow,
  h1,
  paragraph,
  callout,
  bullet,
} from "../_shared/email-chrome.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const BASE_URL = "https://cairnly.io";

// All 11 chat sections in order (mirrors ReportSidebar.tsx)
const ALL_SECTIONS = [
  "Executive Summary",
  "Your Approach",
  "Your Strengths",
  "Development Areas",
  "Career Values",
  "Primary Career Match",
  "Second Career Match",
  "Third Career Match",
  "Runner-up Careers",
  "Outside the Box",
  "Dream Job Assessment",
];

// ──────────────────────────────────────────────────────────────────────────────
// Email templates — all use renderEmail() from _shared/email-chrome.ts
// ──────────────────────────────────────────────────────────────────────────────

// ── Template 1: Signed up, never started ─────────────────────────────────────

function signupNoStartEmail(firstName: string): { subject: string; html: string } {
  const bodyHtml =
    bodyRow(
      h1('Ready to discover your ideal career path?') +
      paragraph(`Hi ${firstName},`) +
      paragraph("Your personalized career assessment is set up and ready for you. It takes about 15-20 minutes, and you'll unlock insights most people never get about their career potential.") +
      callout("Here's what you'll discover", `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${bullet('Your unique personality profile and working style')}
          ${bullet('Your core strengths and development areas')}
          ${bullet('5+ career paths tailored to your personality and goals')}
          ${bullet('A dream job analysis based on your aspirations')}
        </table>
      `)
    ) +
    ctaRow('Start Your Assessment', `${BASE_URL}/dashboard`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph('The assessment is saved as you go — you can pause and come back anytime.', { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: `Your career assessment is waiting, ${firstName}`,
    html: renderEmail({
      title: 'Your career assessment is waiting',
      preheader: 'Your personalized career assessment is set up and ready.',
      bodyHtml,
      footer: 'reminder',
    }),
  };
}

// ── Template 2: Survey abandoned ─────────────────────────────────────────────

function surveyAbandonedEmail(
  firstName: string,
  lastSection: number | null,
  totalSections: number | null,
): { subject: string; html: string } {
  const section = lastSection ?? 0;
  const total = totalSections ?? 7;
  const percentDone = Math.round(((section + 1) / total) * 100);

  const bodyHtml =
    bodyRow(
      h1(`You're ${percentDone}% through your assessment`) +
      paragraph(`Hi ${firstName},`) +
      paragraph("You've already made great progress on your career assessment — all your answers are saved and waiting for you.") +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 28px 0;">
  <tr>
    <td style="font-size:12px;color:#6B7480;font-family:'Poppins',Arial,sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Section ${section + 1} of ${total}</td>
    <td style="font-size:14px;font-weight:700;color:#B5860B;text-align:right;font-family:'Poppins',Arial,sans-serif;letter-spacing:0.2px;">${percentDone}%</td>
  </tr>
  <tr><td colspan="2" style="padding-top:10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#DCCFAE;border-radius:8px;height:12px;">
      <tr><td style="background-color:#DCCFAE;border-radius:8px;height:12px;font-size:0;line-height:0;">
        <table role="presentation" width="${percentDone}%" cellpadding="0" cellspacing="0" border="0" style="background-color:#27A1A1;background-image:linear-gradient(90deg,#27A1A1 0%,#EFBE48 100%);border-radius:8px;">
          <tr><td style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>` +
      paragraph('Once you finish, our AI will generate your personalized career report with tailored recommendations — it only takes a few more minutes.')
    ) +
    ctaRow('Continue Your Assessment', `${BASE_URL}/assessment`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph("Your progress is saved — you'll pick up right where you stopped.", { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: `Pick up where you left off, ${firstName}`,
    html: renderEmail({
      title: 'Pick up where you left off',
      preheader: 'Your progress is saved. A few more minutes unlocks your full report.',
      bodyHtml,
      footer: 'reminder',
    }),
  };
}

// ── Template 3: Chat not completed ───────────────────────────────────────────

function chatNotCompletedEmail(
  firstName: string,
  lastSectionIndex: number,
): { subject: string; html: string } {
  const sectionsCompleted = Math.max(0, lastSectionIndex + 1);
  const totalSections = ALL_SECTIONS.length;
  const remainingSections = ALL_SECTIONS.slice(sectionsCompleted);

  // Build the "what you're missing" list (max 4 items to keep email short)
  const previewSections = remainingSections.slice(0, 4);
  const moreCount = remainingSections.length - previewSections.length;

  const sectionListHtml = previewSections
    .map((s) => `<tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;"><span style="color:#D4A024;margin-right:10px;font-weight:700;">&#10148;</span>${s}</td></tr>`)
    .join('');

  const moreHtml =
    moreCount > 0
      ? `<tr><td style="padding:5px 0;color:#6B7480;font-size:14.5px;line-height:1.55;font-style:italic;font-family:'Inter',Arial,sans-serif;">...and ${moreCount} more insight${moreCount > 1 ? 's' : ''}</td></tr>`
      : '';

  const remainingBlock = remainingSections.length > 0
    ? callout("Insights you haven't explored yet", `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${sectionListHtml}
          ${moreHtml}
        </table>
      `)
    : '';

  const bodyHtml =
    bodyRow(
      h1(`You've unlocked ${sectionsCompleted} of ${totalSections} career insights`) +
      paragraph(`Hi ${firstName},`) +
      paragraph("Your AI career coach has more to share with you. You've explored some great insights so far, but there's still more waiting — including personalized career matches and your dream job analysis.") +
      remainingBlock
    ) +
    ctaRow('Continue Your Session', `${BASE_URL}/chat`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph('Your conversation is saved — your coach remembers where you left off.', { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: `Your career insights are waiting, ${firstName}`,
    html: renderEmail({
      title: 'Your career insights are waiting',
      preheader: 'Your AI career coach has more to share with you.',
      bodyHtml,
      footer: 'reminder',
    }),
  };
}

// ── Template 4: Chat completed but hasn't visited dashboard/report ──────────

function reportNotViewedEmail(firstName: string): { subject: string; html: string } {
  const bodyHtml =
    bodyRow(
      h1('Your personalized career report is waiting') +
      paragraph(`Hi ${firstName},`) +
      paragraph('Great news — your AI career session is complete, and your full report has been generated. It combines everything from your assessment with the insights from your coaching session into one comprehensive overview.') +
      callout("What's in your report", `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.6;font-family:'Inter',Arial,sans-serif;font-weight:500;"><strong style="color:#122E3B;font-weight:700;">Executive Summary</strong> &mdash; your personality, strengths, and top career matches at a glance</td></tr>
          <tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.6;font-family:'Inter',Arial,sans-serif;font-weight:500;"><strong style="color:#122E3B;font-weight:700;">Detailed Career Matches</strong> &mdash; with your coaching feedback incorporated</td></tr>
          <tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.6;font-family:'Inter',Arial,sans-serif;font-weight:500;"><strong style="color:#122E3B;font-weight:700;">Dream Job Analysis</strong> &mdash; how your aspirations align with your profile</td></tr>
          <tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.6;font-family:'Inter',Arial,sans-serif;font-weight:500;"><strong style="color:#122E3B;font-weight:700;">Actionable Next Steps</strong> &mdash; tailored to your goals</td></tr>
        </table>
      `) +
      paragraph('Your report is saved permanently and you can return to it anytime. We keep improving the platform, so check back regularly to get the most out of your assessment.')
    ) +
    ctaRow('View Your Report', `${BASE_URL}/dashboard`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph('Your report is permanently saved in your dashboard — access it anytime.', { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: `Your full career report is ready, ${firstName}`,
    html: renderEmail({
      title: 'Your full career report is ready',
      preheader: 'Your full report is saved and waiting in your dashboard.',
      bodyHtml,
      footer: 'reminder',
    }),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Edge Function handler
// ──────────────────────────────────────────────────────────────────────────────

interface ReminderUser {
  user_id: string;
  email: string;
  first_name: string;
  survey_last_section?: number | null;
  survey_total_sections?: number | null;
  chat_last_section_index?: number | null;
}

interface ReminderPayload {
  type: "signup_no_start" | "survey_abandoned" | "chat_not_completed" | "report_not_viewed";
  users: ReminderUser[];
}

serve(async (req) => {
  // This function is called by pg_cron via pg_net — no CORS needed
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth: verify_jwt = false in config, called only by pg_cron via pg_net.
  // The Supabase API gateway handles API key validation.

  try {
    const payload: ReminderPayload = await req.json();
    const { type, users } = payload;

    if (!type || !users || !Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: need type and users array" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log(`Processing ${users.length} ${type} reminder(s)`);

    const results = [];

    for (const user of users) {
      let emailContent: { subject: string; html: string };

      switch (type) {
        case "signup_no_start":
          emailContent = signupNoStartEmail(user.first_name);
          break;
        case "survey_abandoned":
          emailContent = surveyAbandonedEmail(
            user.first_name,
            user.survey_last_section ?? null,
            user.survey_total_sections ?? null,
          );
          break;
        case "chat_not_completed":
          emailContent = chatNotCompletedEmail(
            user.first_name,
            user.chat_last_section_index ?? -1,
          );
          break;
        case "report_not_viewed":
          emailContent = reportNotViewedEmail(user.first_name);
          break;
        default:
          console.error(`Unknown reminder type: ${type}`);
          continue;
      }

      try {
        const { data, error } = await resend.emails.send({
          from: "Cairnly <no-reply@cairnly.io>",
          to: [user.email],
          subject: emailContent.subject,
          html: emailContent.html,
        });

        if (error) {
          console.error(`Failed to send ${type} email to ${user.email}:`, error);
          results.push({ email: user.email, success: false, error: error.message });
        } else {
          console.log(`Sent ${type} reminder to ${user.email}`);
          results.push({ email: user.email, success: true, id: data?.id });
        }
      } catch (emailError) {
        console.error(`Error sending to ${user.email}:`, emailError);
        results.push({ email: user.email, success: false, error: String(emailError) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        type,
        sent: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in send-reminder-email:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
