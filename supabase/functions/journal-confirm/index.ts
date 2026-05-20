// Confirms a pending Cairnly Journal subscription. Rotates the token on use so
// the link can't be replayed.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, corsHeaders);
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, corsHeaders);
  }

  const token = (body.token ?? "").trim();
  if (!UUID_RE.test(token)) {
    return new Response(
      JSON.stringify({ ok: false, reason: "invalid-or-expired" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing, error: fetchErr } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, status")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (fetchErr) {
    console.error("subscriber lookup failed:", fetchErr);
    return errorResponse(
      "Something went wrong. Try again in a moment.",
      500,
      corsHeaders,
    );
  }

  if (!existing || existing.status !== "pending") {
    return new Response(
      JSON.stringify({ ok: false, reason: "invalid-or-expired" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const newToken = crypto.randomUUID();
  const { error: updateErr } = await supabase
    .from("newsletter_subscribers")
    .update({
      status: "active",
      confirmed_at: new Date().toISOString(),
      confirmation_token: newToken,
    })
    .eq("id", existing.id);

  if (updateErr) {
    console.error("subscriber confirm failed:", updateErr);
    return errorResponse(
      "Something went wrong. Try again in a moment.",
      500,
      corsHeaders,
    );
  }

  return new Response(
    JSON.stringify({ ok: true, email: existing.email }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
