// ops-employers — the employers channel in the Ops console (Tasha's pipeline).
//
// Add an employer, mint a trial code for the HR prospect or a batch of seat
// codes for their employees, move the lead along, and see how far the codes
// got. Admin-gated, all writes via the service role. See
// supabase/migrations/20261006130000_employers.sql for why employers are not
// partners.
//
// Actions: list | save | mint | delete
//          contact_save | contact_delete | event_save | event_delete
//          touch_log | touch_delete | follow_up_set
//          signal_save | signal_delete | bulk_set | hitlist_import
//          suppress | unsuppress
//
// The hitlist (cold outreach to HR buyers) lives in the same tables, with ICP
// fields, signals and a suggested tier: see
// supabase/migrations/20261015150000_employer_hitlist.sql. Nothing here sends
// mail. Outbound touches to anyone on the global do-not-contact list
// (outreach_suppressions) are refused.
//
// The outreach log (contacts, events, touches, follow_up_on) is filled by hand:
// see supabase/migrations/20261008120000_employer_outreach.sql.
//
// `list` also returns the clicks on "Get a trial code" on /employers. That
// button is a mailto to Tasha, so a click is the most we can see: whether the
// visitor then actually sent the mail is invisible to us.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  getCorsHeaders,
  handleCorsPreFlight,
  errorResponse,
  getAuthenticatedUser,
} from '../_shared/cors.ts';
import { isAdminEmail } from '../_shared/admins.ts';
import { emailDomain, isFreeMailDomain, isWorkEmail, normDomain, normLinkedin } from '../_shared/workEmail.ts';

const SITE = 'https://cairnly.io';

const STATUSES = new Set(['prospect', 'lead', 'trial_sent', 'in_talks', 'customer', 'lost']);
const COUNTRIES = new Set(['NL', 'UK']);
const SIZE_BANDS = new Set(['lt100', '100_249', '250_499', '500_999', '1000_plus']);
const SOURCES = new Set(['linkedin', 'news', 'event', 'referral', 'other']);
const TASHA_LINKS = new Set(['unchecked', 'none', 'first', 'second']);
const ROLE_TYPES = new Set(['buyer', 'champion', 'other']);
const SIGNAL_KINDS = new Set(['reorg', 'new_hr_lead', 'ld_job_ad', 'cao_budget']);
const TIERS = new Set(['A', 'B', 'C']);
/** Touches that reach out; replies and meetings may always be logged. */
const OUTBOUND = new Set(['first_contact', 'follow_up']);
/** Most companies one import may add. */
const IMPORT_MAX = 500;
const KINDS = new Set(['trial', 'seat']);
const CHANNELS = new Set(['linkedin', 'event', 'email', 'phone', 'other']);
const TOUCH_KINDS = new Set(['first_contact', 'follow_up', 'reply', 'meeting']);
const LINKEDIN_STAGES = ['none', 'invite_sent', 'connected', 'in_conversation'] as const;
/** First time a contact reaches a stage, this column is stamped. */
const STAGE_STAMP: Record<string, string> = {
  invite_sent: 'invite_sent_at',
  connected: 'connected_at',
  in_conversation: 'conversation_at',
};
/** How far back `list` sends touches; the stats never look further. */
const TOUCH_WINDOW_DAYS = 365;

/** cta_id the /employers trial button reports (EmployersSections.tsx). */
const TRIAL_CTA_ID = 'employers_trial_code';
const CLICK_WINDOW_DAYS = 90;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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

/** yyyy-mm-dd, `n` working days (Mon-Fri) after today. Mirrors addWorkingDays in EmployersTab. */
function workingDaysFromToday(n: number): string {
  const d = new Date();
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

/** A value from `allowed`, null for empty, 'bad' for anything else. */
const optEnum = (v: unknown, allowed: Set<string>): string | null | 'bad' => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v);
  return allowed.has(s) ? s : 'bad';
};

