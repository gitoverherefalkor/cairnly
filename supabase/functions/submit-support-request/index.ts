// submit-support-request — receives a Support & Feedback form submission,
// logs it to the support_requests table, and emails info@cairnly.io.
//
// Callable without authentication: pre-login users submit too. When a valid
// user session token is supplied, the user is derived from it server-side; a
// client-supplied user_id is never trusted.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  checkRateLimit,
} from '../_shared/cors.ts';
import { renderEmail, escapeHtml } from '../_shared/email-chrome.ts';

const CATEGORY_LABELS: Record<string, string> = {
  access_code_payment: 'Access code / payment',
  assessment_survey: 'Assessment / survey',
  ai_chat: 'AI Chat',
  my_report: 'My report',
  job_openings: 'Job openings',
  account_login: 'Account / login',
  feature_idea: 'Feature idea',
  bug_report: 'Bug report',
  something_else: 'Something else',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SupportPayload {
  category?: string;
  message?: string;
  email?: string;
  page?: string;
  access_code?: string;
  user_agent?: string;
  // Optional screenshot, sent as a data URL (e.g. "data:image/png;base64,..").
  screenshot?: string;
  screenshot_name?: string;
}

// Max decoded screenshot size accepted server-side (5 MB). The frontend caps
// uploads too, but we re-check here since the function is publicly callable.
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// Parse a "data:<mime>;base64,<data>" URL into its mime type and raw bytes.
// Returns null when the string isn't a well-formed base64 image data URL.
function parseImageDataUrl(
  dataUrl: string,
): { mime: string; bytes: Uint8Array; base64: string } | null {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) return null;
  const base64 = match[2];
  try {
    const binary = atob(base64);
    if (binary.length > MAX_SCREENSHOT_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mime, bytes, base64 };
  } catch {
    return null;
  }
}

function extForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'png';
}

// Resolve the user from the request's auth token, if any. Returns null for
// anonymous requests. When logged out the frontend sends the anon key as the
// bearer token; /auth/v1/user rejects it, which we treat as anonymous (not an
// error).
async function resolveUser(
  req: Request,
): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return null;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    if (!user?.id || typeof user.id !== 'string') return null;
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}

