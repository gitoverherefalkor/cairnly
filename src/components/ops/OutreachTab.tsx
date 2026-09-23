// OutreachTab — who opened the demo, per agency.
//
// Phase 2 of the outreach dashboard: first-party click tracking on the
// partner demo, read back here. Everything comes through the admin-gated
// ops-outreach edge function; the browser never touches the outreach tables.
//
// Deliberately small (see docs/handoff/cairnly-ops-outreach-fase2-prompt.md):
// four counters, one table, two editable fields (status, notes), and a
// collapsed raw click log to sanity-check the bot filter.
//
// The table carries eight columns, not eleven: "sent", "first click" and "last
// click" were three date columns answering a question nobody asks of a row.
// The send date lives on the mail cell's tooltip and the click timestamps on
// the "Clicked?" cell's, which leaves every column that drives a decision
// visible at once without scrolling sideways.
//
// Clicks are counted CONFIRMED vs SUSPECT. A non-bot click within two minutes
// of the mail going out is a link scanner fetching the URL on delivery, not a
// person: enterprise mail security presents a real browser user-agent, so the
// bot list cannot see it and only the time since sending can. Suspect clicks
// stay visible everywhere, they just do not count as an open.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Building2, Mail, ArrowUpRight, ArrowDownLeft, Clock, PenLine, X, PauseCircle } from 'lucide-react';
import {
  FOLLOW_UP_1_WORKING_DAYS,
  FOLLOW_UP_2_WORKING_DAYS,
  CHECK_IN_WORKING_DAYS,
  FOCUS_LABELS,
  OUTREACH_STATUSES,
  STATUS_LABELS,
  SENTIMENT_LABELS,
  SUBJECT_VARIANTS,
  compareWorkFirst,
  followUp,
  followUpDraftState,
  isWarm,
  matchesFocus,
  type FollowUp,
  type FollowUpDraftState,
  type OutreachFocus,
  type OutreachMail,
  type OutreachProspect,
  type OutreachStatus,
} from '@/lib/outreach';

/** What the Outreach tab hands the Partners tab when "create partner" is clicked. */
export interface PartnerDraft {
  name: string;
  slug: string;
  prospectSlug: string;
}

interface Counters {
  prospects: number;
  prospects_with_click: number;
  clicks_today: number;
}

interface ClickRow {
  id: string;
  slug: string | null;
  campaign: string | null;
  persona: string | null;
  p: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  user_agent: string | null;
  referer: string | null;
  is_bot: boolean;
  /** Non-bot, but landed inside 2 minutes of the mail going out. */
  verdacht?: boolean;
  created_at: string;
}

interface QueueResponse {
  queued: Array<Pick<OutreachProspect, 'slug' | 'followup_requested_at' | 'followup_draft_id'>>;
  rejected: string[];
}

interface UpdateResponse {
  prospect: Pick<OutreachProspect, 'slug' | 'status' | 'notities' | 'updated_at'>;
}

interface DismissResponse {
  prospect: Pick<OutreachProspect, 'slug' | 'reply_dismissed_at'>;
}

interface SubjectStat {
  variant: 'a' | 'b';
  bureaus: number;
  verstuurd: number;
  met_klik: number;
  reacties: number;
  positieve_reacties: number;
  momenten_gemiddeld: number | null;
}

interface SendState {
  gepauzeerd: boolean;
  next_allowed_at: string | null;
  laatste_fout: string | null;
}

interface SendInfo {
  state: SendState | null;
  in_wachtrij: number;
  bezig: number;
  mislukt: number;
  vandaag_verzonden: number;
  recent: Array<{ id: string; slug: string; soort: string; status: string; sent_at: string | null; fout: string | null }>;
}

interface ListResponse {
  prospects: OutreachProspect[];
  counters: Counters;
  campaigns: string[];
  log: ClickRow[];
  subject_stats: SubjectStat[];
  send: SendInfo;
}

// ─── Shared styles (same language as MarketingTab / PartnersTab) ─────────────

const card =
  'rounded-[18px] border border-white/[0.08] bg-[rgba(18,46,59,0.55)] backdrop-blur-[14px] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.40)]';
const select =
  'bg-[#0E2531] border border-white/[0.14] rounded-lg px-2 py-1 text-xs text-white/[0.92] focus:outline-none focus:border-atlas-teal/60';
const label = "font-heading font-bold text-[11px] uppercase tracking-[0.16em] text-white/50";

const SENTIMENT_CLS: Record<string, string> = {
  positief: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  code: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  vraag: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  later: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  afwijzing: 'bg-red-500/15 text-red-300 border-red-500/40',
  auto: 'bg-white/10 text-white/70 border-white/20',
  overig: 'bg-white/10 text-white/80 border-white/20',
};

const TIER_CLS: Record<string, string> = {
  A: 'bg-atlas-teal/20 text-atlas-teal border-atlas-teal/40',
  B: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  C: 'bg-white/10 text-white/70 border-white/20',
};

function fmt(iso: string | null, withTime = false): string {
  if (!iso) return '-';
  // English console, Amsterdam clock.
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/Amsterdam',
    day: '2-digit',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** A due day (UTC-midnight stamp) as "Tue 15 Sep". */
function fmtDay(dayStamp: number): string {
  return new Date(dayStamp).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function callOutreach<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const r = await fetch(`${url}/functions/v1/ops-outreach`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error ?? `HTTP ${r.status}`);
  }
  return r.json();
}