const optUrl = (v: unknown): string | null | 'bad' => {
  const s = optText(v, 500);
  if (!s) return null;
  return /^https?:\/\/\S+$/i.test(s) ? s : 'bad';
};

/**
 * Is this contact (or, without one, this company) on the do-not-contact list?
 * Checks the person's email and LinkedIn, their email's domain, and the
 * company's domain. Throws when the check itself fails: no answer is no go.
 */
async function isBlocked(
  db: SupabaseClient,
  employerId: string,
  contactId: string | null,
  /** Email / LinkedIn about to be saved, not in the row yet. */
  pending: { email?: unknown; linkedin?: unknown } = {},
): Promise<boolean> {
  const checks: Array<{ p_email: string | null; p_linkedin: string | null }> = [];
  if (pending.email || pending.linkedin) {
    checks.push({ p_email: (pending.email as string) ?? null, p_linkedin: (pending.linkedin as string) ?? null });
  }
  const { data: emp, error: empErr } = await db.from('employers').select('domain').eq('id', employerId).maybeSingle();
  if (empErr) throw empErr;
  if (emp?.domain) checks.push({ p_email: `x@${emp.domain}`, p_linkedin: null });
  if (contactId) {
    const { data: c, error } = await db
      .from('employer_contacts')
      .select('email, linkedin_url')
      .eq('id', contactId)
      .maybeSingle();
    if (error) throw error;
    if (c) checks.push({ p_email: c.email as string | null, p_linkedin: c.linkedin_url as string | null });
  }
  for (const args of checks) {
    const { data, error } = await db.rpc('outreach_is_suppressed', args);
    if (error) throw error;
    if (data === true) return true;
  }
  return false;
}

