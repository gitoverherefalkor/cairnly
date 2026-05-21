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

    // Fetch user email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name')
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
    const titleSuffix = updated.title ? ` "${updated.title}"` : '';
    const subject = 'Your Cairnly career report is ready';

    const bodyHtml =
      bodyRow(
        h1(`Your career analysis is ready, ${firstName}`) +
        paragraph(`Your assessment${titleSuffix} has been analyzed and your AI career coach is ready to walk you through the results.`) +
        paragraph("The coaching chat is the core of the Cairnly experience. It covers your personality profile, strengths, career matches, and dream job analysis, section by section, with you in the driver's seat.") +
        callout('Typically takes 20-30 minutes', `
          <p style="margin:0;color:#3D4A53;font-size:14.5px;line-height:1.65;font-family:'Inter',Arial,sans-serif;font-weight:500;">
            Your session is saved if you need to pause and come back.
          </p>
        `)
      ) +
      ctaRow('Start Your Coaching Session', chatUrl) +
      `<tr><td style="padding:0 48px 24px;background-color:#ECE4D2;" class="px-mob">${fineprint('If you did not request this, you can ignore this email.')}</td></tr>`;

    const html = renderEmail({
      title: subject,
      preheader: 'Your assessment has been analyzed and is ready to walk through.',
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
