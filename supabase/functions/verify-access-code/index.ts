
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders, handleCorsPreFlight, errorResponse, checkRateLimit } from "../_shared/cors.ts";

// ─── Localized copy ─────────────────────────────────────────────────────────
// These strings are shown to the user verbatim: the client renders `data.error`
// and its own translated fallback only fires when this function sends nothing.
// So the message has to arrive already in the user's language, the same
// inline-COPY pattern payment-success and send-confirmation-email use.
//
// `lang` is optional and defaults to English, so a caller that does not send it
// behaves exactly as before.
//
// Wording note: three of these used to end in "purchase a new one". That is
// wrong for a partner candidate, who never bought anything, their agency did.
// Telling them to buy would push them at the EUR 59 checkout for a seat that is
// already paid for. The copy now points at whoever issued the code instead,
// which is true for a direct buyer (it is in their receipt email) and for an
// agency candidate alike.
type Lang = "en" | "nl";

const pickLang = (v: unknown): Lang =>
  String(v ?? "en").slice(0, 2).toLowerCase() === "nl" ? "nl" : "en";

const COPY = {
  en: {
    required: "Please enter your access code.",
    notFound:
      "We can't find that access code. Check it for typos, or look it up in the email you received.",
    deactivated: "This access code has been deactivated. Please contact support.",
    expired:
      "This access code has expired. Ask whoever issued it for a new one, or contact support.",
    // Says the rule out loud: one code is one person, enforced by
    // signup-with-access-code binding user_id to the first account to redeem it.
    alreadyUsed:
      "This access code has already been used. Each code works for one person.",
    failed: "We couldn't check your access code. Please try again.",
  },
  nl: {
    required: "Vul je toegangscode in.",
    notFound:
      "We kunnen deze toegangscode niet vinden. Controleer 'm op typefouten, of zoek 'm op in de e-mail die je hebt ontvangen.",
    deactivated: "Deze toegangscode is gedeactiveerd. Neem contact op met support.",
    expired:
      "Deze toegangscode is verlopen. Vraag een nieuwe aan bij degene die 'm heeft verstrekt, of neem contact op met support.",
    alreadyUsed:
      "Deze toegangscode is al gebruikt. Elke code werkt voor één persoon.",
    failed: "We konden je toegangscode niet controleren. Probeer het opnieuw.",
  },
} as const;

serve(async (req) => {
  // Handle CORS preflight requests
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  // Rate limit: 10 attempts per minute per IP (prevent brute-force code guessing)
  const rateLimited = checkRateLimit(req, 10, corsHeaders);
  if (rateLimited) return rateLimited;

  // Outside the try so the catch below can still answer in the right language.
  let lang: Lang = "en";

  try {
    const body = await req.json();
    const { code } = body;
    lang = pickLang(body?.lang);
    const t = COPY[lang];

    if (!code) {
      return new Response(JSON.stringify({
        valid: false,
        error: t.required
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Don't log the actual access code — just that a verification was attempted
    console.log('Access code verification requested');

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );

    // Check if access code exists and is valid
    const { data: accessCode, error } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (error || !accessCode) {
      return new Response(JSON.stringify({
        valid: false,
        error: t.notFound,
        needsPurchase: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if code is active
    if (accessCode.is_active === false) {
      return new Response(JSON.stringify({
        valid: false,
        error: t.deactivated,
        needsPurchase: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if expired (only if expires_at is set)
    if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
      return new Response(JSON.stringify({
        valid: false,
        error: t.expired,
        needsPurchase: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already used (usage_count >= max_usage)
    if (accessCode.usage_count >= accessCode.max_usage) {
      return new Response(JSON.stringify({
        valid: false,
        error: t.alreadyUsed,
        needsPurchase: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Best-effort: link this code to the verifying user so their account can
    // recover the assessment on any device / browser. Claims the code only if
    // it is still unclaimed. Never blocks verification if anything here fails.
    try {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user && !accessCode.user_id) {
          await supabase
            .from('access_codes')
            .update({ user_id: user.id })
            .eq('id', accessCode.id)
            .is('user_id', null);
        }
      }
    } catch (linkErr) {
      console.warn('Could not link access code to user:', linkErr);
    }

    return new Response(JSON.stringify({
      valid: true,
      accessCode: {
        id: accessCode.id,
        code: accessCode.code,
        survey_type: accessCode.survey_type,
        remaining_uses: accessCode.max_usage - accessCode.usage_count
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error verifying access code:', error);
    return new Response(JSON.stringify({
      valid: false,
      error: COPY[lang].failed
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
