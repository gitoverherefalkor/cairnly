// ops-employers — the employers channel in the Ops console (Tasha's pipeline).
//
// Add an employer, mint a trial code for the HR prospect or a batch of seat
// codes for their employees, move the lead along, and see how far the codes
// got. Admin-gated, all writes via the service role. See
// supabase/migrations/20261006130000_employers.sql for why employers are not
// partners.
//
// Actions: list | save | mint | delete
//
// `list` also returns the clicks on "Get a trial code" on /employers. That
// button is a mailto to Tasha, so a click is the most we can see: whether the
// visitor then actually sent the mail is invisible to us.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';
import { isAdminEmail } from '../_shared/admins.ts';

const SITE = 'https://cairnly.io';

const STATUSES = new Set(['lead', 'trial_sent', 'in_talks', 'customer', 'lost']);
const KINDS = new Set(['trial', 'seat']);

/** cta_id the /employers trial button reports (EmployersSections.tsx). */
const TRIAL_CTA_ID = 'employers_trial_code';
const CLICK_WINDOW_DAYS = 90;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Json = Record<string, unknown>;

const ok = (body: Json, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Trimmed string or null; caps length so a paste accident cannot bloat a row. */
const optText = (v: unknown, max: number): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, max) : null;
};

// Straight to the ordinary signup with the code pre-filled. No landing page:
// an employer code has no branding to show, and the employer-paid notice
// lives on the assessment's first screen. Mirrors partnerSignupPath in
// src/lib/partnerLinks.ts.
const signupLink = (code: string, lang: string) =>
  `${SITE}/auth?flow=signup&code=${encodeURIComponent(code)}&lang=${lang === 'nl' ? 'nl' : 'en'}`;

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  const authed = await getAuthenticatedUser(req, corsHeaders);
  if (authed instanceof Response) return authed;
  if (!isAdminEmail(authed.email)) {
    return errorResponse('Forbidden', 403, corsHeaders);
  }

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, corsHeaders);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const action = String(body.action ?? '');

  try {
    // ── list ────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const since = new Date(Date.now() - CLICK_WINDOW_DAYS * 86_400_000).toISOString();
      const [{ data: rows, error: rowsErr }, { data: stats, error: statsErr }, { data: clicks, error: clicksErr }] =
        await Promise.all([
          supabase
            .from('employers')
            .select('id, name, contact_name, contact_email, status, notes, created_by, created_at, updated_at')
            .order('updated_at', { ascending: false }),
          supabase.from('employer_code_status').select('*'),
          supabase
            .from('analytics_events')
            .select('created_at, country')
            .eq('event_type', 'cta_click')
            .eq('cta_id', TRIAL_CTA_ID)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(200),
        ]);
      if (rowsErr) throw rowsErr;
      if (statsErr) throw statsErr;
      if (clicksErr) throw clicksErr;

      const byId = new Map((stats ?? []).map((s) => [s.employer_id as string, s]));
      const employers = (rows ?? []).map((r) => ({ ...r, ...(byId.get(r.id as string) ?? {}) }));
      return ok({ employers, trialClicks: clicks ?? [], clickWindowDays: CLICK_WINDOW_DAYS }, corsHeaders);
    }

    // ── save (create, or update when id is given) ────────────────────────────
    if (action === 'save') {
      const id = body.id ? String(body.id) : null;
      if (id && !UUID_RE.test(id)) return errorResponse('Unknown employer.', 400, corsHeaders);

      const name = String(body.name ?? '').trim();
      if (!name || name.length > 80) {
        return errorResponse('Name is required and must be 80 characters or fewer.', 400, corsHeaders);
      }
      const status = String(body.status ?? 'lead');
      if (!STATUSES.has(status)) return errorResponse('Unknown status.', 400, corsHeaders);

      const contactEmail = optText(body.contactEmail, 200);
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        return errorResponse('That contact email does not look right.', 400, corsHeaders);
      }

      const fields = {
        name,
        contact_name: optText(body.contactName, 120),
        contact_email: contactEmail?.toLowerCase() ?? null,
        status,
        notes: optText(body.notes, 4000),
        updated_at: new Date().toISOString(),
      };

      if (id) {
        const { data, error } = await supabase.from('employers').update(fields).eq('id', id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) return errorResponse('Unknown employer.', 404, corsHeaders);
        return ok({ id }, corsHeaders);
      }

      const { data, error } = await supabase
        .from('employers')
        .insert({ ...fields, created_by: authed.email ?? null })
        .select('id')
        .single();
      if (error) throw error;
      return ok({ id: data.id }, corsHeaders);
    }

    // ── mint ────────────────────────────────────────────────────────────────
    if (action === 'mint') {
      const id = String(body.id ?? '');
      const kind = String(body.kind ?? '');
      const count = Number(body.count ?? 0);
      const lang = String(body.lang ?? 'nl');
      const expiresAt = body.expiresAt ? String(body.expiresAt) : null;

      if (!UUID_RE.test(id)) return errorResponse('Unknown employer.', 400, corsHeaders);
      if (!KINDS.has(kind)) return errorResponse('Unknown code kind.', 400, corsHeaders);
      if (!Number.isInteger(count) || count < 1 || count > 500) {
        return errorResponse('Choose a number of codes between 1 and 500.', 400, corsHeaders);
      }
      if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
        return errorResponse('That expiry date does not look right.', 400, corsHeaders);
      }

      const { data, error } = await supabase.rpc('mint_employer_codes', {
        p_employer_id: id,
        p_kind: kind,
        p_count: count,
        p_expires_at: expiresAt,
      });
      if (error) throw error;

      // A trial going out moves a fresh lead along. Never moves anything back:
      // an employer already in talks stays in talks when you send a second trial.
      if (kind === 'trial') {
        await supabase
          .from('employers')
          .update({ status: 'trial_sent', updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('status', 'lead');
      } else {
        await supabase.from('employers').update({ updated_at: new Date().toISOString() }).eq('id', id);
      }

      const codes = (data ?? []).map((r: { code: string }) => r.code);
      return ok({ codes, links: codes.map((c: string) => signupLink(c, lang)) }, corsHeaders);
    }

    // ── delete ──────────────────────────────────────────────────────────────
    // Untouched codes go with it, so a link still sitting in an inbox stops
    // working. Claimed codes stay (the FK nulls employer_id) so those people
    // keep their account and report, and a seat keeps its employer-paid kind.
    if (action === 'delete') {
      const id = String(body.id ?? '');
      if (!UUID_RE.test(id)) return errorResponse('Unknown employer.', 400, corsHeaders);

      const { data: removed, error: codesErr } = await supabase
        .from('access_codes')
        .delete()
        .eq('employer_id', id)
        .is('user_id', null)
        .eq('usage_count', 0)
        .select('id');
      if (codesErr) throw codesErr;

      const { error } = await supabase.from('employers').delete().eq('id', id);
      if (error) throw error;
      return ok({ ok: true, codesDeleted: removed?.length ?? 0 }, corsHeaders);
    }

    return errorResponse('Unknown action', 400, corsHeaders);
  } catch (e) {
    console.error('[ops-employers]', action, e);
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Server error';
    return errorResponse(message, 500, corsHeaders);
  }
});
