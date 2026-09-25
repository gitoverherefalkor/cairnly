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
// Actions: list | update | dismiss_reply | send_pause
//   Control center (2026-09-24): concept_update | concept_schedule |
//   concept_schedule_all | concept_send | concept_unschedule | concept_discard |
//   concept_no_reply | concept_regenerate | prepare_now | auto_toggle |
//   fix_email | knock | push_subscribe | push_unsubscribe | push_test |
//   vapid_public_key
// The old queue_followup ("Draft it") is gone: outreach-prepare writes the
// chases itself, and they wait here as concepts.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';
import { isAdminEmail } from '../_shared/admins.ts';
import { OUTREACH_STATUSES, isParked } from '../_shared/outreach.ts';
import {
  approveConcept,
  invalidateForSlug,
  unscheduleConcept,
  type ConceptSoort,
} from '../_shared/outreachConcepts.ts';
import { runPrepare } from '../_shared/outreachPrepare.ts';
import { MAX_WORDS, validateOutgoing } from '../_shared/outreachValidate.ts';
import { demoLink, salutation } from '../_shared/outreachFollowUp.ts';
import { sendToAll, vapidPublicKey, OPS_OUTREACH_URL } from '../_shared/opsPush.ts';

type Json = Record<string, unknown>;

const ok = (body: Json, corsHeaders: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const STATUS_SET = new Set<string>(OUTREACH_STATUSES);
const NOTES_MAX = 4000;
const RAW_LOG_ROWS = 100;
const MAILS_MAX = 2000;
/** "Schedule all" never approves more than this in one click. */
const SCHEDULE_ALL_MAX = 40;
const MAILS_PER_PROSPECT = 12;
/** Statuses after which a prepared chase or first mail no longer makes sense. */
const CLOSING_STATUSES = new Set(['gesprek_gepland', 'gesprek_gevoerd', 'pilot_afgesproken', 'pilot_gestart', 'founding_partner', 'afgewezen', 'geen_fit']);
const BODY_MAX = 8000;
/** WF12's webhook, knocked after a Send so "now" means about now. */
const WF12_WEBHOOK = 'https://falkoratlas.app.n8n.cloud/webhook/d56ec58d-99d7-4c1e-bfd0-e6ffce6b894a';
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
      const [prospectsRes, statsRes, demoRes, subjectRes, sendStateRes, sendQueueRes, todayRes, logRes, mailsRes, partnersRes, conceptsRes, nudgedRes] = await Promise.all([
        supabase
          .from('outreach_prospects')
          .select(
            'slug, naam, tier, categorie, contactpersoon, plaats, campaign, to_email, status, notities, verzonden_op, partner_slug, followup_requested_at, followup_draft_id, reply_dismissed_at, subject_variant, niet_mailen_op, email_ongeldig_op, updated_at',
          )
          .order('naam'),
        supabase.from('outreach_prospect_stats').select('*'),
        // What happened AFTER the click: how deep into the demo's seven
        // moments the best session at this agency got. Empty for every
        // visit before 2026-09-21, when the slug first reached analytics.
        supabase.from('outreach_prospect_demo').select('*'),
        // Subject-line A/B readout. Underpowered at the current list size;
        // the tab says so next to the numbers rather than in a comment.
        supabase.from('outreach_subject_stats').select('*'),
        // The send queue: the kill switch, the pacing state, and what is
        // waiting. Read-only here; WF12 is the only thing that sends.
        supabase.from('outreach_send_state').select('*').maybeSingle(),
        supabase.from('outreach_send_queue')
          .select('id, slug, soort, status, sent_at, fout, pogingen, created_at, concept_id, niet_voor, direct')
          .order('created_at', { ascending: false })
          .limit(200),
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
        supabase
          .from('partner_code_status')
          .select('slug, name, codes_issued, codes_claimed, codes_open, reports_completed, first_code_at'),
        // The control center: everything waiting or scheduled, the stale ones
        // Sjoerd had edited (his words must not vanish), and today's sent.
        supabase
          .from('outreach_concepts')
          .select(
            'id, slug, soort, step, status, to_email, subject, body, body_origineel, skeleton, variant, basis, thread_id, answers_mail_id, validatie, beoordeling, verouderd_reden, bewerkt_op, goedgekeurd_door, goedgekeurd_op, verzonden_op, created_at, updated_at',
          )
          .or(
            `status.in.(voorstel,ingepland),and(status.eq.verouderd,bewerkt_op.not.is.null),and(status.eq.verzonden,verzonden_op.gte."${startOfTodayAmsterdam()}")`,
          )
          .order('created_at', { ascending: true })
          .limit(300),
        // The one unused-code nudge per agency, once it went out.
        supabase.from('outreach_concepts').select('slug, verzonden_op').eq('soort', 'activation').eq('status', 'verzonden'),
      ]);
      if (prospectsRes.error) throw prospectsRes.error;
      if (statsRes.error) throw statsRes.error;
      if (demoRes.error) throw demoRes.error;
      if (subjectRes.error) throw subjectRes.error;
      if (sendStateRes.error) throw sendStateRes.error;
      if (sendQueueRes.error) throw sendQueueRes.error;
      if (todayRes.error) throw todayRes.error;
      if (logRes.error) throw logRes.error;
      if (mailsRes.error) throw mailsRes.error;
      if (partnersRes.error) throw partnersRes.error;
      if (conceptsRes.error) throw conceptsRes.error;
      if (nudgedRes.error) throw nudgedRes.error;
      const nudgedBySlug = new Map((nudgedRes.data ?? []).map((c) => [c.slug as string, c.verzonden_op as string | null]));

      const mailsBySlug = new Map<string, Json[]>();
      for (const m of mailsRes.data ?? []) {
        const list = mailsBySlug.get(m.slug as string) ?? [];
        if (list.length < MAILS_PER_PROSPECT) list.push(m as Json);
        mailsBySlug.set(m.slug as string, list);
      }
      const partnerBySlug = new Map((partnersRes.data ?? []).map((r) => [r.slug as string, r]));

      const statsBySlug = new Map((statsRes.data ?? []).map((s) => [s.slug as string, s]));
      const demoBySlug = new Map((demoRes.data ?? []).map((d) => [d.slug as string, d]));
      const prospects = (prospectsRes.data ?? []).map((p) => {
        const s = statsBySlug.get(p.slug as string);
        const d = demoBySlug.get(p.slug as string);
        // Mail-derived state. `needs_reply`: their mail is the newest thing in
        // the conversation, so Sjoerd is up (a draft usually waits in Gmail).
        const mails = mailsBySlug.get(p.slug as string) ?? [];
        const latest = mails[0] ?? null;
        const latestIn = mails.find((m) => m.direction === 'in') ?? null;
        // They wrote last and it was a real person, not an out-of-office.
        const theyWroteLast = latest !== null && latest.direction === 'in' && latest.sentiment !== 'auto';
        // Parked ("they'll get back to me") only holds while it is newer than
        // their last mail, so a fresh mail from them re-opens the row by itself.
        const replyDismissed = isParked(p.reply_dismissed_at as string | null, latest as never);
        const partner = p.partner_slug ? partnerBySlug.get(p.partner_slug as string) : undefined;
        return {
          ...p,
          partner_naam: (partner?.name as string | null) ?? null,
          codes_issued: Number(partner?.codes_issued ?? 0),
          codes_claimed: Number(partner?.codes_claimed ?? 0),
          codes_open: Number(partner?.codes_open ?? 0),
          reports_completed: Number(partner?.reports_completed ?? 0),
          first_code_at: (partner?.first_code_at as string | null) ?? null,
          activation_nudged_at: nudgedBySlug.get(p.slug as string) ?? null,
          mails,
          laatste_mail_op: (latest?.sent_at as string | null) ?? null,
          laatste_mail_richting: (latest?.direction as 'in' | 'out' | null) ?? null,
          laatste_sentiment: (latestIn?.sentiment as string | null) ?? null,
          laatste_samenvatting: (latestIn?.samenvatting as string | null) ?? null,
          concept_klaar: Boolean(latestIn?.draft_id) && latest === latestIn,
          needs_reply: theyWroteLast && !replyDismissed,
          reply_dismissed: replyDismissed,
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
          // Demo depth. `momenten_max` is the best session's reach into the
          // seven annotated moments, so 0 is "clicked and bounced" and 7 is
          // "read the whole conversation". null means we have no measurement,
          // which is not the same as zero and must not be shown as one.
          demo_sessies: Number(d?.demo_sessies ?? 0),
          momenten_max: d ? Number(d.momenten_max ?? 0) : null,
          momenten_gemiddeld: d ? Number(d.momenten_gemiddeld ?? 0) : null,
          sessies_met_cta: Number(d?.sessies_met_cta ?? 0),
          sessies_engaged: Number(d?.sessies_engaged ?? 0),
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

      const knownSlugs = new Set(prospects.map((p) => p.slug as string));
      const counters = {
        prospects: prospects.length,
        prospects_with_click: prospects.filter((p) => p.kliks_bevestigd > 0).length,
        // Only clicks on a link we sent to a known agency. Mail scanners also
        // hit rewritten links with scrambled slugs (seen 2026-09-25), which
        // read as "3 clicks, from 0 agencies".
        clicks_today: (todayRes.data ?? []).filter(
          (r) => knownSlugs.has(r.slug as string) && !isSuspect(r.slug, r.created_at),
        ).length,
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

      // Amsterdam day, matching outreach_send_claim's own daily cap.
      const vandaag = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
      const queue = sendQueueRes.data ?? [];
      const send = {
        state: sendStateRes.data ?? null,
        in_wachtrij: queue.filter((q) => q.status === 'queued').length,
        bezig: queue.filter((q) => q.status === 'sending').length,
        mislukt: queue.filter((q) => q.status === 'failed').length,
        vandaag_verzonden: queue.filter(
          (q) =>
            q.sent_at &&
            new Date(q.sent_at as string).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }) === vandaag,
        ).length,
        recent: queue.slice(0, 20),
        // The cap counts cold mail only; replies do not use it up.
        vandaag_koud: queue.filter(
          (q) =>
            q.sent_at && q.soort !== 'reply' &&
            new Date(q.sent_at as string).toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }) === vandaag,
        ).length,
      };

      // ── Control center ──
      // Each concept travels with its live queue row (when scheduled) and, for
      // a reply, the full mail it answers, so the cockpit needs no second call.
      const conceptRows = conceptsRes.data ?? [];
      const liveQueue = new Map(
        queue
          .filter((q) => q.concept_id && (q.status === 'queued' || q.status === 'sending'))
          .map((q) => [q.concept_id as string, q]),
      );
      const answerIds = conceptRows.map((c) => c.answers_mail_id).filter(Boolean) as string[];
      const answered = new Map<string, Json>();
      if (answerIds.length) {
        const { data: am, error: amErr } = await supabase
          .from('outreach_mails')
          .select('id, from_email, subject, body_text, snippet, sent_at, sentiment, samenvatting')
          .in('id', answerIds);
        if (amErr) throw amErr;
        for (const m of am ?? []) answered.set(m.id as string, m as Json);
      }
      const naamBySlug = new Map((prospectsRes.data ?? []).map((p) => [p.slug as string, p]));
      const concepts = conceptRows.map((c) => {
        const q = liveQueue.get(c.id as string);
        const p = naamBySlug.get(c.slug as string);
        return {
          ...c,
          naam: (p?.naam as string | null) ?? null,
          tier: (p?.tier as string | null) ?? null,
          queue: q ? { id: q.id, status: q.status, niet_voor: q.niet_voor, direct: q.direct } : null,
          answers: c.answers_mail_id ? answered.get(c.answers_mail_id as string) ?? null : null,
        };
      });

      // What the automation decided today, so nothing happens silently.
      const todayStart = Date.parse(startOfTodayAmsterdam());
      const inToday = (mailsRes.data ?? []).filter((m) => m.direction === 'in' && Date.parse(m.sent_at as string) >= todayStart);
      const handled_today = {
        auto_rejections: conceptRows.filter(
          (c) => c.soort === 'reply' && c.goedgekeurd_door === 'auto' && Date.parse(c.created_at as string) >= todayStart,
        ).length,
        opt_outs: inToday.filter((m) => m.sentiment === 'stop').length,
        bounces: inToday.filter((m) => m.sentiment === 'bounce').length,
        out_of_office: inToday.filter((m) => m.sentiment === 'auto').length,
      };

      // Does the second reader judge like Sjoerd? Every concept it judged that
      // Sjoerd then decided on: approved untouched = he found it good; edited
      // or discarded = he did not. "No reply needed" says nothing about the
      // text and is left out. Newest first, so the streak is the current run.
      const { data: judged, error: judgedErr } = await supabase
        .from('outreach_concepts')
        .select('beoordeling, status, bewerkt_op, goedgekeurd_door, updated_at')
        .in('beoordeling->>verdict', ['goed', 'krom'])
        .or('goedgekeurd_door.eq.sjoerd,status.eq.weggegooid')
        .order('updated_at', { ascending: false })
        .limit(60);
      if (judgedErr) throw judgedErr;
      const outcomes = (judged ?? []).map((c) => {
        const critic = (c.beoordeling as Json | null)?.verdict;
        const sjoerd = c.status === 'weggegooid' || c.bewerkt_op ? 'krom' : 'goed';
        return critic === sjoerd;
      });
      const streak = outcomes.findIndex((agree) => !agree);
      const critic_agreement = {
        judged: outcomes.length,
        agreed: outcomes.filter(Boolean).length,
        streak: streak === -1 ? outcomes.length : streak,
      };

      return ok(
        { prospects, counters, campaigns, log, subject_stats: subjectRes.data ?? [], send, concepts, handled_today, critic_agreement },
        corsHeaders,
      );
    }

    // ── send_pause ──────────────────────────────────────────────────────────
    // The kill switch, and deliberately the ONLY write this function offers on
    // the send side. Queuing happens in outreach-mail-sync when a draft is
    // created, and sending happens in WF12; /ops can stop the machine but
    // cannot make it send something.
    if (action === 'send_pause') {
      const gepauzeerd = Boolean(body.gepauzeerd);
      const { data, error } = await supabase
        .from('outreach_send_state')
        .update({ gepauzeerd, updated_at: new Date().toISOString() })
        .eq('id', true)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return ok({ state: data }, corsHeaders);
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

      // A call booked, a no, a no-fit: whatever was prepared for them is spent.
      if (typeof patch.status === 'string' && CLOSING_STATUSES.has(patch.status)) {
        await invalidateForSlug(supabase, slug, `Status set to ${patch.status} in /ops`, { soorten: ['initial', 'chase', 'checkin', 'activation'] });
      }

      return ok({ prospect: data }, corsHeaders);
    }

    // ── dismiss_reply ───────────────────────────────────────────────────────
    // "Park, they'll get back to me": takes the agency off "Waiting on you"
    // until they write again, and starts the check-in clock. A stamp, not a
    // flag, so the list read can compare it with their newest mail. `undo`
    // clears it. Gmail is not touched either way.
    if (action === 'dismiss_reply') {
      const slug = String(body.slug ?? '').trim();
      if (!slug) return errorResponse('slug required', 400, corsHeaders);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('outreach_prospects')
        .update({ reply_dismissed_at: body.undo ? null : now, updated_at: now })
        .eq('slug', slug)
        .select('slug, reply_dismissed_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse('Unknown prospect', 404, corsHeaders);
      return ok({ prospect: data }, corsHeaders);
    }

    // ── Control center: concepts ────────────────────────────────────────────
    // Everything below acts on outreach_concepts through _shared/outreachConcepts.ts,
    // so approving and queueing stay one step and the veto/undo windows hold.

    const conceptId = String(body.id ?? '').trim();
    const needId = () => (conceptId ? null : errorResponse('id required', 400, corsHeaders));

    // Save Sjoerd's edit. The first edit stamps bewerkt_op: from then on no
    // generator touches this text again. The validator result is refreshed so
    // the card shows what (if anything) is off.
    if (action === 'concept_update') {
      const missing = needId();
      if (missing) return missing;
      const text = String(body.body ?? '');
      if (!text.trim() || text.length > BODY_MAX) return errorResponse(`Body must be 1-${BODY_MAX} characters.`, 400, corsHeaders);
      const { data: c, error: cErr } = await supabase
        .from('outreach_concepts')
        .select('id, slug, soort, status, bewerkt_op')
        .eq('id', conceptId)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!c) return errorResponse('Unknown concept', 404, corsHeaders);
      if (!['voorstel', 'ingepland', 'verouderd'].includes(c.status as string)) {
        return errorResponse(`A ${c.status} concept can no longer be edited.`, 409, corsHeaders);
      }
      // Once WF12 has claimed it, the text is already on its way: an edit now
      // would be saved but never sent.
      const { data: inFlight } = await supabase
        .from('outreach_send_queue')
        .select('id')
        .eq('concept_id', conceptId)
        .eq('status', 'sending')
        .limit(1);
      if (inFlight?.length) return errorResponse('Too late: this mail is being sent right now.', 409, corsHeaders);
      const { data: p } = await supabase
        .from('outreach_prospects')
        .select('naam, contactpersoon, campaign')
        .eq('slug', c.slug)
        .maybeSingle();
      const soort = c.soort as ConceptSoort;
      const person = { contactpersoon: (p?.contactpersoon as string | null) ?? null, bureau: (p?.naam as string | null) ?? String(c.slug) };
      const validatie = validateOutgoing(text, {
        soort,
        expectedSalutation: soort === 'initial' || soort === 'chase' ? salutation(person) : null,
        demoLink: soort === 'initial' ? demoLink(String(c.slug), (p?.campaign as string | null) ?? null) : null,
        maxWords: MAX_WORDS[soort],
      });
      const patch: Json = { body: text, validatie, updated_at: new Date().toISOString() };
      if (!c.bewerkt_op) patch.bewerkt_op = new Date().toISOString();
      if (typeof body.subject === 'string' && body.subject.trim()) patch.subject = body.subject.trim().slice(0, 200);
      const { error } = await supabase.from('outreach_concepts').update(patch).eq('id', conceptId);
      if (error) throw error;
      return ok({ ok: true, validatie }, corsHeaders);
    }

    // Schedule: the next free slot in its lane (a chase never before its due day).
    if (action === 'concept_schedule') {
      const missing = needId();
      if (missing) return missing;
      const res = await approveConcept(supabase, conceptId, { direct: false });
      return ok({ ok: true, ...res }, corsHeaders);
    }

    // Schedule all: cold mail only; replies and check-ins are always one by one.
    if (action === 'concept_schedule_all') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
      if (!ids.length) return errorResponse('ids required', 400, corsHeaders);
      if (ids.length > SCHEDULE_ALL_MAX) return errorResponse(`At most ${SCHEDULE_ALL_MAX} at a time.`, 400, corsHeaders);
      const { data: rows, error } = await supabase
        .from('outreach_concepts')
        .select('id, soort')
        .in('id', ids)
        .eq('status', 'voorstel')
        .in('soort', ['initial', 'chase']);
      if (error) throw error;
      let scheduled = 0;
      for (const r of rows ?? []) {
        try {
          await approveConcept(supabase, r.id as string, { direct: false });
          scheduled++;
        } catch (e) {
          console.error('[ops-outreach] schedule_all skipped', r.id, e);
        }
      }
      return ok({ ok: true, scheduled, skipped: ids.length - scheduled }, corsHeaders);
    }

    // Send: goes now, after a short Undo window. The browser calls `knock`
    // when that window closes; if the tab is gone, pg_cron's wake picks it up.
    if (action === 'concept_send') {
      const missing = needId();
      if (missing) return missing;
      const res = await approveConcept(supabase, conceptId, { direct: true });
      return ok({ ok: true, ...res }, corsHeaders);
    }

    // Undo / Unschedule: only while WF12 has not claimed it.
    if (action === 'concept_unschedule') {
      const missing = needId();
      if (missing) return missing;
      const back = await unscheduleConcept(supabase, conceptId);
      if (!back) return errorResponse('Too late: this mail is already on its way.', 409, corsHeaders);
      return ok({ ok: true }, corsHeaders);
    }

    // Discard, or "No reply needed" for a reply that asks nothing of us.
    if (action === 'concept_discard' || action === 'concept_no_reply') {
      const missing = needId();
      if (missing) return missing;
      const back = await unscheduleConcept(supabase, conceptId);
      if (!back) return errorResponse('Too late: this mail is already on its way.', 409, corsHeaders);
      const status = action === 'concept_no_reply' ? 'geen_antwoord' : 'weggegooid';
      const { error } = await supabase
        .from('outreach_concepts')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', conceptId)
        .in('status', ['voorstel', 'verouderd']);
      if (error) throw error;
      return ok({ ok: true, status }, corsHeaders);
    }

    // Regenerate a chase, check-in, code nudge or first mail from today's facts.
    if (action === 'concept_regenerate') {
      const missing = needId();
      if (missing) return missing;
      const { data: c, error } = await supabase.from('outreach_concepts').select('id, slug, soort, status').eq('id', conceptId).maybeSingle();
      if (error) throw error;
      if (!c) return errorResponse('Unknown concept', 404, corsHeaders);
      if (c.soort === 'reply') {
        return errorResponse('Regenerate works for chases, check-ins and first mails. Edit a reply by hand.', 400, corsHeaders);
      }
      const back = await unscheduleConcept(supabase, conceptId);
      if (!back) return errorResponse('Too late: this mail is already on its way.', 409, corsHeaders);
      await supabase.from('outreach_concepts').update({ status: 'weggegooid', updated_at: new Date().toISOString() }).eq('id', conceptId);
      const result = await runPrepare(supabase, new Date(), c.slug as string, { regenerate: true });
      return ok({ ok: true, result }, corsHeaders);
    }

    // "Prepare more": the 07:30 run, now.
    if (action === 'prepare_now') {
      const result = await runPrepare(supabase);
      return ok({ ok: true, result }, corsHeaders);
    }

    // The auto-approve switch. Off = every concept waits for Sjoerd.
    if (action === 'auto_toggle') {
      const on = Boolean(body.on);
      const { data, error } = await supabase
        .from('outreach_send_state')
        .update({ auto_goedkeuren: on, updated_at: new Date().toISOString() })
        .eq('id', true)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return ok({ state: data }, corsHeaders);
    }

    // A bounced address, corrected by hand.
    if (action === 'fix_email') {
      const slug = String(body.slug ?? '').trim();
      const email = String(body.to_email ?? '').trim().toLowerCase();
      if (!slug || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return errorResponse('slug and a valid to_email required', 400, corsHeaders);
      }
      const { data, error } = await supabase
        .from('outreach_prospects')
        .update({ to_email: email, email_ongeldig_op: null, updated_at: new Date().toISOString() })
        .eq('slug', slug)
        .select('slug, to_email, email_ongeldig_op')
        .maybeSingle();
      if (error) throw error;
      if (!data) return errorResponse('Unknown prospect', 404, corsHeaders);
      return ok({ prospect: data }, corsHeaders);
    }

    // After Send's Undo window: wake WF12 now instead of at the next cron minute.
    if (action === 'knock') {
      const secret = Deno.env.get('N8N_SHARED_SECRET');
      if (!secret) return errorResponse('Shared secret not configured', 503, corsHeaders);
      // The browser's countdown and the server clock can disagree by a second.
      // A knock before the row's niet_voor claims nothing, and outside the
      // pg_cron hours no later tick would pick it up, so wait it out here.
      const { data: pending } = await supabase
        .from('outreach_send_queue')
        .select('niet_voor')
        .eq('status', 'queued')
        .eq('direct', true)
        .order('niet_voor', { ascending: true })
        .limit(1)
        .maybeSingle();
      const waitMs = pending?.niet_voor ? Date.parse(pending.niet_voor as string) - Date.now() + 1000 : 0;
      if (waitMs > 0 && waitMs < 30_000) await new Promise((r) => setTimeout(r, waitMs));
      const r = await fetch(WF12_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-shared-secret': secret },
        body: JSON.stringify({ due_at: new Date().toISOString(), reason: 'send_now' }),
        signal: AbortSignal.timeout(10_000),
      }).catch((e) => {
        console.error('[ops-outreach] knock failed', e);
        return null;
      });
      return ok({ ok: Boolean(r?.ok), status: r?.status ?? null }, corsHeaders);
    }

    // ── Push notifications ──────────────────────────────────────────────────
    if (action === 'vapid_public_key') {
      return ok({ key: await vapidPublicKey() }, corsHeaders);
    }

    if (action === 'push_subscribe') {
      const sub = (body.subscription ?? {}) as Json;
      const keys = (sub.keys ?? {}) as Json;
      const endpoint = String(sub.endpoint ?? '');
      if (!endpoint.startsWith('https://') || !keys.p256dh || !keys.auth) {
        return errorResponse('A browser push subscription (endpoint + keys) is required', 400, corsHeaders);
      }
      const { error } = await supabase.from('ops_push_subscriptions').upsert(
        {
          endpoint,
          p256dh: String(keys.p256dh),
          auth: String(keys.auth),
          user_email: authed.email,
          failed_count: 0,
        },
        { onConflict: 'endpoint' },
      );
      if (error) throw error;
      return ok({ ok: true }, corsHeaders);
    }

    if (action === 'push_unsubscribe') {
      const endpoint = String(body.endpoint ?? '');
      if (!endpoint) return errorResponse('endpoint required', 400, corsHeaders);
      const { error } = await supabase.from('ops_push_subscriptions').delete().eq('endpoint', endpoint);
      if (error) throw error;
      return ok({ ok: true }, corsHeaders);
    }

    if (action === 'push_test') {
      const delivered = await sendToAll(supabase, {
        title: 'Cairnly outreach',
        body: 'Notifications work. You will hear from here when a reply needs you.',
        url: OPS_OUTREACH_URL,
        tag: 'test',
      });
      return ok({ ok: delivered > 0, delivered }, corsHeaders);
    }

    return errorResponse(`Unknown action: ${action}`, 400, corsHeaders);
  } catch (e) {
    console.error('[ops-outreach] error:', e);
    const message = e instanceof Error ? e.message : 'Unexpected error';
    return errorResponse(message, 500, corsHeaders);
  }
});
