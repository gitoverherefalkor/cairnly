import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders, handleCorsPreFlight, checkRateLimit } from "../_shared/cors.ts";

// Binds an access code to the CALLING, already signed-in user.
//
// Why this exists: a code link (/auth?flow=signup&code=…, from a partner, an
// employer trial or an employee seat) offers Google and LinkedIn as the big
// buttons. OAuth leaves the site and comes back to /auth/confirm without the
// code, and AuthConfirm then signs out anyone with no purchase and no bound
// code. So every OAuth signup through a code link used to end on "no
// purchase". The frontend now remembers the code across the round trip
// (src/lib/pendingAccessCode.ts) and calls this before the entitlement check;
// a bound code is what link_and_check_entitlement counts.
//
// Same rules as signup-with-access-code, which does this for email signups:
// one code is one person, the bind is a CAS on user_id, usage_count is NOT
// touched (that happens at survey submission), and a partner code stamps the
// partner on the profile so the PDF carries the partner's branding.
// Employer codes carry employer_id on the code itself; nothing to stamp.

type Lang = "en" | "nl";
const pickLang = (v: unknown): Lang =>
  String(v ?? "en").slice(0, 2).toLowerCase() === "nl" ? "nl" : "en";

type Reason = "not_found" | "deactivated" | "expired" | "used" | "taken" | "failed";

// Shown to the user verbatim on the sign-up page they are sent back to.
const COPY: Record<Lang, Record<Reason, string>> = {
  en: {
    not_found: "We can't find that access code. Check the link you received, or ask whoever sent it.",
    deactivated: "This access code has been deactivated. Please contact support.",
    expired: "This access code has expired. Ask whoever issued it for a new one, or contact support.",
    used: "This access code has already been used. Each code works for one person.",
    taken: "This access code is already linked to another account. Each code works for one person.",
    failed: "We couldn't activate your access code. Please try again, or sign up with your email address.",
  },
  nl: {
    not_found: "We kunnen deze toegangscode niet vinden. Controleer de link die je hebt gekregen, of vraag het aan degene die 'm stuurde.",
    deactivated: "Deze toegangscode is gedeactiveerd. Neem contact op met support.",
    expired: "Deze toegangscode is verlopen. Vraag een nieuwe aan bij degene die 'm heeft verstrekt, of neem contact op met support.",
    used: "Deze toegangscode is al gebruikt. Elke code werkt voor één persoon.",
    taken: "Deze toegangscode is al gekoppeld aan een ander account. Elke code werkt voor één persoon.",
    failed: "We konden je toegangscode niet activeren. Probeer het opnieuw, of meld je aan met je e-mailadres.",
  },
};

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // Same budget as verify-access-code: this also answers "does code X exist".
  const rateLimited = checkRateLimit(req, 10, corsHeaders);
  if (rateLimited) return rateLimited;

  let lang: Lang = "en";
  const fail = (reason: Reason, status = 200) =>
    json({ claimed: false, reason, error: COPY[lang][reason] }, status);

  try {
    const body = await req.json().catch(() => ({}));
    lang = pickLang(body?.lang);
    const code = String(body?.code ?? '').trim().toUpperCase();
    if (!code) return fail("not_found", 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );

    // Gateway verify_jwt is off (see config.toml); the caller is identified
    // here, so an anon key or a missing token simply gets nothing.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return fail("failed", 401);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return fail("failed", 401);

    const { data: rec, error: codeError } = await supabase
      .from('access_codes')
      .select('id, user_id, is_active, expires_at, usage_count, max_usage, partner_id')
      .eq('code', code)
      .maybeSingle();

    if (codeError || !rec) return fail("not_found");

    // Already this user's code (a second tab, a retry): nothing to do.
    if (rec.user_id === user.id) return json({ claimed: true, already: true });

    if (rec.is_active === false) return fail("deactivated");
    if (rec.expires_at && new Date(rec.expires_at) < new Date()) return fail("expired");
    if (rec.usage_count >= rec.max_usage) return fail("used");
    if (rec.user_id) return fail("taken");

    // CAS: only an unbound code is bound, so two accounts racing for one code
    // cannot both win.
    const { data: bound, error: bindError } = await supabase
      .from('access_codes')
      .update({ user_id: user.id })
      .eq('id', rec.id)
      .is('user_id', null)
      .select('id');

    if (bindError) {
      console.error('claim-access-code: bind failed', bindError);
      return fail("failed", 500);
    }
    if (!bound || bound.length === 0) return fail("taken");

    // Non-fatal, as in signup-with-access-code: in-but-unbranded beats a
    // failed signup. Only fills an empty partner_id, never overwrites one.
    if (rec.partner_id) {
      const { error: stampError } = await supabase
        .from('profiles')
        .update({ partner_id: rec.partner_id })
        .eq('id', user.id)
        .is('partner_id', null);
      if (stampError) console.error('claim-access-code: partner stamp failed', stampError);
    }

    console.log('Access code claimed via OAuth return', { codeId: rec.id });
    return json({ claimed: true });
  } catch (err) {
    console.error('claim-access-code error:', err);
    return fail("failed", 500);
  }
});
