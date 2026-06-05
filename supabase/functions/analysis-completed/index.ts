import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2.0.0";
import { verifySharedSecret, errorResponse } from "../_shared/cors.ts";
import {
  renderEmail,
  bodyRow,
  ctaRow,
  h1,
  paragraph,
  fineprint,
  callout,
} from "../_shared/email-chrome.ts";

// n8n-called function — no browser CORS needed
const serverHeaders = { 'Content-Type': 'application/json' };

serve(async (req) => {
  // No CORS preflight needed — this is server-to-server only
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Verify shared secret from n8n
  const authError = verifySharedSecret(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const reportId = body.report_id as string | undefined;

    if (!reportId) {
      return errorResponse('report_id is required', 400, serverHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY') ?? ''
    );

    // Update report status to pending_review (ready for user chat)
    const { data: updated, error: updateError } = await supabase
      .from('reports')
      .update({ status: 'pending_review' })
      .eq('id', reportId)
      .select('id, user_id, title')
      .single();

    if (updateError) {
      console.error('Failed to update report status:', updateError);
      return errorResponse('Failed to update report status', 500, serverHeaders);
    }

    // Fetch user email + language
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name, preferred_language')
      .eq('id', updated.user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error('Failed to fetch profile/email:', profileError);
      return errorResponse('Failed to fetch recipient email', 500, serverHeaders);
    }

    // Send report-ready email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not set; skipping email');
      return new Response(JSON.stringify({ success: true, email_skipped: true }), {
        headers: serverHeaders,
      });
    }

    const resend = new Resend(resendApiKey);
    const chatUrl = `https://cairnly.io/chat`;

    const firstName = profile.first_name || 'there';
    const lang: 'en' | 'nl' =
      (profile as { preferred_language?: string }).preferred_language === 'nl' ? 'nl' : 'en';

    // English is the source. Dutch follows the glossary tone (casual je-form,
    // no em-dashes, brand terms in English). See LOCALIZATION_PLAYBOOK.md.
    const COPY = {
      en: {
        subject: 'Your Cairnly analysis is ready',
        preheader: 'Your assessment has been analyzed and is ready to walk through.',
        h1: `Your personality & career analysis is ready, ${firstName}`,
        p1: `We've analyzed your survey and mapped out your personality profile, natural strengths, best-fit careers, and dream job fit. Your AI career coach is ready to walk you through every section.`,
        calloutTitle: 'Typically takes 20-30 minutes',
        calloutBody: 'Your session is saved if you need to pause and come back.',
        cta: 'Start Your Coaching Session',
        fineprint: 'If you did not request this, you can ignore this email.',
      },
      nl: {
        subject: 'Je Cairnly analyse is klaar',
        preheader: 'Je assessment is geanalyseerd en klaar om door te nemen.',
        h1: `Je persoonlijkheids- & loopbaananalyse is klaar, ${firstName}`,
        p1: `We hebben je enquête geanalyseerd en een volledig beeld opgebouwd van je persoonlijkheid, sterke punten, passende carrières en droombaan. Je AI-loopbaancoach staat klaar om je er doorheen te leiden.`,
        calloutTitle: 'Duurt meestal 20-30 minuten',
        calloutBody: 'Je sessie wordt opgeslagen als je even wilt pauzeren en later verder wilt.',
        cta: 'Start je coachingsessie',
        fineprint: 'Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.',
      },
    } as const;
    const c = COPY[lang];
    const subject = c.subject;

    const bodyHtml =
      bodyRow(
        h1(c.h1) +
        paragraph(c.p1) +
        callout(c.calloutTitle, `
          <p style="margin:0;color:#3D4A53;font-size:14.5px;line-height:1.65;font-family:'Inter',Arial,sans-serif;font-weight:500;">
            ${c.calloutBody}
          </p>
        `)
      ) +
      ctaRow(c.cta, chatUrl) +
      `<tr><td style="padding:0 48px 24px;background-color:#ECE4D2;" class="px-mob">${fineprint(c.fineprint)}</td></tr>`;

    const html = renderEmail({
      title: subject,
      preheader: c.preheader,
      bodyHtml,
    });

    const { error: emailError } = await resend.emails.send({
      from: 'Cairnly <no-reply@cairnly.io>',
      to: [profile.email],
      subject,
      html,
    });

    if (emailError) {
      console.error('Failed to send report-ready email:', emailError);
      return errorResponse('Failed to send email', 500, serverHeaders);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: serverHeaders,
    });
  } catch (error) {
    console.error('Error in analysis-completed function:', error);
    return errorResponse('Internal server error', 500, serverHeaders);
  }
});
