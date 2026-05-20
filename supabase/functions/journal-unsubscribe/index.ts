// One-click unsubscribe. Always returns a success-shaped response, so we never
// leak whether the supplied token matched a real row.

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

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const okResponse = (corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    // Even on the wrong method, surface the same success shape to keep token
    // existence opaque.
    return okResponse(corsHeaders);
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return okResponse(corsHeaders);
  }

  const token = (body.token ?? "").trim();
  if (UUID_RE.test(token)) {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("unsubscribe_token", token);
    if (error) {
      console.error("unsubscribe update failed:", error);
      // Still return success so the response doesn't reveal token state.
    }
  }

  return okResponse(corsHeaders);
});