const optDate = (v: unknown): string | null | 'bad' => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v);
  return DATE_RE.test(s) && !Number.isNaN(Date.parse(s)) ? s : 'bad';
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
      const touchSince = new Date(Date.now() - TOUCH_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
      const [
        { data: rows, error: rowsErr },
        { data: stats, error: statsErr },
        { data: clicks, error: clicksErr },
        { data: contacts, error: contactsErr },
        { data: events, error: eventsErr },
        { data: touches, error: touchesErr },
        { data: hitlist, error: hitlistErr },
        { data: signals, error: signalsErr },
        { data: suppressions, error: suppErr },
      ] =
        await Promise.all([
          supabase
            .from('employers')
            .select('id, name, contact_name, contact_email, status, notes, follow_up_on, created_by, created_at, updated_at, country, size_band, sector, website, domain, source, source_url, frontline, tasha_link, tier_override')
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
          supabase.from('employer_contacts').select('*').order('created_at', { ascending: true }),
          supabase.from('employer_events').select('*').order('event_date', { ascending: false, nullsFirst: false }),
          supabase
            .from('employer_touches')
            .select('*')
            .gte('touched_on', touchSince)
            .order('touched_on', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase.from('employer_hitlist').select('*'),
          supabase.from('employer_signals_status').select('*').order('signal_date', { ascending: false }),
          supabase.from('outreach_suppressions').select('*').order('created_at', { ascending: false }),
        ]);
      if (rowsErr) throw rowsErr;
      if (hitlistErr) throw hitlistErr;
      if (signalsErr) throw signalsErr;
      if (suppErr) throw suppErr;
      if (statsErr) throw statsErr;
      if (clicksErr) throw clicksErr;
      if (contactsErr) throw contactsErr;
      if (eventsErr) throw eventsErr;
      if (touchesErr) throw touchesErr;

      const byId = new Map((stats ?? []).map((s) => [s.employer_id as string, s]));
      const employers = (rows ?? []).map((r) => ({ ...r, ...(byId.get(r.id as string) ?? {}) }));
      return ok({
        employers,
        trialClicks: clicks ?? [],
        clickWindowDays: CLICK_WINDOW_DAYS,
        contacts: contacts ?? [],
        events: events ?? [],
        touches: touches ?? [],
        hitlist: hitlist ?? [],
        signals: signals ?? [],
        suppressions: suppressions ?? [],
      }, corsHeaders);
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

      const fields: Json = {
        name,
        status,
        notes: optText(body.notes, 4000),
        updated_at: new Date().toISOString(),
      };
      // The single-contact columns are superseded by employer_contacts; only
      // touch them when a (older) client still sends them.
      if ('contactName' in body) fields.contact_name = optText(body.contactName, 120);
      if ('contactEmail' in body) fields.contact_email = contactEmail?.toLowerCase() ?? null;

      // Hitlist fields: only touched when the client sends them, so the
      // pipeline's own form (name / status / notes) leaves them alone.
      const enumFields: Array<[string, string, Set<string>]> = [
        ['country', 'country', COUNTRIES],
        ['sizeBand', 'size_band', SIZE_BANDS],
        ['source', 'source', SOURCES],
        ['tashaLink', 'tasha_link', TASHA_LINKS],
        ['tierOverride', 'tier_override', TIERS],
      ];
      for (const [key, col, allowed] of enumFields) {
        if (!(key in body)) continue;
        const v = optEnum(body[key], allowed);
        if (v === 'bad') return errorResponse(`Unknown ${key}.`, 400, corsHeaders);
        if (col === 'tasha_link') fields[col] = v ?? 'unchecked';
        else fields[col] = v;
      }
      if ('sector' in body) fields.sector = optText(body.sector, 120);
      if ('frontline' in body) fields.frontline = Boolean(body.frontline);
      if ('sourceUrl' in body) {
        const u = optUrl(body.sourceUrl);
        if (u === 'bad') return errorResponse('The source link should start with https://', 400, corsHeaders);
        fields.source_url = u;
      }
      if ('website' in body) {
        const w = optText(body.website, 300);
        const d = normDomain(w);
        if (w && !d) return errorResponse('That website does not look right.', 400, corsHeaders);
        fields.website = w;
        fields.domain = d;
      }

      if (id) {
        const { data, error } = await supabase.from('employers').update(fields).eq('id', id).select('id');
        if (error?.code === '23505') return errorResponse('Another company already has that website.', 409, corsHeaders);
        if (error) throw error;
        if (!data || data.length === 0) return errorResponse('Unknown employer.', 404, corsHeaders);
        return ok({ id }, corsHeaders);
      }

      const { data, error } = await supabase
        .from('employers')
        .insert({ ...fields, created_by: authed.email ?? null })
        .select('id')
        .single();
      if (error?.code === '23505') return errorResponse('Another company already has that website.', 409, corsHeaders);
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

    // ── contact_save (create, or update when contactId is given) ─────────────
    // A move to a further LinkedIn stage stamps that stage the first time. An
    // invite going out also logs a LinkedIn touch (it IS reaching out) and sets
    // a follow-up date if none is pending, so Tasha does not log it twice.
    if (action === 'contact_save') {
      const contactId = body.contactId ? String(body.contactId) : null;
      const employerId = String(body.employerId ?? '');
      if (contactId && !UUID_RE.test(contactId)) return errorResponse('Unknown contact.', 400, corsHeaders);
      if (!contactId && !UUID_RE.test(employerId)) return errorResponse('Unknown employer.', 400, corsHeaders);

      const fields: Json = { updated_at: new Date().toISOString() };
      if ('name' in body) {
        const name = String(body.name ?? '').trim();
        if (!name || name.length > 120) return errorResponse('A contact needs a name.', 400, corsHeaders);
        fields.name = name;
      }
      if ('role' in body) fields.role = optText(body.role, 120);
      if ('email' in body) {
        const email = optText(body.email, 200);
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return errorResponse('That email does not look right.', 400, corsHeaders);
        }
        if (email && !isWorkEmail(email)) {
          return errorResponse('Work addresses only: that is a personal mailbox.', 400, corsHeaders);
        }
        fields.email = email?.toLowerCase() ?? null;
      }
      if ('linkedinUrl' in body) {
        const url = optText(body.linkedinUrl, 300);
        if (url && !/^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(url)) {
          return errorResponse('That LinkedIn link should start with https://www.linkedin.com/', 400, corsHeaders);
        }
        fields.linkedin_url = url;
      }
      if ('roleType' in body) {
        const v = optEnum(body.roleType, ROLE_TYPES);
        if (v === 'bad') return errorResponse('Unknown role type.', 400, corsHeaders);
        fields.role_type = v;
      }
      if ('contactSource' in body) fields.contact_source = optText(body.contactSource, 200);
      if ('tashaLink' in body) {
        const v = optEnum(body.tashaLink, TASHA_LINKS);
        if (v === 'bad') return errorResponse('Unknown Tasha link.', 400, corsHeaders);
        fields.tasha_link = v ?? 'unchecked';
      }

      let prev: { employer_id: string; linkedin_stage: string; invite_sent_at: string | null; connected_at: string | null; conversation_at: string | null } | null = null;
      if (contactId) {
        const { data, error } = await supabase
          .from('employer_contacts')
          .select('employer_id, linkedin_stage, invite_sent_at, connected_at, conversation_at')
          .eq('id', contactId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return errorResponse('Unknown contact.', 404, corsHeaders);
        prev = data;
      } else if (!('name' in body)) {
        return errorResponse('A contact needs a name.', 400, corsHeaders);
      }

      let inviteNow = false;
      if ('linkedinStage' in body) {
        const stage = String(body.linkedinStage);
        if (!(LINKEDIN_STAGES as readonly string[]).includes(stage)) {
          return errorResponse('Unknown LinkedIn stage.', 400, corsHeaders);
        }
        fields.linkedin_stage = stage;
        // Stamp this stage and any skipped earlier one, first time only.
        const reached = LINKEDIN_STAGES.indexOf(stage as typeof LINKEDIN_STAGES[number]);
        const now = new Date().toISOString();
        for (const st of LINKEDIN_STAGES.slice(1, reached + 1)) {
          const col = STAGE_STAMP[st];
          if (!prev || !(prev as Record<string, unknown>)[col]) fields[col] = now;
        }
        inviteNow = stage === 'invite_sent' && !prev?.invite_sent_at;
      }

      // An invite is reaching out: not to someone who said no.
      if (inviteNow && await isBlocked(supabase, prev?.employer_id ?? employerId, contactId, {
        email: fields.email, linkedin: fields.linkedin_url,
      })) {
        return errorResponse('This person or company is on the do-not-contact list.', 409, corsHeaders);
      }

      let id = contactId;
      const empId = prev?.employer_id ?? employerId;
      if (contactId) {
        const { error } = await supabase.from('employer_contacts').update(fields).eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('employer_contacts')
          .insert({ ...fields, employer_id: employerId })
          .select('id')
          .single();
        if (error) throw error;
        id = data.id;
      }

      if (inviteNow) {
        const { count } = await supabase
          .from('employer_touches')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', id);
        await supabase.from('employer_touches').insert({
          employer_id: empId,
          contact_id: id,
          channel: 'linkedin',
          kind: (count ?? 0) > 0 ? 'follow_up' : 'first_contact',
          note: 'LinkedIn invite sent',
          created_by: authed.email ?? null,
        });
        const today = new Date().toISOString().slice(0, 10);
        await supabase
          .from('employers')
          .update({ follow_up_on: workingDaysFromToday(5) })
          .eq('id', empId)
          .or(`follow_up_on.is.null,follow_up_on.lt.${today}`);
      }
      await supabase.from('employers').update({ updated_at: new Date().toISOString() }).eq('id', empId);
      return ok({ id, touchLogged: inviteNow }, corsHeaders);
    }

    if (action === 'contact_delete') {
      const contactId = String(body.contactId ?? '');
      if (!UUID_RE.test(contactId)) return errorResponse('Unknown contact.', 400, corsHeaders);
      const { error } = await supabase.from('employer_contacts').delete().eq('id', contactId);
      if (error) throw error;
      return ok({ ok: true }, corsHeaders);
    }

    // ── events (the pick-list) ──────────────────────────────────────────────
    if (action === 'event_save') {
      const name = String(body.name ?? '').trim();
      if (!name || name.length > 120) return errorResponse('An event needs a name.', 400, corsHeaders);
      const date = optDate(body.eventDate);
      if (date === 'bad') return errorResponse('That event date does not look right.', 400, corsHeaders);
      const { data, error } = await supabase
        .from('employer_events')
        .insert({ name, event_date: date })
        .select('id')
        .single();
      if (error) throw error;
      return ok({ id: data.id }, corsHeaders);
    }

    // Touches logged at the event keep their row; they just lose the event name.
    if (action === 'event_delete') {
      const eventId = String(body.eventId ?? '');
      if (!UUID_RE.test(eventId)) return errorResponse('Unknown event.', 400, corsHeaders);
      const { error } = await supabase.from('employer_events').delete().eq('id', eventId);
      if (error) throw error;
      return ok({ ok: true }, corsHeaders);
    }

    // ── touch_log ───────────────────────────────────────────────────────────
    // followUpOn is what the form shows (pre-filled with a suggestion, editable):
    // a date sets the next chase, null clears it, absent leaves it alone.
    if (action === 'touch_log') {
      const employerId = String(body.employerId ?? '');
      if (!UUID_RE.test(employerId)) return errorResponse('Unknown employer.', 400, corsHeaders);
      const channel = String(body.channel ?? '');
      const kind = String(body.kind ?? '');
      if (!CHANNELS.has(channel)) return errorResponse('Unknown channel.', 400, corsHeaders);
      if (!TOUCH_KINDS.has(kind)) return errorResponse('Unknown touch type.', 400, corsHeaders);
      const contactId = body.contactId ? String(body.contactId) : null;
      if (contactId && !UUID_RE.test(contactId)) return errorResponse('Unknown contact.', 400, corsHeaders);
      const eventId = body.eventId ? String(body.eventId) : null;
      if (eventId && !UUID_RE.test(eventId)) return errorResponse('Unknown event.', 400, corsHeaders);
      const touchedOn = optDate(body.touchedOn);
      if (touchedOn === 'bad') return errorResponse('That date does not look right.', 400, corsHeaders);
      const followUpOn = optDate(body.followUpOn);
      if (followUpOn === 'bad') return errorResponse('That follow-up date does not look right.', 400, corsHeaders);

      // Logging is by hand, but a block is a block: no reaching out to
      // someone on the do-not-contact list. Their reply can still be logged.
      if (OUTBOUND.has(kind) && await isBlocked(supabase, employerId, contactId)) {
        return errorResponse('This person or company is on the do-not-contact list.', 409, corsHeaders);
      }

      const { data, error } = await supabase
        .from('employer_touches')
        .insert({
          employer_id: employerId,
          contact_id: contactId,
          channel,
          kind,
          event_id: eventId,
          ...(touchedOn ? { touched_on: touchedOn } : {}),
          note: optText(body.note, 1000),
          created_by: authed.email ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const upd: Json = { updated_at: new Date().toISOString() };
      if ('followUpOn' in body) upd.follow_up_on = followUpOn;
      await supabase.from('employers').update(upd).eq('id', employerId);
      // First reach-out moves a hitlist company into the pipeline.
      if (OUTBOUND.has(kind)) {
        await supabase.from('employers').update({ status: 'lead' }).eq('id', employerId).eq('status', 'prospect');
      }
      return ok({ id: data.id }, corsHeaders);
    }

    if (action === 'touch_delete') {
      const touchId = String(body.touchId ?? '');
      if (!UUID_RE.test(touchId)) return errorResponse('Unknown touch.', 400, corsHeaders);
      const { error } = await supabase.from('employer_touches').delete().eq('id', touchId);
      if (error) throw error;
      return ok({ ok: true }, corsHeaders);
    }

    if (action === 'follow_up_set') {
      const employerId = String(body.employerId ?? '');
      if (!UUID_RE.test(employerId)) return errorResponse('Unknown employer.', 400, corsHeaders);
      const followUpOn = optDate(body.followUpOn);
      if (followUpOn === 'bad') return errorResponse('That follow-up date does not look right.', 400, corsHeaders);
      const { error } = await supabase.from('employers').update({ follow_up_on: followUpOn }).eq('id', employerId);
      if (error) throw error;
      return ok({ ok: true }, corsHeaders);
    }

    // ── signals ─────────────────────────────────────────────────────────────
    if (action === 'signal_save') {
      const employerId = String(body.employerId ?? '');
      if (!UUID_RE.test(employerId)) return errorResponse('Unknown employer.', 400, corsHeaders);
      const kind = String(body.kind ?? '');
      if (!SIGNAL_KINDS.has(kind)) return errorResponse('Unknown signal type.', 400, corsHeaders);
      const date = optDate(body.signalDate);
      if (!date || date === 'bad') return errorResponse('A signal needs a date.', 400, corsHeaders);
      const url = optUrl(body.sourceUrl);
      if (!url || url === 'bad') return errorResponse('A signal needs a source link starting with https://', 400, corsHeaders);
      const { data, error } = await supabase
        .from('employer_signals')
        .insert({ employer_id: employerId, kind, signal_date: date, source_url: url, note: optText(body.note, 500), created_by: authed.email ?? null })
        .select('id')
        .single();
      if (error) throw error;
      await supabase.from('employers').update({ updated_at: new Date().toISOString() }).eq('id', employerId);
      return ok({ id: data.id }, corsHeaders);
    }

    if (action === 'signal_delete') {
      const signalId = String(body.signalId ?? '');
      if (!UUID_RE.test(signalId)) return errorResponse('Unknown signal.', 400, corsHeaders);
      const { error } = await supabase.from('employer_signals').delete().eq('id', signalId);
      if (error) throw error;
      return ok({ ok: true }, corsHeaders);
    }

    // ── bulk_set ────────────────────────────────────────────────────────────
    // Tasha's cross-check and tier overrides for many companies at once.
    if (action === 'bulk_set') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      if (ids.length === 0 || ids.length > IMPORT_MAX || !ids.every((i: string) => UUID_RE.test(i))) {
        return errorResponse('Pick at least one company.', 400, corsHeaders);
      }
      const fields: Json = { updated_at: new Date().toISOString() };
      if ('tashaLink' in body) {
        const v = optEnum(body.tashaLink, TASHA_LINKS);
        if (!v || v === 'bad') return errorResponse('Unknown Tasha link.', 400, corsHeaders);
        fields.tasha_link = v;
      }
      if ('tierOverride' in body) {
        const v = optEnum(body.tierOverride, TIERS);
        if (v === 'bad') return errorResponse('Unknown tier.', 400, corsHeaders);
        fields.tier_override = v;
      }
      if (Object.keys(fields).length === 1) return errorResponse('Nothing to change.', 400, corsHeaders);
      const { data, error } = await supabase.from('employers').update(fields).in('id', ids).select('id');
      if (error) throw error;
      return ok({ updated: data?.length ?? 0 }, corsHeaders);
    }

    // ── suppress / unsuppress ───────────────────────────────────────────────
    // scope 'person' blocks the contact's email and LinkedIn profile (one row
    // each). scope 'company' blocks the domain: the company's website, else
    // the contact's work address. Either one also closes any bureau on that
    // address in the outplacement mailer (trigger in the migration).
    if (action === 'suppress') {
      const scope = String(body.scope ?? '');
      if (scope !== 'person' && scope !== 'company') return errorResponse('Unknown scope.', 400, corsHeaders);
      const contactId = body.contactId ? String(body.contactId) : null;
      let employerId = body.employerId ? String(body.employerId) : null;
      if (contactId && !UUID_RE.test(contactId)) return errorResponse('Unknown contact.', 400, corsHeaders);
      if (employerId && !UUID_RE.test(employerId)) return errorResponse('Unknown employer.', 400, corsHeaders);

      let contact: { employer_id: string; email: string | null; linkedin_url: string | null } | null = null;
      if (contactId) {
        const { data, error } = await supabase
          .from('employer_contacts')
          .select('employer_id, email, linkedin_url')
          .eq('id', contactId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return errorResponse('Unknown contact.', 404, corsHeaders);
        contact = data;
        employerId = data.employer_id;
      }
      if (!employerId) return errorResponse('Unknown employer.', 400, corsHeaders);

      const base = {
        reason: optText(body.reason, 300),
        track: 'employer',
        employer_id: employerId,
        contact_id: contactId,
        created_by: authed.email ?? null,
      };
      const rows: Json[] = [];
      if (scope === 'person') {
        if (!contact) return errorResponse('Pick a contact to block.', 400, corsHeaders);
        if (contact.email) rows.push({ ...base, email: contact.email.toLowerCase() });
        const li = normLinkedin(contact.linkedin_url);
        if (li) rows.push({ ...base, linkedin: li });
        if (rows.length === 0) {
          return errorResponse('This contact has no email or LinkedIn profile to block. Add one, or block the whole company.', 400, corsHeaders);
        }
      } else {
        const { data: emp, error } = await supabase.from('employers').select('domain').eq('id', employerId).maybeSingle();
        if (error) throw error;
        const domain = emp?.domain ?? emailDomain(contact?.email);
        if (!domain) return errorResponse('No website or work address to block the company by. Add the website first.', 400, corsHeaders);
        if (isFreeMailDomain(domain)) return errorResponse(`${domain} is a personal mail provider, not a company.`, 400, corsHeaders);
        rows.push({ ...base, domain });
      }
      // Already blocked is fine: a unique-key clash (23505) is a repeat, not an error.
      for (const row of rows) {
        const { error } = await supabase.from('outreach_suppressions').insert(row);
        if (error && error.code !== '23505') throw error;
      }

      // Nobody chases a company that said no.
      if (scope === 'company') {
        await supabase.from('employers').update({ follow_up_on: null, updated_at: new Date().toISOString() }).eq('id', employerId);
      }
      return ok({ ok: true, blocked: rows.length }, corsHeaders);
    }

    // Undo for a wrong click. Bureaus it closed stay closed: reopening one is
    // a call for the Outreach tab, not a side effect of this.
    if (action === 'unsuppress') {
      const id = String(body.suppressionId ?? '');
      if (!UUID_RE.test(id)) return errorResponse('Unknown entry.', 400, corsHeaders);
      const { error } = await supabase.from('outreach_suppressions').delete().eq('id', id);
      if (error) throw error;
      return ok({ ok: true }, corsHeaders);
    }

    // ── hitlist_import ──────────────────────────────────────────────────────
    // Companies parsed in the browser (src/lib/hitlist.ts planImport). Checked
    // again here. A company whose domain (or, without one, name) already
    // exists gets only its new contacts; contacts whose email or LinkedIn is
    // already known are skipped.
    if (action === 'hitlist_import') {
      const companies = Array.isArray(body.companies) ? body.companies as Json[] : [];
      if (companies.length === 0) return errorResponse('Nothing to import.', 400, corsHeaders);
      if (companies.length > IMPORT_MAX) return errorResponse(`At most ${IMPORT_MAX} companies per import.`, 400, corsHeaders);

      const [{ data: existing, error: exErr }, { data: known, error: knErr }] = await Promise.all([
        supabase.from('employers').select('id, name, domain'),
        supabase.from('employer_contacts').select('email, linkedin_url'),
      ]);
      if (exErr) throw exErr;
      if (knErr) throw knErr;
      const byDomain = new Map((existing ?? []).filter((e) => e.domain).map((e) => [e.domain as string, e.id as string]));
      const byName = new Map((existing ?? []).map((e) => [String(e.name).trim().toLowerCase(), e.id as string]));
      const knownEmails = new Set((known ?? []).map((c) => (c.email ?? '').toLowerCase()).filter(Boolean));
      const knownLinkedin = new Set((known ?? []).map((c) => normLinkedin(c.linkedin_url)).filter(Boolean) as string[]);

      let added = 0;
      let matched = 0;
      let contactsAdded = 0;
      const skipped: string[] = [];

      for (const c of companies) {
        const name = String(c.name ?? '').trim().slice(0, 80);
        if (!name) { skipped.push('A company without a name.'); continue; }
        const domain = normDomain(c.domain as string) ?? normDomain(c.website as string);
        const country = optEnum(c.country, COUNTRIES);
        const size = optEnum(c.size_band, SIZE_BANDS);
        const source = optEnum(c.source, SOURCES);
        const sourceUrl = optUrl(c.source_url);

        let employerId = (domain && byDomain.get(domain)) || byName.get(name.toLowerCase()) || null;
        if (employerId) {
          matched++;
        } else {
          const { data, error } = await supabase
            .from('employers')
            .insert({
              name,
              status: 'prospect',
              country: country === 'bad' ? null : country,
              size_band: size === 'bad' ? null : size,
              sector: optText(c.sector, 120),
              website: optText(c.website, 300),
              domain,
              source: source === 'bad' ? null : source,
              source_url: sourceUrl === 'bad' ? null : sourceUrl,
              notes: optText(c.notes, 4000),
              created_by: authed.email ?? null,
            })
            .select('id')
            .single();
          if (error) { skipped.push(`${name}: ${error.message}`); continue; }
          employerId = data.id as string;
          added++;
          if (domain) byDomain.set(domain, employerId);
          byName.set(name.toLowerCase(), employerId);
        }

        const contacts = Array.isArray(c.contacts) ? c.contacts as Json[] : [];
        for (const p of contacts) {
          const cName = String(p.name ?? '').trim().slice(0, 120);
          const email = optText(p.email, 200)?.toLowerCase() ?? null;
          const linkedin = optText(p.linkedin_url, 300);
          const li = normLinkedin(linkedin);
          const source = optText(p.contact_source, 200);
          if (!cName) continue;
          if (!source) { skipped.push(`${cName} (${name}): no contact source.`); continue; }
          if (email && !isWorkEmail(email)) { skipped.push(`${cName} (${name}): ${email} is not a work address.`); continue; }
          if ((email && knownEmails.has(email)) || (li && knownLinkedin.has(li))) continue;
          const role = optEnum(p.role_type, ROLE_TYPES);
          const { error } = await supabase.from('employer_contacts').insert({
            employer_id: employerId,
            name: cName,
            role: optText(p.title, 120),
            role_type: role === 'bad' ? null : role,
            email,
            linkedin_url: li ? linkedin : null,
            contact_source: source,
          });
          if (error) { skipped.push(`${cName} (${name}): ${error.message}`); continue; }
          contactsAdded++;
          if (email) knownEmails.add(email);
          if (li) knownLinkedin.add(li);
        }
      }
      return ok({ added, matched, contactsAdded, skipped }, corsHeaders);
    }

    return errorResponse('Unknown action', 400, corsHeaders);
  } catch (e) {
    console.error('[ops-employers]', action, e);
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Server error';
    return errorResponse(message, 500, corsHeaders);
  }
});
