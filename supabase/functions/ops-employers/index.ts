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
//
// The outreach log (contacts, events, touches, follow_up_on) is filled by hand:
// see supabase/migrations/20261008120000_employer_outreach.sql.
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
      ] =
        await Promise.all([
          supabase
            .from('employers')
            .select('id, name, contact_name, contact_email, status, notes, follow_up_on, created_by, created_at, updated_at')
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
        ]);
      if (rowsErr) throw rowsErr;
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
        fields.email = email?.toLowerCase() ?? null;
      }
      if ('linkedinUrl' in body) {
        const url = optText(body.linkedinUrl, 300);
        if (url && !/^https?:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(url)) {
          return errorResponse('That LinkedIn link should start with https://www.linkedin.com/', 400, corsHeaders);
        }
        fields.linkedin_url = url;
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

    return errorResponse('Unknown action', 400, corsHeaders);
  } catch (e) {
    console.error('[ops-employers]', action, e);
    const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Server error';
    return errorResponse(message, 500, corsHeaders);
  }
});
