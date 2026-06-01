import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

type Lang = "en" | "nl";

// All 11 chat sections in order (mirrors ReportSidebar.tsx). Section names are
// display-only in the reminder email, so the Dutch list is purely cosmetic.
const ALL_SECTIONS: Record<Lang, string[]> = {
  en: [
    "Executive Summary", "Your Approach", "Your Strengths", "Development Areas",
    "Career Values", "Primary Career Match", "Second Career Match", "Third Career Match",
    "Runner-up Careers", "Outside the Box", "Dream Job Assessment",
  ],
  nl: [
    "Samenvatting", "Jouw werkaanpak", "Jouw sterke punten", "Ontwikkelpunten",
    "Loopbaanwaarden", "Eerste loopbaanmatch", "Tweede loopbaanmatch", "Derde loopbaanmatch",
    "Runner-up loopbanen", "Outside-the-box", "Droombaan-analyse",
  ],
};

// ──────────────────────────────────────────────────────────────────────────────
// Localized copy. English is the source. Dutch follows the glossary tone
// (casual je-form, no em-dashes, brand terms in English). See LOCALIZATION_PLAYBOOK.md.
// ──────────────────────────────────────────────────────────────────────────────

const COPY = {
  en: {
    signupNoStart: {
      subject: (n: string) => `Your career assessment is waiting, ${n}`,
      title: "Your career assessment is waiting",
      preheader: "Your personalized career assessment is set up and ready.",
      h1: "Ready to discover your ideal career path?",
      greeting: (n: string) => `Hi ${n},`,
      p1: "Your personalized career assessment is set up and ready for you. It takes about 15-20 minutes, and you'll unlock insights most people never get about their career potential.",
      calloutTitle: "Here's what you'll discover",
      bullets: [
        "Your unique personality profile and working style",
        "Your core strengths and development areas",
        "5+ career paths tailored to your personality and goals",
        "A dream job analysis based on your aspirations",
      ],
      cta: "Start Your Assessment",
      footnote: "The assessment is saved as you go, you can pause and come back anytime.",
    },
    surveyAbandoned: {
      subject: (n: string) => `Pick up where you left off, ${n}`,
      title: "Pick up where you left off",
      preheader: "Your progress is saved. A few more minutes unlocks your full report.",
      h1: (pct: number) => `You're ${pct}% through your assessment`,
      greeting: (n: string) => `Hi ${n},`,
      p1: "You've already made great progress on your career assessment, all your answers are saved and waiting for you.",
      sectionLabel: (s: number, t: number) => `Section ${s} of ${t}`,
      p2: "Once you finish, our AI will generate your personalized career report with tailored recommendations, it only takes a few more minutes.",
      cta: "Continue Your Assessment",
      footnote: "Your progress is saved, you'll pick up right where you stopped.",
    },
    chatNotCompleted: {
      subject: (n: string) => `Your career insights are waiting, ${n}`,
      title: "Your career insights are waiting",
      preheader: "Your AI career coach has more to share with you.",
      h1: (done: number, total: number) => `You've unlocked ${done} of ${total} career insights`,
      greeting: (n: string) => `Hi ${n},`,
      p1: "Your AI career coach has more to share with you. You've explored some great insights so far, but there's still more waiting, including personalized career matches and your dream job analysis.",
      calloutTitle: "Insights you haven't explored yet",
      more: (c: number) => `...and ${c} more insight${c > 1 ? "s" : ""}`,
      cta: "Continue Your Session",
      footnote: "Your conversation is saved, your coach remembers where you left off.",
    },
    reportNotViewed: {
      subject: (n: string) => `Your full career report is ready, ${n}`,
      title: "Your full career report is ready",
      preheader: "Your full report is saved and waiting in your dashboard.",
      h1: "Your personalized career report is waiting",
      greeting: (n: string) => `Hi ${n},`,
      p1: "Great news, your AI career session is complete, and your full report has been generated. It combines everything from your assessment with the insights from your coaching session into one comprehensive overview.",
      calloutTitle: "What's in your report",
      items: [
        ["Executive Summary", "your personality, strengths, and top career matches at a glance"],
        ["Detailed Career Matches", "with your coaching feedback incorporated"],
        ["Dream Job Analysis", "how your aspirations align with your profile"],
        ["Actionable Next Steps", "tailored to your goals"],
      ] as [string, string][],
      p2: "Your report is saved permanently and you can return to it anytime. We keep improving the platform, so check back regularly to get the most out of your assessment.",
      cta: "View Your Report",
      footnote: "Your report is permanently saved in your dashboard, access it anytime.",
    },
  },
  nl: {
    signupNoStart: {
      subject: (n: string) => `Je loopbaanassessment staat klaar, ${n}`,
      title: "Je loopbaanassessment staat klaar",
      preheader: "Je persoonlijke loopbaanassessment is klaargezet en wacht op je.",
      h1: "Klaar om je ideale loopbaan te ontdekken?",
      greeting: (n: string) => `Hoi ${n},`,
      p1: "Je persoonlijke loopbaanassessment staat klaar. Het duurt ongeveer 15-20 minuten, en je krijgt inzichten die de meeste mensen nooit over hun loopbaanpotentieel krijgen.",
      calloutTitle: "Dit ga je ontdekken",
      bullets: [
        "Je unieke persoonlijkheidsprofiel en werkstijl",
        "Je sterke punten en ontwikkelpunten",
        "5+ loopbaanpaden afgestemd op je persoonlijkheid en doelen",
        "Een droombaan-analyse op basis van je ambities",
      ],
      cta: "Start je assessment",
      footnote: "De assessment wordt automatisch opgeslagen, je kunt pauzeren en later verdergaan.",
    },
    surveyAbandoned: {
      subject: (n: string) => `Ga verder waar je gebleven was, ${n}`,
      title: "Ga verder waar je gebleven was",
      preheader: "Je voortgang is opgeslagen. Een paar minuten en je volledige rapport staat klaar.",
      h1: (pct: number) => `Je bent ${pct}% door je assessment`,
      greeting: (n: string) => `Hoi ${n},`,
      p1: "Je hebt al flink wat voortgang geboekt met je assessment, al je antwoorden zijn opgeslagen en wachten op je.",
      sectionLabel: (s: number, t: number) => `Sectie ${s} van ${t}`,
      p2: "Zodra je klaar bent, genereert onze AI je persoonlijke loopbaanrapport met aanbevelingen op maat, het duurt nog maar een paar minuten.",
      cta: "Ga verder met je assessment",
      footnote: "Je voortgang is opgeslagen, je pakt precies op waar je was gebleven.",
    },
    chatNotCompleted: {
      subject: (n: string) => `Je loopbaaninzichten staan klaar, ${n}`,
      title: "Je loopbaaninzichten staan klaar",
      preheader: "Je AI-loopbaancoach heeft nog meer voor je.",
      h1: (done: number, total: number) => `Je hebt ${done} van de ${total} loopbaaninzichten ontgrendeld`,
      greeting: (n: string) => `Hoi ${n},`,
      p1: "Je AI-loopbaancoach heeft nog meer voor je. Je hebt al mooie inzichten verkend, maar er wacht nog meer, waaronder persoonlijke loopbaanmatches en je droombaan-analyse.",
      calloutTitle: "Inzichten die je nog niet hebt verkend",
      more: (c: number) => `...en nog ${c} inzicht${c > 1 ? "en" : ""}`,
      cta: "Ga verder met je sessie",
      footnote: "Je gesprek is opgeslagen, je coach weet nog waar je gebleven was.",
    },
    reportNotViewed: {
      subject: (n: string) => `Je volledige loopbaanrapport is klaar, ${n}`,
      title: "Je volledige loopbaanrapport is klaar",
      preheader: "Je volledige rapport staat klaar in je dashboard.",
      h1: "Je persoonlijke loopbaanrapport staat klaar",
      greeting: (n: string) => `Hoi ${n},`,
      p1: "Goed nieuws, je AI-loopbaansessie is compleet en je volledige rapport is gegenereerd. Het combineert alles uit je assessment met de inzichten uit je coachingsessie tot één compleet overzicht.",
      calloutTitle: "Wat er in je rapport staat",
      items: [
        ["Samenvatting", "je persoonlijkheid, sterke punten en beste loopbaanmatches in één oogopslag"],
        ["Gedetailleerde loopbaanmatches", "met jouw coaching-feedback verwerkt"],
        ["Droombaan-analyse", "hoe je ambities aansluiten bij je profiel"],
        ["Concrete vervolgstappen", "afgestemd op je doelen"],
      ] as [string, string][],
      p2: "Je rapport wordt permanent bewaard en je kunt er altijd naar terugkeren. We blijven het platform verbeteren, dus kom regelmatig terug om er het meeste uit te halen.",
      cta: "Bekijk je rapport",
      footnote: "Je rapport staat permanent in je dashboard, altijd toegankelijk.",
    },
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Email templates — all use renderEmail() from _shared/email-chrome.ts
// ──────────────────────────────────────────────────────────────────────────────

function signupNoStartEmail(firstName: string, lang: Lang): { subject: string; html: string } {
  const c = COPY[lang].signupNoStart;
  const bodyHtml =
    bodyRow(
      h1(c.h1) +
      paragraph(c.greeting(firstName)) +
      paragraph(c.p1) +
      callout(c.calloutTitle, `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${c.bullets.map((b) => bullet(b)).join("")}
        </table>
      `)
    ) +
    ctaRow(c.cta, `${BASE_URL}/dashboard`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph(c.footnote, { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: c.subject(firstName),
    html: renderEmail({ title: c.title, preheader: c.preheader, bodyHtml, footer: 'reminder' }),
  };
}

function surveyAbandonedEmail(
  firstName: string,
  lastSection: number | null,
  totalSections: number | null,
  lang: Lang,
  progress?: { questionsAnswered?: number; totalQuestions?: number } | null,
): { subject: string; html: string } {
  const c = COPY[lang].surveyAbandoned;
  const section = lastSection ?? 0;
  const total = totalSections ?? 7;

  // Prefer the stored question-level progress (same source as the dashboard).
  // Cap at 99% — a "continue where you left off" email must never claim 100%
  // (if every question is answered, the user just needs to submit).
  let percentDone: number;
  if (
    progress &&
    typeof progress.questionsAnswered === "number" &&
    typeof progress.totalQuestions === "number" &&
    progress.totalQuestions > 0
  ) {
    percentDone = Math.min(99, Math.round((progress.questionsAnswered / progress.totalQuestions) * 100));
  } else {
    // Legacy fallback for drafts saved before question-level tracking shipped:
    // a coarse section estimate, capped so it can't show a misleading 100%.
    percentDone = Math.min(95, Math.round(((section + 1) / total) * 100));
  }

  const bodyHtml =
    bodyRow(
      h1(c.h1(percentDone)) +
      paragraph(c.greeting(firstName)) +
      paragraph(c.p1) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 28px 0;">
  <tr>
    <td style="font-size:12px;color:#6B7480;font-family:'Poppins',Arial,sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${c.sectionLabel(section + 1, total)}</td>
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
      paragraph(c.p2)
    ) +
    ctaRow(c.cta, `${BASE_URL}/assessment`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph(c.footnote, { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: c.subject(firstName),
    html: renderEmail({ title: c.title, preheader: c.preheader, bodyHtml, footer: 'reminder' }),
  };
}

function chatNotCompletedEmail(
  firstName: string,
  lastSectionIndex: number,
  lang: Lang,
): { subject: string; html: string } {
  const c = COPY[lang].chatNotCompleted;
  const sections = ALL_SECTIONS[lang];
  const sectionsCompleted = Math.max(0, lastSectionIndex + 1);
  const totalSections = sections.length;
  const remainingSections = sections.slice(sectionsCompleted);

  const previewSections = remainingSections.slice(0, 4);
  const moreCount = remainingSections.length - previewSections.length;

  const sectionListHtml = previewSections
    .map((s) => `<tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;"><span style="color:#D4A024;margin-right:10px;font-weight:700;">&#10148;</span>${s}</td></tr>`)
    .join('');

  const moreHtml =
    moreCount > 0
      ? `<tr><td style="padding:5px 0;color:#6B7480;font-size:14.5px;line-height:1.55;font-style:italic;font-family:'Inter',Arial,sans-serif;">${c.more(moreCount)}</td></tr>`
      : '';

  const remainingBlock = remainingSections.length > 0
    ? callout(c.calloutTitle, `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${sectionListHtml}
          ${moreHtml}
        </table>
      `)
    : '';

  const bodyHtml =
    bodyRow(
      h1(c.h1(sectionsCompleted, totalSections)) +
      paragraph(c.greeting(firstName)) +
      paragraph(c.p1) +
      remainingBlock
    ) +
    ctaRow(c.cta, `${BASE_URL}/chat`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph(c.footnote, { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: c.subject(firstName),
    html: renderEmail({ title: c.title, preheader: c.preheader, bodyHtml, footer: 'reminder' }),
  };
}

function reportNotViewedEmail(firstName: string, lang: Lang): { subject: string; html: string } {
  const c = COPY[lang].reportNotViewed;
  const itemsHtml = c.items
    .map(([label, rest]) => `<tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.6;font-family:'Inter',Arial,sans-serif;font-weight:500;"><strong style="color:#122E3B;font-weight:700;">${label}</strong>: ${rest}</td></tr>`)
    .join('');

  const bodyHtml =
    bodyRow(
      h1(c.h1) +
      paragraph(c.greeting(firstName)) +
      paragraph(c.p1) +
      callout(c.calloutTitle, `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${itemsHtml}
        </table>
      `) +
      paragraph(c.p2)
    ) +
    ctaRow(c.cta, `${BASE_URL}/dashboard`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph(c.footnote, { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: c.subject(firstName),
    html: renderEmail({ title: c.title, preheader: c.preheader, bodyHtml, footer: 'reminder' }),
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
  preferred_language?: string | null;
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

    // Resolve each user's language. The cron payload may already include
    // preferred_language; if not, look it up from profiles in one batch.
    const langByUser = new Map<string, Lang>();
    for (const u of users) {
      if (u.preferred_language) langByUser.set(u.user_id, u.preferred_language === "nl" ? "nl" : "en");
    }
    const missing = users.filter((u) => !langByUser.has(u.user_id)).map((u) => u.user_id);
    if (missing.length > 0) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, preferred_language")
          .in("id", missing);
        for (const p of profiles ?? []) {
          langByUser.set(p.id, (p as { preferred_language?: string }).preferred_language === "nl" ? "nl" : "en");
        }
      } catch (e) {
        console.error("Failed to look up preferred_language, defaulting to en:", e);
      }
    }

    // For survey reminders, pull the stored question-level progress so the
    // email's % matches the dashboard instead of the coarse section counter.
    const progressByUser = new Map<string, { questionsAnswered?: number; totalQuestions?: number }>();
    if (type === "survey_abandoned") {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: rows } = await supabase
          .from("user_engagement_tracking")
          .select("user_id, survey_progress")
          .in("user_id", users.map((u) => u.user_id));
        for (const r of rows ?? []) {
          const p = (r as { survey_progress?: unknown }).survey_progress;
          if (p && typeof p === "object") {
            progressByUser.set((r as { user_id: string }).user_id, p as { questionsAnswered?: number; totalQuestions?: number });
          }
        }
      } catch (e) {
        console.error("Failed to fetch survey_progress, falling back to section estimate:", e);
      }
    }

    const results = [];

    for (const user of users) {
      const lang: Lang = langByUser.get(user.user_id) ?? "en";
      let emailContent: { subject: string; html: string };

      switch (type) {
        case "signup_no_start":
          emailContent = signupNoStartEmail(user.first_name, lang);
          break;
        case "survey_abandoned":
          emailContent = surveyAbandonedEmail(
            user.first_name,
            user.survey_last_section ?? null,
            user.survey_total_sections ?? null,
            lang,
            progressByUser.get(user.user_id) ?? null,
          );
          break;
        case "chat_not_completed":
          emailContent = chatNotCompletedEmail(
            user.first_name,
            user.chat_last_section_index ?? -1,
            lang,
          );
          break;
        case "report_not_viewed":
          emailContent = reportNotViewedEmail(user.first_name, lang);
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