// ─── One row ──────────────────────────────────────────────────────────────────

/**
 * The nudge, and the one-click way to act on it. Gold and loud once a chase is
 * due, quiet grey while the clock is still running, and once asked for, it
 * reports where the draft is. Nothing at all when chasing is not the move.
 */
function FollowUpBadge({
  fu,
  draftState,
  onDraft,
  queueing,
}: {
  fu: FollowUp | null;
  draftState: FollowUpDraftState;
  onDraft?: () => void;
  queueing?: boolean;
}) {
  const checkIn = fu?.kind === 'checkin';
  const what = checkIn ? 'Check-in' : `Follow-up ${fu?.step ?? ''}`.trim();

  if (draftState === 'ready') {
    return (
      <div>
        <span
          className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-atlas-teal/40 bg-atlas-teal/15 text-atlas-teal"
          title={
            checkIn
              ? 'The check-in is written and waiting in Gmail under Drafts. It is never sent on its own: read it, change what you want, send it.'
              : 'The follow-up is written and waiting in Gmail under Drafts. Read it, change what you want, send it.'
          }
        >
          <Mail className="h-3 w-3" /> {checkIn ? 'Check-in' : 'Follow-up'} draft in Gmail
        </span>
      </div>
    );
  }

  if (draftState === 'queued') {
    return (
      <div className="text-[11px] text-white/60 inline-flex items-center gap-1" title="Clicking wakes WF11 within a minute or two; it writes the draft into the Gmail thread.">
        <Clock className="h-3 w-3" /> Draft queued
      </div>
    );
  }

  if (!fu) return null;

  // Not due yet, but chasing early is Sjoerd's call to make, so the button is
  // here too, just quiet.
  if (!fu.due) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-white/45" title={`${what} is due ${fmtDay(fu.dueDay)}`}>
          {what} {fmtDay(fu.dueDay)}
        </span>
        {onDraft && (
          <button
            onClick={onDraft}
            disabled={queueing}
            className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/80 disabled:opacity-50"
            title="Draft it now anyway. The mail waits in Gmail until you send it."
          >
            {queueing ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
            Draft early
          </button>
        )}
      </div>
    );
  }

  const late = fu.daysLate === 0
    ? 'due today'
    : `${fu.daysLate} working day${fu.daysLate === 1 ? '' : 's'} late`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-atlas-gold/40 bg-atlas-gold/15 text-atlas-gold"
        title={
          checkIn
            ? `The check-in was due ${fmtDay(fu.dueDay)}: they said they would get back to you and went quiet.`
            : `Follow-up ${fu.step} was due ${fmtDay(fu.dueDay)}. Sending it moves the status by itself once WF11 picks the mail up.`
        }
      >
        <Clock className="h-3 w-3" /> {what}, {late}
      </span>
      {onDraft && (
        <button
          onClick={onDraft}
          disabled={queueing}
          className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-white/15 text-white/70 hover:text-white hover:border-atlas-gold/40 disabled:opacity-50"
          title={
            checkIn
              ? 'Write the check-in to whoever replied and put it in their Gmail thread as a draft. Never sent on its own.'
              : 'Write the follow-up for this agency and put it in the Gmail thread as a draft. Nothing is sent.'
          }
        >
          {queueing ? <Loader2 className="h-3 w-3 animate-spin" /> : <PenLine className="h-3 w-3" />}
          Draft it
        </button>
      )}
    </div>
  );
}

