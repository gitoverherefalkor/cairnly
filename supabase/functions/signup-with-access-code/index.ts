
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders, handleCorsPreFlight, checkRateLimit } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  // Rate limit: 5 attempts per minute per IP (stricter than verify — this creates users)
  const rateLimited = checkRateLimit(req, 5, corsHeaders);
  if (rateLimited) return rateLimited;

  try {
    const { email, password, firstName, lastName, accessCode, preferredLanguage } = await req.json();

    // --- Input validation ---

    if (!email || !password || !firstName || !lastName || !accessCode) {
      return new Response(JSON.stringify({
        error: 'All fields are required: email, password, firstName, lastName, accessCode'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = accessCode.trim().toUpperCase();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return new Response(JSON.stringify({
        error: 'Please enter a valid email address.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({
        error: 'Password must be at least 8 characters long.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Initialize Supabase with service role ---

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY')!
    );

    // --- Verify access code (same checks as verify-access-code) ---

    console.log('Signup with access code requested');

    const { data: codeRecord, error: codeError } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', trimmedCode)
      .single();

    if (codeError || !codeRecord) {
      return new Response(JSON.stringify({
        error: 'Access code not found. Please check your code or purchase a new one.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (codeRecord.is_active === false) {
      return new Response(JSON.stringify({
        error: 'This access code has been deactivated. Please contact support.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({
        error: 'Access code has expired. Please purchase a new one.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (codeRecord.usage_count >= codeRecord.max_usage) {
      return new Response(JSON.stringify({
        error: 'Access code has already been used. Please purchase a new one.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If the code is already bound to a different user, reject. Prevents
    // multiple signups racing against the same code before any survey is
    // submitted.
    if (codeRecord.user_id && codeRecord.user_id !== null) {
      // Check if it's bound to a user whose email matches the signup email.
      // If so, this is a re-signup attempt — let the "email already exists"
      // path below handle it (or we'd block legit re-signup of the bound user).
      const { data: boundUser } = await supabase.auth.admin.getUserById(codeRecord.user_id);
      if (boundUser?.user?.email && boundUser.user.email.toLowerCase() !== trimmedEmail) {
        return new Response(JSON.stringify({
          error: 'This access code is already in use by another account.'
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // --- Create pre-verified user ---

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: trimmedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        access_code: trimmedCode,
        // Read by the handle_new_user trigger into profiles.preferred_language.
        // Validated here rather than trusted: that column is fed into LLM
        // prompts downstream (WF9 resume, chat, wrap-up), so it may only ever
        // hold a language we support.
        preferred_language: String(preferredLanguage ?? 'en').slice(0, 2).toLowerCase() === 'nl' ? 'nl' : 'en'
      }
    });

    if (createError) {
      console.error('User creation error:', createError.message);

      // Supabase returns this when the email is already registered
      if (createError.message?.includes('already been registered') ||
          createError.message?.includes('already exists') ||
          createError.message?.includes('unique constraint')) {
        return new Response(JSON.stringify({
          error: 'An account with this email already exists. Please sign in instead.',
          code: 'email_exists'
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Password rejected by Supabase's own rules (leaked-password / HaveIBeenPwned
      // check, minimum strength). Pass the reason through instead of the generic
      // "try again" below — otherwise the user retypes the same weak password
      // forever with no idea what's wrong.
      if ((createError as { code?: string }).code === 'weak_password' ||
          /password/i.test(createError.message ?? '')) {
        return new Response(JSON.stringify({
          error: createError.message ||
            'That password was rejected. Please choose a stronger, less common password.',
          code: 'weak_password'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        error: 'Failed to create account. Please try again.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User created successfully:', newUser.user?.id);

    // Atomically bind the access code to this user. The CAS predicate
    // (user_id IS NULL OR user_id = newUser.id) blocks a race where two
    // signups try to claim the same code. usage_count is not incremented
    // here — that happens once at survey submission via the
    // consume_access_code RPC.
    const { data: bindResult, error: bindError } = await supabase
      .from('access_codes')
      .update({ user_id: newUser.user!.id })
      .eq('id', codeRecord.id)
      .or(`user_id.is.null,user_id.eq.${newUser.user!.id}`)
      .select('id');

    if (bindError) {
      console.error('Failed to bind access code to user:', bindError);
      // Don't roll back the user — they exist and can sign in. Bind can be
      // retried on next survey load.
    } else if (!bindResult || bindResult.length === 0) {
      // Lost the race: the code was bound to a different user between the
      // check above and this update. The user is created but cannot use this
      // code. Surface a clear error so they contact support.
      console.error('Access code was claimed by another user during signup', { codeId: codeRecord.id });
      return new Response(JSON.stringify({
        error: 'This access code is already in use by another account. Please contact support.',
        userId: newUser.user?.id
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carry the batch's partner onto the candidate's profile. profiles.partner_id
    // is what report-print-data and render-report-pdf read to brand the PDF, and
    // report_pdfs.partner_id caches against it. That schema and both consumers
    // already exist; this write is the link that was missing between the code a
    // partner bought and the logo on the report their candidate receives.
    //
    // Non-fatal by design: a candidate who is in but unbranded is a far better
    // outcome than a signup that fails over a logo. The profile row is created
    // by the handle_new_user trigger, which runs inside admin.createUser, so it
    // exists by now; the returned row count tells us if that ever stops holding.
    if (codeRecord.partner_id) {
      const { data: stamped, error: partnerError } = await supabase
        .from('profiles')
        .update({ partner_id: codeRecord.partner_id })
        .eq('id', newUser.user!.id)
        .select('id');

      if (partnerError) {
        console.error('Failed to stamp partner on profile:', partnerError);
      } else if (!stamped || stamped.length === 0) {
        console.error('Partner stamp matched no profile row', { userId: newUser.user?.id });
      } else {
        console.log('Partner stamped on profile', { partnerId: codeRecord.partner_id });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      userId: newUser.user?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Signup error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create account. Please try again.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