// Build the internal HTML notification body
function buildSupportEmailHtml(args: {
  categoryLabel: string;
  email: string;
  accountId: string;
  accountStatus: string;
  page: string;
  accessCode: string;
  submittedAt: string;
  userAgent: string;
  message: string;
  hasScreenshot: boolean;
}): string {
  const safe = {
    categoryLabel: escapeHtml(args.categoryLabel),
    email: escapeHtml(args.email),
    accountId: escapeHtml(args.accountId),
    accountStatus: escapeHtml(args.accountStatus),
    page: escapeHtml(args.page),
    accessCode: escapeHtml(args.accessCode),
    submittedAt: escapeHtml(args.submittedAt),
    userAgent: escapeHtml(args.userAgent),
    message: escapeHtml(args.message),
  };

  const row = (label: string, value: string, monospace = false) =>
    `<tr>
      <td style="padding:10px 0;width:120px;color:#6B7480;font-size:10.5px;letter-spacing:2px;text-transform:uppercase;font-weight:700;font-family:'Poppins',Arial,sans-serif;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;color:#3D4A53;font-size:13px;${monospace ? "font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;" : "font-family:'Inter',Arial,sans-serif;"}word-break:break-word;">${value}</td>
    </tr>
    <tr><td colspan="2" style="border-top:1px solid #C9B690;height:1px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

  const bodyHtml = `
<tr><td style="padding:24px 36px 8px;background-color:#ECE4D2;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="vertical-align:middle;">
        <p style="margin:0;color:#6B7480;font-size:10.5px;letter-spacing:2px;text-transform:uppercase;font-weight:700;font-family:'Poppins',Arial,sans-serif;">New support request</p>
        <p style="margin:6px 0 0;color:#122E3B;font-size:22px;font-weight:700;font-family:'Poppins','Inter',Georgia,sans-serif;letter-spacing:-0.4px;">${safe.categoryLabel}</p>
      </td>
      <td style="vertical-align:middle;text-align:right;">
        <span style="display:inline-block;background-color:rgba(239,190,72,0.20);color:#B5860B;font-size:10.5px;font-weight:700;letter-spacing:0.6px;padding:6px 12px;border-radius:999px;text-transform:uppercase;font-family:'Poppins','Inter',Arial,sans-serif;">${safe.accountStatus}</span>
      </td>
    </tr>
  </table>
</td></tr>

<tr><td style="padding:18px 36px 8px;background-color:#ECE4D2;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    ${row('Category', `<span style="color:#122E3B;font-weight:600;font-size:14.5px;">${safe.categoryLabel}</span>`)}
    ${row('From', `<a href="mailto:${safe.email}" style="color:#1F8282;text-decoration:none;font-weight:600;font-size:14.5px;">${safe.email}</a>`)}
    ${row('Account', safe.accountId, true)}
    ${row('Page', safe.page, true)}
    ${row('Access code', safe.accessCode, true)}
    ${row('Submitted', safe.submittedAt)}
    ${row('Browser', `<span style="font-size:12px;line-height:1.5;">${safe.userAgent}</span>`)}
    ${args.hasScreenshot ? row('Screenshot', '<span style="color:#1F8282;font-weight:600;font-size:14px;">📎 Attached to this email</span>') : ''}
  </table>
</td></tr>

<tr><td style="padding:24px 36px 36px;background-color:#ECE4D2;font-family:'Inter','Segoe UI',Arial,sans-serif;">
  <p style="margin:0 0 12px 0;color:#122E3B;font-size:14px;font-weight:700;font-family:'Poppins','Inter',Arial,sans-serif;letter-spacing:-0.1px;">Message</p>
  <div style="background-color:#E0D6BD;border-left:3px solid #EFBE48;border-radius:0 12px 12px 0;padding:22px 24px;color:#122E3B;font-size:15px;line-height:1.65;white-space:pre-wrap;font-weight:500;">${safe.message}</div>
  <p style="margin:18px 0 0 0;color:#6B7480;font-size:13px;line-height:1.5;">Reply directly to this email to respond to <a href="mailto:${safe.email}" style="color:#1F8282;text-decoration:underline;">${safe.email}</a>.</p>
</td></tr>`;

  return renderEmail({
    title: `Support: ${args.categoryLabel}`,
    preheader: `New support request from ${args.email}`,
    bodyHtml,
    width: 640,
  });
}

// Plain-text fallback (multipart) — clients without HTML rendering still get
// a useful summary, and it preserves the original text-only delivery shape.
function buildSupportEmailText(args: {
  categoryLabel: string;
  email: string;
  accountId: string;
  page: string;
  accessCode: string;
  submittedAt: string;
  userAgent: string;
  message: string;
  hasScreenshot: boolean;
}): string {
  return [
    `Category: ${args.categoryLabel}`,
    `From: ${args.email}`,
    `Account: ${args.accountId}`,
    `Page: ${args.page}`,
    `Access code: ${args.accessCode}`,
    `Submitted: ${args.submittedAt}`,
    `Browser: ${args.userAgent}`,
    `Screenshot: ${args.hasScreenshot ? 'Attached to this email' : 'none'}`,
    '',
    '--- Message ---',
    args.message,
  ].join('\n');
}

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  // Abuse guard: 5 submissions per minute per IP.
  const limited = checkRateLimit(req, 5, corsHeaders);
  if (limited) return limited;

  let body: SupportPayload;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const category = typeof body.category === 'string' ? body.category : '';
  if (!CATEGORY_LABELS[category]) {
    return errorResponse('Valid category required', 400, corsHeaders);
  }

  const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
  if (rawMessage.length === 0) {
    return errorResponse('Message required', 400, corsHeaders);
  }
  const message = rawMessage.slice(0, 5000);

  const authedUser = await resolveUser(req);

  // Email: from the session when logged in, otherwise from the body.
  let email = authedUser?.email ?? '';
  if (!email) {
    email = typeof body.email === 'string' ? body.email.trim() : '';
  }
  if (!EMAIL_RE.test(email)) {
    return errorResponse('Valid email required', 400, corsHeaders);
  }

  const page = typeof body.page === 'string' ? body.page.slice(0, 300) : null;
  const accessCode =
    typeof body.access_code === 'string' ? body.access_code.slice(0, 100) : null;
  const userAgent =
    typeof body.user_agent === 'string' ? body.user_agent.slice(0, 500) : null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Optional screenshot: validate, upload to the private support-attachments
  // bucket, and keep the object path on the row. A malformed/oversized image is
  // ignored rather than failing the whole request — the message still matters.
  let screenshotPath: string | null = null;
  let screenshotAttachment: { filename: string; content: string } | null = null;
  if (typeof body.screenshot === 'string' && body.screenshot.length > 0) {
    const parsed = parseImageDataUrl(body.screenshot);
    if (parsed) {
      const ext = extForMime(parsed.mime);
      const filename = `screenshot.${ext}`;
      const path = `${authedUser?.id ?? 'anon'}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('support-attachments')
        .upload(path, parsed.bytes, { contentType: parsed.mime, upsert: false });
      if (upErr) {
        console.error('[submit-support-request] screenshot upload failed:', upErr);
      } else {
        screenshotPath = path;
        screenshotAttachment = { filename, content: parsed.base64 };
      }
    } else {
      console.warn('[submit-support-request] screenshot rejected (bad type/size)');
    }
  }

  // Log first — if the email send fails afterward, the request is still saved.
  const { error: insErr } = await supabase.from('support_requests').insert({
    category,
    message,
    email,
    user_id: authedUser?.id ?? null,
    page,
    access_code: accessCode,
    user_agent: userAgent,
    screenshot_path: screenshotPath,
  });

  if (insErr) {
    console.error('[submit-support-request] insert error:', insErr);
    return errorResponse('Failed to submit request', 500, corsHeaders);
  }

  // Email notification. A failure here does not fail the request — the row is
  // already saved — but it is logged for follow-up.
  const categoryLabel = CATEGORY_LABELS[category];
  const submittedAt = new Date().toISOString();
  const emailArgs = {
    categoryLabel,
    email,
    accountId: authedUser ? authedUser.id : 'not logged in',
    accountStatus: authedUser ? 'Logged in' : 'Anonymous',
    page: page ?? 'unknown',
    accessCode: accessCode ?? 'none',
    submittedAt,
    userAgent: userAgent ?? 'unknown',
    message,
    hasScreenshot: !!screenshotAttachment,
  };

  try {
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    await resend.emails.send({
      from: 'Cairnly support <no-reply@cairnly.io>',
      to: ['info@cairnly.io'],
      reply_to: email,
      subject: `[Support: ${categoryLabel}] from ${email}`,
      html: buildSupportEmailHtml(emailArgs),
      text: buildSupportEmailText(emailArgs),
      attachments: screenshotAttachment ? [screenshotAttachment] : undefined,
    });
  } catch (e) {
    console.error('[submit-support-request] email send failed:', e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