function ProspectRow({
  p,
  fu,
  onSaved,
  onCreatePartner,
  onDraftFollowUp,
  onReplyDismissed,
}: {
  p: OutreachProspect;
  /** The next chase for this agency, or null when chasing is not the move. */
  fu: FollowUp | null;
  onSaved: (patch: Pick<OutreachProspect, 'slug'> & Partial<OutreachProspect>) => void;
  onCreatePartner?: (draft: PartnerDraft) => void;
  onDraftFollowUp: (slug: string) => Promise<void>;
  /** A park (or its undo) went through; the page-level counts are now stale. */
  onReplyDismissed?: () => void;
}) {
  const [notes, setNotes] = useState(p.notities ?? '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showMails, setShowMails] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const draftState = followUpDraftState(p);

  // Park / undo. Only ever touches our own row: the Gmail thread,
  // and any reply draft waiting in it, stay exactly as they are.
  const dismissReply = async (undo: boolean) => {
    setDismissing(true);
    try {
      const res = await callOutreach<DismissResponse>({ action: 'dismiss_reply', slug: p.slug, undo });
      onSaved({
        slug: p.slug,
        reply_dismissed_at: res.prospect.reply_dismissed_at,
        reply_dismissed: !undo,
        needs_reply: undo,
      });
      onReplyDismissed?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setDismissing(false);
    }
  };
  const draftFollowUp = async () => {
    setQueueing(true);
    try {
      await onDraftFollowUp(p.slug);
    } finally {
      setQueueing(false);
    }
  };

  // Keep the local draft in step if a refresh brings newer notes in and the
  // field is not being edited.
  useEffect(() => {
    setNotes(p.notities ?? '');
  }, [p.notities]);

  const saveStatus = async (status: OutreachStatus) => {
    if (status === p.status) return;
    setSavingStatus(true);
    try {
      const res = await callOutreach<UpdateResponse>({ action: 'update', slug: p.slug, status });
      onSaved({ slug: p.slug, status: res.prospect.status });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Status not saved');
    } finally {
      setSavingStatus(false);
    }
  };

  const saveNotes = async () => {
    const next = notes.trim();
    if (next === (p.notities ?? '')) return;
    setSavingNotes(true);
    try {
      const res = await callOutreach<UpdateResponse>({ action: 'update', slug: p.slug, notities: next });
      onSaved({ slug: p.slug, notities: res.prospect.notities });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Note not saved');
    } finally {
      setSavingNotes(false);
    }
  };

  const warm = isWarm(p);
  const rowBg = p.needs_reply
    ? 'bg-atlas-gold/[0.07]'
    : fu?.due
      ? 'bg-atlas-gold/[0.035]'
      : warm
        ? 'bg-atlas-teal/[0.06]'
        : '';

  // "Clicked?" replaces the old first-click / last-click / count columns: the
  // question you actually ask of a row is whether anyone opened the demo, not
  // on which minute. The detail moves into the cell's tooltip.
  const clicked = p.kliks_bevestigd > 0;
  const scannerOnly = !clicked && p.kliks_verdacht > 0;
  const clickTitle = clicked
    ? [
        `First ${fmt(p.eerste_bevestigde_klik, true)}`,
        `last ${fmt(p.laatste_bevestigde_klik, true)}`,
        `${p.dagen_bevestigd} ${p.dagen_bevestigd === 1 ? 'day' : 'days'} with a confirmed click`,
        p.kliks_verdacht > 0 ? `${p.kliks_verdacht} more look like a scanner` : '',
        p.bot_kliks > 0 ? `${p.bot_kliks} bot click${p.bot_kliks === 1 ? '' : 's'} ignored` : '',
      ].filter(Boolean).join(' · ')
    : scannerOnly
      ? `${p.kliks_verdacht} click${p.kliks_verdacht === 1 ? '' : 's'} within 2 minutes of sending — almost certainly the mail server checking the link, not a person`
      : p.bot_kliks > 0
        ? `No confirmed clicks. ${p.bot_kliks} bot click${p.bot_kliks === 1 ? '' : 's'} ignored.`
        : 'No confirmed clicks yet';

  // Depth, the half of the story the click never told: did they look at the
  // demo for three seconds or read the whole conversation? null is "never
  // measured" and stays blank, because showing it as 0 would invent a bounce.
  const depth = p.momenten_max;
  const depthLabel = depth === null ? null : depth === 0 ? 'bounced' : `${depth}/7 read`;
  const depthTitle =
    depth === null
      ? 'No depth measured. Visits before 21 Sept 2026 did not carry the agency slug into analytics.'
      : [
          `${p.demo_sessies} demo session${p.demo_sessies === 1 ? '' : 's'}`,
          depth === 0
            ? 'nobody reached the first annotated moment'
            : `best session reached ${depth} of the seven moments`,
          p.sessies_met_cta > 0 ? `${p.sessies_met_cta} clicked a CTA` : '',
        ].filter(Boolean).join(' \u00b7 ');

  return (
    <>
    <tr className={`border-t border-white/[0.06] align-top ${rowBg}`}>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {p.needs_reply ? (
            <span className="h-1.5 w-1.5 rounded-full bg-atlas-gold shrink-0" title="They wrote last — you're up" />
          ) : warm ? (
            <span className="h-1.5 w-1.5 rounded-full bg-atlas-teal shrink-0" title="Opened the demo, not followed up yet" />
          ) : null}
          <span className="text-sm text-white/[0.92]">{p.naam ?? p.slug}</span>
        </div>
        <div className="text-[11px] text-white/50 font-mono">{p.slug}</div>
      </td>
      <td className="px-3 py-2.5">
        <span className={`text-[11px] px-1.5 py-0.5 rounded border ${TIER_CLS[p.tier ?? ''] ?? TIER_CLS.C}`}>
          {p.tier ?? '-'}
        </span>
        {p.subject_variant && (
          <span
            className="ml-1 text-[10px] px-1 py-0.5 rounded border border-white/[0.14] bg-white/[0.05] text-white/60 uppercase"
            title={`Subject ${p.subject_variant.toUpperCase()}: "${SUBJECT_VARIANTS[p.subject_variant]}"`}
          >
            {p.subject_variant}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-white/80 max-w-[12rem]">
        <div className="truncate" title={p.contactpersoon ?? ''}>{p.contactpersoon ?? '-'}</div>
        {p.plaats && <div className="text-[11px] text-white/55 truncate" title={p.plaats}>{p.plaats}</div>}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <select
            value={p.status}
            disabled={savingStatus}
            onChange={(e) => saveStatus(e.target.value as OutreachStatus)}
            className={select}
          >
            {OUTREACH_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {savingStatus && <Loader2 className="h-3 w-3 animate-spin text-white/55" />}
        </div>
      </td>
      {/* The mail cell carries the send date too, so there is no separate
          "sent" column: the first outbound is on the tooltip. */}
      <td className="px-3 py-2.5 text-xs min-w-[11rem] max-w-[18rem]">
        {p.mails.length === 0 ? (
          p.verzonden_op ? (
            <div className="space-y-1">
              <span className="text-white/55" title={`First sent ${fmt(p.verzonden_op, true)}`}>
                Sent {fmt(p.verzonden_op, true)}
              </span>
              <FollowUpBadge fu={fu} draftState={draftState} onDraft={draftFollowUp} queueing={queueing} />
            </div>
          ) : (
            <span className="text-white/45">Not sent</span>
          )
        ) : (
          <div className="space-y-1">
            <button
              onClick={() => setShowMails((v) => !v)}
              className="inline-flex items-center gap-1 text-white/80 hover:text-white"
              title={p.verzonden_op ? `First sent ${fmt(p.verzonden_op, true)} · click to show the mail history` : 'Show mail history'}
            >
              {p.laatste_mail_richting === 'in' ? (
                <ArrowDownLeft className="h-3 w-3 text-atlas-gold" />
              ) : (
                <ArrowUpRight className="h-3 w-3 text-white/55" />
              )}
              <span className="whitespace-nowrap">{fmt(p.laatste_mail_op, true)}</span>
              <span className="text-white/50">· {p.mails.length}</span>
              {showMails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {p.laatste_sentiment && (
              <div className="flex flex-wrap items-center gap-1">
                <span className={`text-[11px] px-1.5 py-0.5 rounded border ${SENTIMENT_CLS[p.laatste_sentiment] ?? SENTIMENT_CLS.overig}`}>
                  {SENTIMENT_LABELS[p.laatste_sentiment]}
                </span>
                {p.concept_klaar && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded border border-atlas-teal/40 bg-atlas-teal/15 text-atlas-teal" title="A draft reply is waiting in Gmail (Drafts)">
                    draft ready
                  </span>
                )}
              </div>
            )}
            {p.laatste_samenvatting && (
              <div className="text-[11px] text-white/70 leading-snug" title={p.laatste_samenvatting}>{p.laatste_samenvatting}</div>
            )}
            {p.needs_reply && (
              <button
                onClick={() => dismissReply(false)}
                disabled={dismissing}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border border-dashed border-white/25 text-white/70 hover:text-white hover:border-white/45 hover:bg-white/[0.05] disabled:opacity-50"
                title={`For a reply with nothing to answer yet, like "my colleagues will get back to you". Takes them off Waiting on you and puts a check-in on the list ${CHECK_IN_WORKING_DAYS} working days from now. If they write first, it comes back by itself. Gmail is not touched: delete the reply draft there if you don't need it.`}
              >
                {dismissing ? <Loader2 className="h-3 w-3 animate-spin" /> : <PauseCircle className="h-3 w-3" />}
                Park: they'll get back to me
              </button>
            )}
            {p.reply_dismissed && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/50">
                <span title={`Parked ${fmt(p.reply_dismissed_at, true)}. Comes back by itself when they write again.`}>
                  <PauseCircle className="inline h-3 w-3 -mt-0.5" /> Parked
                </span>
                <button
                  onClick={() => dismissReply(true)}
                  disabled={dismissing}
                  className="underline text-white/60 hover:text-white disabled:opacity-50"
                >
                  undo
                </button>
              </div>
            )}
            <FollowUpBadge fu={fu} draftState={draftState} onDraft={draftFollowUp} queueing={queueing} />
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full border ${
            clicked
              ? 'bg-atlas-teal/15 text-atlas-teal border-atlas-teal/40'
              : scannerOnly
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-white/[0.05] text-white/55 border-white/[0.14]'
          }`}
          title={clickTitle}
        >
          {clicked ? 'Yes' : scannerOnly ? 'Scanner?' : 'Not yet'}
        </span>
        {depthLabel && (
          <div
            className={`mt-1 text-[10px] ${depth === 0 ? 'text-amber-300/80' : 'text-white/60'}`}
            title={depthTitle}
          >
            {depthLabel}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {p.partner_slug ? (
          <div
            className="inline-flex items-center gap-1 text-xs text-white/[0.88]"
            title={`${p.partner_naam ?? p.partner_slug} · ${p.codes_issued} codes${p.codes_claimed > 0 ? `, ${p.codes_claimed} used` : ''}`}
          >
            <Building2 className="h-3.5 w-3.5 text-atlas-teal shrink-0" />
            <span className="truncate max-w-[7rem]">{p.partner_naam ?? p.partner_slug}</span>
          </div>
        ) : onCreatePartner ? (
          <button
            onClick={() => onCreatePartner({ name: p.naam ?? p.slug, slug: p.slug, prospectSlug: p.slug })}
            aria-label="Create partner"
            title="Create a partner account with this name and slug prefilled"
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-white/[0.14] text-white/60 hover:text-atlas-teal hover:border-atlas-teal/40 transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-white/45">-</span>
        )}
      </td>
      <td className="px-3 py-2.5 min-w-[12rem]">
        <div className="relative">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={2}
            placeholder="Notes"
            className="w-full bg-[#0E2531] border border-white/[0.14] rounded-lg px-2 py-1 text-xs text-white/[0.92] placeholder:text-white/40 focus:outline-none focus:border-atlas-teal/60 resize-y"
          />
          {savingNotes && <Loader2 className="absolute right-1.5 top-1.5 h-3 w-3 animate-spin text-white/55" />}
        </div>
      </td>
    </tr>
    {showMails && p.mails.length > 0 && (
      <tr className={`${rowBg}`}>
        <td colSpan={8} className="px-3 pb-3 pt-0">
          <MailHistory mails={p.mails} />
        </td>
      </tr>
    )}
    </>
  );
}

// ─── Mail history under a row ─────────────────────────────────────────────────

const KIND_LABEL: Record<OutreachMail['kind'], string> = {
  eerste: 'first mail',
  opvolging: 'follow-up',
  antwoord: 'our reply',
  reactie: 'their reply',
};

function MailHistory({ mails }: { mails: OutreachMail[] }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#0E2531] divide-y divide-white/5">
      {mails.map((m) => (
        <div key={m.id} className="px-3 py-2 text-xs flex gap-3">
          <div className="shrink-0 w-28 text-white/60 whitespace-nowrap">{fmt(m.sent_at, true)}</div>
          <div className="shrink-0 w-24 text-white/70 inline-flex items-center gap-1">
            {m.direction === 'in' ? <ArrowDownLeft className="h-3 w-3 text-atlas-gold" /> : <ArrowUpRight className="h-3 w-3 text-white/60" />}
            {KIND_LABEL[m.kind]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-white/80 truncate" title={m.subject ?? ''}>{m.subject ?? '(no subject)'}</span>
              {m.sentiment && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded border ${SENTIMENT_CLS[m.sentiment] ?? SENTIMENT_CLS.overig}`}>
                  {SENTIMENT_LABELS[m.sentiment]}
                </span>
              )}
              {m.draft_id && (
                <span className="text-[11px] px-1.5 py-0.5 rounded border border-atlas-teal/40 bg-atlas-teal/15 text-atlas-teal inline-flex items-center gap-1">
                  <Mail className="h-2.5 w-2.5" /> draft in Gmail
                </span>
              )}
              {m.status_voor && m.status_na && m.status_voor !== m.status_na && (
                <span className="text-[11px] text-white/60">
                  {STATUS_LABELS[m.status_voor as OutreachStatus] ?? m.status_voor} → {STATUS_LABELS[m.status_na as OutreachStatus] ?? m.status_na}
                </span>
              )}
            </div>
            {m.samenvatting && <div className="text-white/80 mt-0.5">{m.samenvatting}</div>}
            {m.snippet && <div className="text-white/60 mt-0.5 line-clamp-2" title={m.snippet}>{m.snippet}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Raw click log ────────────────────────────────────────────────────────────

/**
 * Subject-line A/B readout.
 *
 * The caveat is rendered, not hidden in a comment, because a two-row table of
 * percentages invites a conclusion it cannot carry: each arm is about fifteen
 * agencies, and against the observed baseline only a tripling would show. The
 * panel therefore leads with the counts and states what it would take to call
 * a winner.
 */
function SubjectTest({ stats }: { stats: SubjectStat[] }) {
  if (!stats.length) return null;
  const byVariant = new Map(stats.map((s) => [s.variant, s]));
  const rows: Array<'a' | 'b'> = ['a', 'b'];
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((100 * n) / of)}%` : '-');

  return (
    <div className={`${card} px-4 py-3`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className={label}>Subject line test</div>
        <div className="text-[11px] text-white/50">
          Direction, not a result — about 15 agencies per arm reads only a tripling. A real
          call needs roughly 120 each.
        </div>
      </div>
      <table className="w-full mt-2 text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-white/45">
            <th className="py-1 pr-3 font-normal">Subject</th>
            <th className="py-1 pr-3 font-normal">Sent</th>
            <th className="py-1 pr-3 font-normal">Clicked</th>
            <th className="py-1 pr-3 font-normal">Replied</th>
            <th className="py-1 pr-3 font-normal">Positive</th>
            <th className="py-1 font-normal">Demo depth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => {
            const s = byVariant.get(v);
            const sent = s?.verstuurd ?? 0;
            return (
              <tr key={v} className="border-t border-white/[0.06] align-top">
                <td className="py-1.5 pr-3">
                  <span className="text-[10px] uppercase text-white/55 mr-1.5">{v}</span>
                  <span className="text-white/[0.88]">{SUBJECT_VARIANTS[v]}</span>
                  <div className="text-[11px] text-white/45">
                    {s?.bureaus ?? 0} assigned{sent < (s?.bureaus ?? 0) ? `, ${(s?.bureaus ?? 0) - sent} still to send` : ''}
                  </div>
                </td>
                <td className="py-1.5 pr-3 text-white/[0.88]">{sent}</td>
                <td className="py-1.5 pr-3 text-white/[0.88]">
                  {s?.met_klik ?? 0} <span className="text-white/45">{pct(s?.met_klik ?? 0, sent)}</span>
                </td>
                <td className="py-1.5 pr-3 text-white/[0.88]">
                  {s?.reacties ?? 0} <span className="text-white/45">{pct(s?.reacties ?? 0, sent)}</span>
                </td>
                <td className="py-1.5 pr-3 text-white/[0.88]">{s?.positieve_reacties ?? 0}</td>
                <td className="py-1.5 text-white/[0.88]">
                  {s?.momenten_gemiddeld == null
                    ? <span className="text-white/45" title="Nobody with this subject has visited the demo with the slug attached yet">-</span>
                    : `${s.momenten_gemiddeld}/7`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-white/50">
        Every mail before 21 September carried subject A, so A&apos;s sent count includes
        history and B starts at zero. The two differ on one axis: A announces a question,
        B asks it. The row pills in the table below say which line an agency should get.
      </p>
    </div>
  );
}

/**
 * The send queue: what is waiting, and the switch that stops it.
 *
 * Deliberately not a control surface. There is no "send this now" here,
 * because the pacing rules are the whole point and a button that skips them
 * would be the first thing reached for on a slow afternoon. The queue fills
 * itself when WF11 creates a chase; the only thing a human does here is stop
 * it. To cancel one mail, delete its draft in Gmail.
 */
function SendQueue({ send, onToggle }: { send: SendInfo; onToggle: (pause: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const paused = send.state?.gepauzeerd ?? true;
  const next = send.state?.next_allowed_at ? new Date(send.state.next_allowed_at) : null;
  const wachtend = next && next.getTime() > Date.now() ? next : null;

  const flip = async () => {
    setBusy(true);
    try {
      await onToggle(!paused);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${card} px-4 py-3`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={label}>Sending</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              paused
                ? 'bg-white/[0.05] text-white/60 border-white/[0.14]'
                : 'bg-atlas-teal/15 text-atlas-teal border-atlas-teal/40'
            }`}
          >
            {paused ? 'Paused' : 'Running'}
          </span>
        </div>
        <button
          onClick={flip}
          disabled={busy}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
            paused
              ? 'border-atlas-teal/40 text-atlas-teal hover:bg-atlas-teal/10'
              : 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
          }`}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : paused ? 'Start sending' : 'Stop everything'}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/70">
        <span>{send.in_wachtrij} waiting</span>
        <span>{send.vandaag_verzonden} of 8 sent today</span>
        {send.bezig > 0 && <span className="text-amber-300">{send.bezig} in flight</span>}
        {send.mislukt > 0 && <span className="text-red-300">{send.mislukt} failed</span>}
        {wachtend && (
          <span className="text-white/50">
            next slot {wachtend.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {send.state?.laatste_fout && (
        <div className="mt-2 text-[11px] text-red-300/90">Last error: {send.state.laatste_fout}</div>
      )}

      <p className="mt-2 text-[11px] text-white/50">
        Chases queue themselves once WF11 has written the draft; replies never do. Mail goes out
        Monday from 13:00, Friday until 12:00, otherwise 09:00 to 16:30, never at the weekend, at
        most 8 a day with 24 to 53 minutes between them. Those rules live in the database, so they
        hold however often the workflow runs. Editing a draft in Gmail changes what is sent;
        deleting it cancels that mail.
      </p>
    </div>
  );
}

function RawLog({ rows }: { rows: ClickRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={card}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-white/80 hover:text-white"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Raw click log
        <span className="text-xs text-white/60">last {rows.length} rows, bots and scanners included</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-white/5">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-xs text-white/60">No clicks logged yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">Slug</th>
                  <th className="px-3 py-2 font-semibold">Campaign</th>
                  <th className="px-3 py-2 font-semibold">Persona / p</th>
                  <th className="px-3 py-2 font-semibold">Bot</th>
                  <th className="px-3 py-2 font-semibold">User-agent</th>
                  <th className="px-3 py-2 font-semibold">Referer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-t border-white/5 ${r.is_bot || r.verdacht ? 'text-white/60' : 'text-white/80'}`}>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmt(r.created_at, true)}</td>
                    <td className="px-3 py-1.5 font-mono">{r.slug ?? '-'}</td>
                    <td className="px-3 py-1.5">{r.campaign ?? '-'}</td>
                    <td className="px-3 py-1.5">{[r.persona, r.p].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="px-3 py-1.5">
                      {r.is_bot ? (
                        <span className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-amber-300 text-[11px]">bot</span>
                      ) : r.verdacht ? (
                        <span
                          className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-amber-300 text-[11px]"
                          title="Within 2 minutes of sending"
                        >
                          scanner?
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded border border-atlas-teal/40 bg-atlas-teal/15 text-atlas-teal text-[11px]">human</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 max-w-[22rem] truncate" title={r.user_agent ?? ''}>{r.user_agent ?? '-'}</td>
                    <td className="px-3 py-1.5 max-w-[12rem] truncate" title={r.referer ?? ''}>{r.referer ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export default function OutreachTab({
  onCreatePartner,
  focus: focusProp,
  onFocusChange,
  onChanged,
}: {
  onCreatePartner?: (draft: PartnerDraft) => void;
  /**
   * Which card is filtering the table. Controlled when the page passes it, so
   * the page-level tiles above the section can drive the same filter.
   */
  focus?: OutreachFocus;
  onFocusChange?: (focus: OutreachFocus) => void;
  /** Something changed that the page-level counts read too. */
  onChanged?: () => void;
} = {}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tier, setTier] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [campaign, setCampaign] = useState<string>('all');
  const [focusState, setFocusState] = useState<OutreachFocus>('all');
  const focus = focusProp ?? focusState;
  const setFocus = useCallback(
    (next: OutreachFocus) => {
      setFocusState(next);
      onFocusChange?.(next);
    },
    [onFocusChange],
  );
  /** Clicking the card that is already on shows everything again. */
  const toggleFocus = (next: OutreachFocus) => setFocus(focus === next ? 'all' : next);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callOutreach<ListResponse>({ action: 'list' });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load outreach data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The kill switch. Patched in place rather than reloading the whole table,
  // because stopping the machine should feel instant.
  const toggleSending = useCallback(async (pause: boolean) => {
    try {
      const res = await callOutreach<{ state: SendState }>({ action: 'send_pause', gepauzeerd: pause });
      setData((prev) => (prev ? { ...prev, send: { ...prev.send, state: res.state } } : prev));
      toast.success(pause ? 'Sending stopped' : 'Sending started');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change sending');
    }
  }, []);

  // Patch a row in place after a save so the table does not jump while the
  // user is still editing the next one.
  const applyPatch = useCallback((patch: Pick<OutreachProspect, 'slug'> & Partial<OutreachProspect>) => {
    setData((prev) =>
      prev
        ? { ...prev, prospects: prev.prospects.map((p) => (p.slug === patch.slug ? { ...p, ...patch } : p)) }
        : prev,
    );
  }, []);

  /**
   * Ask for a follow-up draft on one or many agencies. This writes a flag and
   * nothing else: the mail is written by outreach-mail-sync on the next WF11
   * run and lands in the Gmail thread as a draft, never sent.
   */
  const queueFollowUps = useCallback(async (slugs: string | string[]) => {
    const list = Array.isArray(slugs) ? slugs : [slugs];
    if (list.length === 0) return;
    try {
      const res = await callOutreach<QueueResponse>({ action: 'queue_followup', slugs: list });
      const queued = new Map(res.queued.map((q) => [q.slug, q]));
      setData((prev) =>
        prev
          ? {
              ...prev,
              prospects: prev.prospects.map((p) => {
                const q = queued.get(p.slug);
                return q
                  ? { ...p, followup_requested_at: q.followup_requested_at, followup_draft_id: q.followup_draft_id }
                  : p;
              }),
            }
          : prev,
      );
      if (res.queued.length > 0) {
        toast.success(
          res.queued.length === 1
            ? 'Follow-up queued. The draft lands in Gmail within a few minutes.'
            : `${res.queued.length} follow-ups queued. The drafts land in Gmail within a few minutes.`,
        );
      }
      if (res.rejected.length > 0) {
        toast.warning(`Skipped ${res.rejected.length}: they are no longer waiting on a chase.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not queue the follow-up');
    }
  }, []);

  // One clock for the whole render pass, refreshed when the data is: a `new
  // Date()` per row would make the sort non-deterministic across a tick.
  const now = useMemo(() => new Date(), [data]);

  /** slug -> next chase, so the sort and the badges agree on one answer. */
  const followUps = useMemo(() => {
    const map = new Map<string, FollowUp | null>();
    for (const p of data?.prospects ?? []) map.set(p.slug, followUp(p, now));
    return map;
  }, [data, now]);

  const dueCount = useMemo(
    () => (data?.prospects ?? []).filter((p) => followUps.get(p.slug)?.due).length,
    [data, followUps],
  );

  /** Due, and the chase is already asked for or sitting in Gmail. */
  const dueDrafted = useMemo(
    () =>
      (data?.prospects ?? []).filter((p) => followUps.get(p.slug)?.due && followUpDraftState(p) !== 'none').length,
    [data, followUps],
  );

  /** Due, and nobody has asked for a draft yet. This is what "Draft all due" acts on. */
  const undrafted = useMemo(
    () =>
      (data?.prospects ?? [])
        .filter((p) => followUps.get(p.slug)?.due && followUpDraftState(p) === 'none')
        .map((p) => p.slug),
    [data, followUps],
  );
  const [draftingAll, setDraftingAll] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.prospects
      .filter((p) => tier === 'all' || p.tier === tier)
      .filter((p) => campaign === 'all' || p.campaign === campaign)
      .filter((p) => matchesFocus(p, focus, followUps.get(p.slug) ?? null, now))
      .sort((a, b) => compareWorkFirst(a, b, now));
  }, [data, tier, campaign, focus, followUps, now]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/70 py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-sm text-red-400 py-4">
        {error}{' '}
        <button onClick={load} className="underline text-white/80">try again</button>
      </div>
    );
  }

  if (!data) return null;

  // Every counter is a button: clicking it filters the table down to exactly
  // what it counts, which is the whole point of counting it. Clicking the one
  // that is on shows everything again.
  const counter = (lbl: string, big: number, sub: string, target: OutreachFocus) => {
    const on = target !== 'all' && focus === target;
    return (
      <button
        onClick={() => (target === 'all' ? setFocus('all') : toggleFocus(target))}
        aria-pressed={on}
        title={target === 'all' ? 'Show every agency' : on ? 'Show every agency again' : 'Show only these'}
        className={`${card} px-4 py-4 text-left transition-colors hover:border-atlas-gold/40 ${
          on ? 'border-atlas-gold/50 bg-atlas-gold/[0.06]' : ''
        }`}
      >
        <div className="text-xs text-white/70">{lbl}</div>
        <div className={`text-3xl font-bold mt-1 ${on ? 'text-atlas-gold' : 'text-white/[0.92]'}`}>{big}</div>
        <div className="text-xs text-white/60 mt-0.5">{sub}</div>
      </button>
    );
  };

  const waitingCount = data.prospects.filter((p) => p.needs_reply).length;
  const dismissedCount = data.prospects.filter((p) => p.reply_dismissed).length;
  const clickedTodayAgencies = data.prospects.filter((p) => matchesFocus(p, 'clicked_today', null, now)).length;
  // "12" alone hid that one of them was already written; say where they stand.
  const dueSub =
    dueCount === 0
      ? `${FOLLOW_UP_1_WORKING_DAYS} working days, then ${FOLLOW_UP_2_WORKING_DAYS}`
      : dueDrafted === 0
        ? `none drafted yet`
        : `${dueDrafted} drafted · ${dueCount - dueDrafted} to draft`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {counter('Agencies in seed', data.counters.prospects, 'rows in outreach_prospects', 'all')}
        {counter('Opened the demo', data.counters.prospects_with_click, 'at least one confirmed click', 'clicked')}
        {counter(
          'Clicks today',
          data.counters.clicks_today,
          `confirmed, from ${clickedTodayAgencies} ${clickedTodayAgencies === 1 ? 'agency' : 'agencies'}`,
          'clicked_today',
        )}
        {counter(
          'Waiting on you',
          waitingCount,
          dismissedCount > 0 ? `they wrote last · ${dismissedCount} parked` : 'they wrote last',
          'waiting',
        )}
        {counter('Follow-up due', dueCount, dueSub, 'due')}
      </div>

      {data.send && <SendQueue send={data.send} onToggle={toggleSending} />}

      <SubjectTest stats={data.subject_stats} />

      <div className={`${card} px-4 py-3 flex flex-wrap items-end gap-4`}>
        <label className="block">
          <span className={label}>Tier</span>
          <div className="mt-1 flex gap-1">
            {(['all', 'A', 'B', 'C'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                  tier === t ? 'bg-atlas-teal/20 text-atlas-teal border-atlas-teal/40' : 'bg-white/[0.05] text-white/60 border-white/[0.14] hover:border-white/25'
                }`}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className={label}>Campaign</span>
          <div className="mt-1">
            <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={select}>
              <option value="all">All</option>
              {data.campaigns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </label>
        {focus !== 'all' && (
          <button
            onClick={() => setFocus('all')}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-atlas-gold/40 bg-atlas-gold/10 text-atlas-gold hover:bg-atlas-gold/20 mb-0.5"
            title="Show every agency again"
          >
            Showing: {FOCUS_LABELS[focus]}
            <X className="h-3 w-3" />
          </button>
        )}
        {undrafted.length > 0 && (
          <button
            onClick={async () => {
              setDraftingAll(true);
              try {
                await queueFollowUps(undrafted);
              } finally {
                setDraftingAll(false);
              }
            }}
            disabled={draftingAll}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-atlas-gold/40 bg-atlas-gold/10 text-atlas-gold hover:bg-atlas-gold/20 disabled:opacity-50"
            title="Write a follow-up for every agency whose chase is due, into their own Gmail thread. Drafts only, nothing is sent."
          >
            {draftingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            Draft all due ({undrafted.length})
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 text-xs text-white/60">
          {rows.length} of {data.prospects.length}
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 text-white/80 hover:text-white">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className={`px-3 py-2 ${label}`}>Agency</th>
              <th className={`px-3 py-2 ${label}`}>Tier</th>
              <th className={`px-3 py-2 ${label}`}>Contact</th>
              <th className={`px-3 py-2 ${label}`}>Status</th>
              <th className={`px-3 py-2 ${label}`}>Mail</th>
              <th className={`px-3 py-2 ${label}`}>Clicked?</th>
              <th className={`px-3 py-2 ${label}`}>Partner</th>
              <th className={`px-3 py-2 ${label}`}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-xs text-white/55">No agencies match this filter.</td>
              </tr>
            ) : (
              rows.map((p) => (
                <ProspectRow
                  key={p.slug}
                  p={p}
                  fu={followUps.get(p.slug) ?? null}
                  onSaved={applyPatch}
                  onCreatePartner={onCreatePartner}
                  onDraftFollowUp={queueFollowUps}
                  onReplyDismissed={onChanged}
                />
              ))
            )}
          </tbody>
        </table>
        <div className="px-3 py-2 text-[11px] text-white/50 border-t border-white/5">
          &quot;Clicked?&quot; is Yes once someone opened the demo on their own; hover it for the first and last click. Underneath it, how far the best session got into the demo&apos;s seven annotated moments: &quot;bounced&quot; means they opened it and left, &quot;5/7 read&quot; means they got most of the way through. Blank means no measurement, not zero — the agency slug only started reaching analytics on 21 September 2026. A click within two minutes of sending shows as &quot;Scanner?&quot; and never counts as an open — that is the mail server checking the link, not a person. Every card at the top filters the table to what it counts; click it again (or the gold chip) to see everything. Agencies who wrote last sort to the top (gold, you&apos;re up) until you answer them or park them (&quot;they&apos;ll get back to me&quot;): a parked agency leaves Waiting on you and comes back as a check-in {CHECK_IN_WORKING_DAYS} working days later, or straight away if they write first. A check-in draft is never sent on its own. Below them come the ones whose follow-up or check-in is due (longest overdue first), then ones who clicked but haven&apos;t been followed up (teal). A chase is due {FOLLOW_UP_1_WORKING_DAYS} working days after the first mail and {FOLLOW_UP_2_WORKING_DAYS} after that one; sending it clears the nudge by itself, because WF11 logs the mail and moves the status. &quot;Draft it&quot; writes that mail for you: within fifteen minutes it sits in the agency&apos;s own Gmail thread under Drafts, personalised with what we know about them, and it is never sent on its own. Mail and statuses arrive from Gmail via WF11; a draft reply sits in Gmail under Drafts and is never sent on its own.
        </div>
      </div>

      <RawLog rows={data.log} />
    </div>
  );
}
