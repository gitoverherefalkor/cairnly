// ops-outreach — the Outreach tab of the Ops console.
//
// Reads the prospect list joined with per-slug click stats, the mail log
// (phase 3: what went out, what came back, the reply draft state), the linked
// partner, the three header counters and the raw click log; writes the two
// hand-edited columns (status, notities) plus verzonden_op, which is stamped
// automatically when a bureau is flipped to 'verzonden' and feeds the scanner
// filter. Admin-gated; everything
// runs through the service role because outreach_prospects / outreach_clicks
// have RLS on with zero policies.
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
const MAILS_MAX = 2000;
const MAILS_PER_PROSPECT = 12;
// Mirrors the interval in the outreach_prospect_stats view. A non-bot click
// inside this window after the mail went out is treated as a link scanner.
const SUSPECT_WINDOW_MS = 2 * 60 * 1000;

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
      const [prospectsRes, statsRes, todayRes, logRes, mailsRes, partnersRes] = await Promise.all([
        supabase
          .from('outreach_prospects')
          .select(
            'slug, naam, tier, categorie, contactpersoon, plaats, campaign, to_email, status, notities, verzonden_op, partner_slug, updated_at',
          )
          .order('naam'),
        supabase.from('outreach_prospect_stats').select('*'),
        // Rows, not a head count: "clicks today" has to apply the same scanner
        // rule as everything else, and that needs each row's slug and time.
        supabase
          .from('outreach_clicks')
          .select('slug, created_at')
          .eq('is_bot', false)
          .gte('created_at', startOfTodayAmsterdam()),
        supabase
          .from('outreach_clicks')
          .select('id, slug, campaign, persona, p, utm_source, utm_medium, user_agent, referer, is_bot, created_at')
          .order('created_at', { ascending: false })
          .limit(RAW_LOG_ROWS),
        // Mail log (phase 3): newest first, folded per bureau below.
        supabase
          .from('outreach_mails')
          .select('id, slug, direction, kind, from_email, to_email, subject, snippet, sent_at, sentiment, samenvatting, draft_id, status_voor, status_na')
          .not('slug', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(MAILS_MAX),
        // Linked partners and how many codes they hold.
        supabase.from('partner_code_status').select('slug, name, codes_issued, codes_claimed, reports_completed'),
      ]);
      if (prospectsRes.error) throw prospectsRes.error;
      if (statsRes.error) throw statsRes.error;
      if (todayRes.error) throw todayRes.error;
      if (logRes.error) throw logRes.error;
      if (mailsRes.error) throw mailsRes.error;
      if (partnersRes.error) throw partnersRes.error;

      const mailsBySlug = new Map<string, Json[]>();
      for (const m of mailsRes.data ?? []) {
        const list = mailsBySlug.get(m.slug as string) ?? [];
        if (list.length < MAILS_PER_PROSPECT) list.push(m as Json);
        mailsBySlug.set(m.slug as string, list);
      }
      const partnerBySlug = new Map((partnersRes.data ?? []).map((r) => [r.slug as string, r]));

      const statsBySlug = new Map((statsRes.data ?? []).map((s) => [s.slug as string, s]));
      const prospects = (prospectsRes.data ?? []).map((p) => {
        const s = statsBySlug.get(p.slug as string);
        // Mail-derived state. `needs_reply`: their mail is the newest thing in
        // the conversation, so Sjoerd is up (a draft usually waits in Gmail).
        const mails = mailsBySlug.get(p.slug as string) ?? [];
        const latest = mails[0] ?? null;
        const latestIn = mails.find((m) => m.direction === 'in') ?? null;
        const partner = p.partner_slug ? partnerBySlug.get(p.partner_slug as string) : undefined;
        return {
          ...p,
          partner_naam: (partner?.name as string | null) ?? null,
          codes_issued: Number(partner?.codes_issued ?? 0),
          codes_claimed: Number(partner?.codes_claimed ?? 0),
          mails,
          laatste_mail_op: (latest?.sent_at as string | null) ?? null,
          laatste_mail_richting: (latest?.direction as 'in' | 'out' | null) ?? null,
          laatste_sentiment: (latestIn?.sentiment as string | null) ?? null,
          laatste_samenvatting: (latestIn?.samenvatting as string | null) ?? null,
          concept_klaar: Boolean(latestIn?.draft_id) && latest === latestIn,
          needs_reply: latest !== null && latest.direction === 'in' && latest.sentiment !== 'auto',
          kliks_totaal: Number(s?.kliks_totaal ?? 0),
          kliks_uniek_dagen: Number(s?.kliks_uniek_dagen ?? 0),
          eerste_klik: (s?.eerste_klik as string | null) ?? null,
          laatste_klik: (s?.laatste_klik as string | null) ?? null,
          bot_kliks: Number(s?.bot_kliks ?? 0),
          // Split on send time: a click in the first two minutes is scanner
          // shaped. The tab counts and sorts on the confirmed numbers.
          kliks_verdacht: Number(s?.kliks_verdacht ?? 0),
          kliks_bevestigd: Number(s?.kliks_bevestigd ?? 0),
          dagen_bevestigd: Number(s?.dagen_bevestigd ?? 0),
          eerste_bevestigde_klik: (s?.eerste_bevestigde_klik as string | null) ?? null,
          laatste_bevestigde_klik: (s?.laatste_bevestigde_klik as string | null) ?? null,
        };
      });

      // Send time per slug, used by both the "today" counter and the raw log.
      const sentBySlug = new Map(
        (prospectsRes.data ?? [])
          .filter((p) => p.verzonden_op)
          .map((p) => [p.slug as string, Date.parse(p.verzonden_op as string)]),
      );
      const isSuspect = (slug: unknown, createdAt: unknown): boolean => {
        const sent = sentBySlug.get(slug as string);
        if (sent === undefined) return false;
        const at = Date.parse(createdAt as string);
        return at >= sent && at < sent + SUSPECT_WINDOW_MS;
      };

      const counters = {
        prospects: prospects.length,
        prospects_with_click: prospects.filter((p) => p.kliks_bevestigd > 0).length,
        clicks_today: (todayRes.data ?? []).filter((r) => !isSuspect(r.slug, r.created_at)).length,
      };

      const campaigns = Array.from(
        new Set(prospects.map((p) => p.campaign as string | null).filter(Boolean) as string[]),
      ).sort();

      // Flag each raw-log row the same way, so the log shows WHY a click did
      // not count without the browser needing to know the rule.
      const log = (logRes.data ?? []).map((row) => ({
        ...row,
        verdacht: !row.is_bot && isSuspect(row.slug, row.created_at),
      }));

      return ok({ prospects, counters, campaigns, log }, corsHeaders);
    }

    // ── update ──────────────────────────────────────────────────────────────
    // status and notities are the hand-edited fields; verzonden_op is normally
    // stamped here rather than typed. Anything else on the body is ignored.
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
      // An explicit send time, for backfilling a batch that went out before
      // the auto-stamp existed. Null clears it.
      if ('verzonden_op' in body) {
        const raw = body.verzonden_op;
        if (raw == null || raw === '') {
          patch.verzonden_op = null;
        } else {
          const parsed = Date.parse(String(raw));
          if (Number.isNaN(parsed)) {
            return errorResponse('verzonden_op must be an ISO timestamp', 400, corsHeaders);
          }
          patch.verzonden_op = new Date(parsed).toISOString();
        }
      }

      if (!('status' in patch) && !('notities' in patch) && !('verzonden_op' in patch)) {
        return errorResponse('Nothing to update', 400, corsHeaders);
      }

      // Flipping a bureau to 'verzonden' IS the record that the mail went out,
      // so stamp the time then and there unless one is already known. Without
      // it the scanner filter has nothing to measure against, and asking for a
      // separate date entry per row is exactly the busywork this avoids.
      if (patch.status === 'verzonden' && !('verzonden_op' in patch)) {
        const { data: current } = await supabase
          .from('outreach_prospects')
          .select('verzonden_op')
          .eq('slug', slug)
          .maybeSingle();
        if (current && !current.verzonden_op) {
          patch.verzonden_op = new Date().toISOString();
        }
      }

      const { data, error } = await supabase
        .from('outreach_prospects')
        .update(patch)
        .eq('slug', slug)
        .select('slug, status, notities, verzonden_op, updated_at')
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
