// ops-outreach — the Outreach tab of the Ops console.
//
// Reads the prospect list joined with per-slug click stats, the three header
// counters and the raw click log; writes exactly two columns (status,
// notities). Admin-gated; everything runs through the service role because
// outreach_prospects / outreach_clicks have RLS on with zero policies.
//
// Actions: list | update

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';
import { isAdminEmail } from '../_shared/admins.ts';
import { OUTREACH_STATUSES } from '../_shared/outreach.ts';

type Json = Record<string, unknown>;

const ok = (body: Json, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const STATUS_SET = new Set<string>(OUTREACH_STATUSES);
const NOTES_MAX = 4000;
const RAW_LOG_ROWS = 100;

/** Start of today in Europe/Amsterdam, as an ISO instant. */
function startOfTodayAmsterdam(now = new Date()): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // YYYY-MM-DD
  const offsetPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    timeZoneName: 'longOffset',
  })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00'; // "GMT+02:00"
  const m = /GMT([+-]\d{2}):(\d{2})/.exec(offsetPart);
  const offset = m ? `${m[1]}:${m[2]}` : '+01:00';
  return new Date(`${day}T00:00:00${offset}`).toISOString();
}

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
      const [prospectsRes, statsRes, todayRes, logRes] = await Promise.all([
        supabase
          .from('outreach_prospects')
          .select(
            'slug, naam, tier, categorie, contactpersoon, plaats, campaign, to_email, status, notities, updated_at',
          )
          .order('naam'),
        supabase.from('outreach_prospect_stats').select('*'),
        supabase
          .from('outreach_clicks')
          .select('id', { count: 'exact', head: true })
          .eq('is_bot', false)
          .gte('created_at', startOfTodayAmsterdam()),
        supabase
          .from('outreach_clicks')
          .select('id, slug, campaign, persona, p, utm_source, utm_medium, user_agent, referer, is_bot, created_at')
          .order('created_at', { ascending: false })
          .limit(RAW_LOG_ROWS),
      ]);
      if (prospectsRes.error) throw prospectsRes.error;
      if (statsRes.error) throw statsRes.error;
      if (todayRes.error) throw todayRes.error;
      if (logRes.error) throw logRes.error;

      const statsBySlug = new Map((statsRes.data ?? []).map((s) => [s.slug as string, s]));
      const prospects = (prospectsRes.data ?? []).map((p) => {
        const s = statsBySlug.get(p.slug as string);
        return {
          ...p,
          kliks_totaal: Number(s?.kliks_totaal ?? 0),
          kliks_uniek_dagen: Number(s?.kliks_uniek_dagen ?? 0),
          eerste_klik: (s?.eerste_klik as string | null) ?? null,
          laatste_klik: (s?.laatste_klik as string | null) ?? null,
          bot_kliks: Number(s?.bot_kliks ?? 0),
        };
      });

      const counters = {
        prospects: prospects.length,
        prospects_with_click: prospects.filter((p) => p.kliks_totaal > 0).length,
        clicks_today: todayRes.count ?? 0,
      };

      const campaigns = Array.from(
        new Set(prospects.map((p) => p.campaign as string | null).filter(Boolean) as string[]),
      ).sort();

      return ok({ prospects, counters, campaigns, log: logRes.data ?? [] }, corsHeaders);
    }

    // ── update ──────────────────────────────────────────────────────────────
    // The only two hand-edited fields. Anything else on the body is ignored.
    if (action === 'update') {
      const slug = String(body.slug ?? '').trim();
      if (!slug) return errorResponse('slug required', 400, corsHeaders);

      const patch: Json = { updated_at: new Date().toISOString() };
      if ('status' in body) {
        const status = String(body.status ?? '');
        if (!STATUS_SET.has(status)) {
          return errorResponse(`Unknown status: ${status}`, 400, corsHeaders);
        }
        patch.status = status;
      }
      if ('notities' in body) {
        const raw = body.notities;
        const notes = raw == null ? '' : String(raw);
        if (notes.length > NOTES_MAX) {
          return errorResponse(`Notes must be ${NOTES_MAX} characters or fewer.`, 400, corsHeaders);
        }
        patch.notities = notes.trim() || null;
      }
      if (!('status' in patch) && !('notities' in patch)) {
        return errorResponse('Nothing to update', 400, corsHeaders);
      }

      const { data, error } = await supabase
        .from('outreach_prospects')
        .update(patch)
        .eq('slug', slug)
        .select('slug, status, notities, updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse('Unknown prospect', 404, corsHeaders);

      return ok({ prospect: data }, corsHeaders);
    }

    return errorResponse(`Unknown action: ${action}`, 400, corsHeaders);
  } catch (e) {
    console.error('[ops-outreach] error:', e);
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return errorResponse(message, 500, corsHeaders);
  }
});
