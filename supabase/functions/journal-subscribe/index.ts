// Journal newsletter signup. Double opt-in: writes a pending row and sends a
// confirmation email via Resend. Idempotent on pending — same address resubmits
// the same confirmation link, never duplicates rows.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://cairnly.io", "https://www.cairnly.io"];
const DEV_ORIGIN = /^http:\/\/localhost(:\d+)?$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || DEV_ORIGIN.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, corsHeaders);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return errorResponse(
      "Please provide a valid email address.",
      400,
      corsHeaders,
    );
  }

  const source = (body.source ?? "journal").slice(0, 64);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing, error: fetchErr } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, status, confirmation_token")
    .eq("email", email)
    .maybeSingle();

  if (fetchErr) {
    console.error("subscriber lookup failed:", fetchErr);
    return errorResponse(
      "Something went wrong. Try again in a moment.",
      500,
      corsHeaders,
    );
  }

  let row: { email: string; confirmation_token: string } | null = null;
  let outcome: "confirmation-sent" | "already-subscribed" = "confirmation-sent";

  if (!existing) {
    const { data: inserted, error: insertErr } = await supabase
      .from("newsletter_subscribers")
      .insert({ email, source })
      .select("email, confirmation_token")
      .single();
    if (insertErr) {
      console.error("subscriber insert failed:", insertErr);
      return errorResponse(
        "Something went wrong. Try again in a moment.",
        500,
        corsHeaders,
      );
    }
    row = inserted;
  } else if (existing.status === "active") {
    // Silently succeed without re-sending the confirmation, so we don't leak
    // that the address is already on the list.
    outcome = "already-subscribed";
  } else if (existing.status === "pending") {
    // Reuse the existing token so older confirmation links keep working.
    row = {
      email: existing.email,
      confirmation_token: existing.confirmation_token,
    };
  } else {
    // status === 'unsubscribed' — reset to pending with a fresh token.
    const newToken = crypto.randomUUID();
    const { data: updated, error: updateErr } = await supabase
      .from("newsletter_subscribers")
      .update({
        status: "pending",
        confirmation_token: newToken,
        unsubscribed_at: null,
        source,
      })
      .eq("id", existing.id)
      .select("email, confirmation_token")
      .single();
    if (updateErr) {
      console.error("subscriber re-opt-in failed:", updateErr);
      return errorResponse(
        "Something went wrong. Try again in a moment.",
        500,
        corsHeaders,
      );
    }
    row = updated;
  }

  if (row) {
    const confirmUrl = `https://cairnly.io/newsletter/confirm?token=${row.confirmation_token}`;
    try {
      await resend.emails.send({
        from: "Cairnly <no-reply@cairnly.io>",
        to: [row.email],
        subject: "Confirm your Cairnly Journal subscription",
        text: `Hi,

Click below to confirm you'd like the Cairnly Journal, three to four short emails a year when a new piece is published, nothing else.

Confirm: ${confirmUrl}

Didn't request this? Ignore the email and nothing happens.

Cairnly, Utrecht`,
        html: `<div style="font-family:'Inter',Arial,sans-serif;color:#122E3B;max-width:560px;margin:0 auto;padding:24px;line-height:1.6;">
  <p style="margin:0 0 16px;">Hi,</p>
  <p style="margin:0 0 20px;">Click below to confirm you'd like the Cairnly Journal, three to four short emails a year when a new piece is published, nothing else.</p>
  <p style="margin:24px 0;">
    <a href="${confirmUrl}" style="display:inline-block;background:#2ABFBF;color:#fff;padding:14px 28px;border-radius:9999px;font-weight:700;text-decoration:none;">Confirm subscription</a>
  </p>
  <p style="margin:0 0 20px;font-size:13px;color:#4B6373;">Or paste this link into your browser:<br><span style="color:#1F8282;word-break:break-all;">${confirmUrl}</span></p>
  <p style="margin:0 0 8px;font-size:13px;color:#6B7F8B;">Didn't request this? Ignore the email and nothing happens.</p>
  <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;">Cairnly, Utrecht</p>
</div>`,
      });
    } catch (e) {
      console.error("Resend send failed:", e);
      return errorResponse(
        "We couldn't send the confirmation email. Try again in a moment.",
        502,
        corsHeaders,
      );
    }
  }

  return new Response(JSON.stringify({ ok: true, status: outcome }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
