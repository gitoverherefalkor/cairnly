// OutreachTab — who opened the demo, per bureau.
//
// Phase 2 of the outreach dashboard: first-party click tracking on the
// partner demo, read back here. Everything comes through the admin-gated
// ops-outreach edge function; the browser never touches the outreach tables.
//
// Deliberately small (see docs/handoff/cairnly-ops-outreach-fase2-prompt.md):
// three counters, one table, two editable fields (status, notities), and a
// collapsed raw click log to sanity-check the bot filter. No Gmail, no
// follow-up worklist, no pixel, no charts.
//
// Clicks are counted CONFIRMED vs SUSPECT. A non-bot click within two minutes
// of the mail going out is a link scanner fetching the URL on delivery, not a
// person: enterprise mail security presents a real browser user-agent, so the
// bot list cannot see it and only the time since sending can. Suspect clicks
// stay visible everywhere, they just do not count as an open.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Building2, Mail, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import {
  OUTREACH_STATUSES,
  STATUS_LABELS,
  SENTIMENT_LABELS,
  compareProspects,
  isWarm,
  type OutreachMail,
  type OutreachProspect,
  type OutreachStatus,
} from '@/lib/outreach';

/** What the Outreach tab hands the Partners tab when "Partner aanmaken" is clicked. */
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

interface UpdateResponse {
  prospect: Pick<OutreachProspect, 'slug' | 'status' | 'notities' | 'updated_at'>;
}

interface ListResponse {
  prospects: OutreachProspect[];
  counters: Counters;
  campaigns: string[];
  log: ClickRow[];
}

// ─── Shared styles (same language as MarketingTab / PartnersTab) ─────────────

const card = 'rounded-2xl border border-white/10 bg-black/25 shadow-sm';
const select =
  'bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-atlas-teal/60';
const label = 'text-[11px] uppercase tracking-wider font-semibold text-gray-500';

const SENTIMENT_CLS: Record<string, string> = {
  positief: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  code: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  vraag: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  later: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  afwijzing: 'bg-red-500/15 text-red-300 border-red-500/40',
  auto: 'bg-white/10 text-gray-400 border-white/20',
  overig: 'bg-white/10 text-gray-300 border-white/20',
};

const TIER_CLS: Record<string, string> = {
  A: 'bg-atlas-teal/20 text-atlas-teal border-atlas-teal/40',
  B: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  C: 'bg-white/10 text-gray-400 border-white/20',
};

function fmt(iso: string | null, withTime = false): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: '2-digit',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
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

function ProspectRow({
  p,
  onSaved,
  onCreatePartner,
}: {
  p: OutreachProspect;
  onSaved: (patch: Pick<OutreachProspect, 'slug'> & Partial<OutreachProspect>) => void;
  onCreatePartner?: (draft: PartnerDraft) => void;
}) {
  const [notes, setNotes] = useState(p.notities ?? '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [showMails, setShowMails] = useState(false);

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
      toast.error(e instanceof Error ? e.message : 'Status niet opgeslagen');
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
      toast.error(e instanceof Error ? e.message : 'Notitie niet opgeslagen');
    } finally {
      setSavingNotes(false);
    }
  };

  const warm = isWarm(p);
  const rowBg = p.needs_reply ? 'bg-atlas-gold/[0.07]' : warm ? 'bg-atlas-teal/[0.06]' : '';

  return (
    <>
    <tr className={`border-t border-white/5 align-top ${rowBg}`}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {p.needs_reply ? (
            <span className="h-1.5 w-1.5 rounded-full bg-atlas-gold shrink-0" title="Zij schreven als laatste, jij bent aan zet" />
          ) : warm ? (
            <span className="h-1.5 w-1.5 rounded-full bg-atlas-teal shrink-0" title="Klik, nog niet opgevolgd" />
          ) : null}
          <span className="text-sm text-gray-100">{p.naam ?? p.slug}</span>
        </div>
        <div className="text-[11px] text-gray-500 font-mono">{p.slug}</div>
      </td>
      <td className="px-3 py-2">
        <span className={`text-[11px] px-1.5 py-0.5 rounded border ${TIER_CLS[p.tier ?? ''] ?? TIER_CLS.C}`}>
          {p.tier ?? '-'}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-300 max-w-[12rem]">
        <div className="truncate" title={p.contactpersoon ?? ''}>{p.contactpersoon ?? '-'}</div>
        {p.plaats && <div className="text-[11px] text-gray-500 truncate" title={p.plaats}>{p.plaats}</div>}
      </td>
      <td className="px-3 py-2">
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
          {savingStatus && <Loader2 className="h-3 w-3 animate-spin text-gray-500" />}
        </div>
      </td>
      <td className="px-3 py-2 text-xs min-w-[11rem] max-w-[16rem]">
        {p.mails.length === 0 ? (
          <span className="text-gray-600">-</span>
        ) : (
          <div className="space-y-1">
            <button
              onClick={() => setShowMails((v) => !v)}
              className="inline-flex items-center gap-1 text-gray-300 hover:text-gray-100"
              title="Mailhistorie tonen"
            >
              {p.laatste_mail_richting === 'in' ? (
                <ArrowDownLeft className="h-3 w-3 text-atlas-gold" />
              ) : (
                <ArrowUpRight className="h-3 w-3 text-gray-500" />
              )}
              <span className="whitespace-nowrap">{fmt(p.laatste_mail_op, true)}</span>
              <span className="text-gray-600">· {p.mails.length}</span>
              {showMails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {p.laatste_sentiment && (
              <div className="flex flex-wrap items-center gap-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SENTIMENT_CLS[p.laatste_sentiment] ?? SENTIMENT_CLS.overig}`}>
                  {SENTIMENT_LABELS[p.laatste_sentiment]}
                </span>
                {p.concept_klaar && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-atlas-teal/40 bg-atlas-teal/15 text-atlas-teal" title="Er staat een conceptantwoord klaar in Gmail (Concepten)">
                    concept klaar
                  </span>
                )}
              </div>
            )}
            {p.laatste_samenvatting && (
              <div className="text-[11px] text-gray-400 leading-snug" title={p.laatste_samenvatting}>{p.laatste_samenvatting}</div>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{fmt(p.verzonden_op, true)}</td>
      <td className="px-3 py-2 text-xs text-gray-300 whitespace-nowrap">{fmt(p.eerste_bevestigde_klik, true)}</td>
      <td className="px-3 py-2 text-xs text-gray-300 whitespace-nowrap">{fmt(p.laatste_bevestigde_klik, true)}</td>
      <td className="px-3 py-2 text-sm text-center">
        <span className={p.dagen_bevestigd > 0 ? 'text-gray-100 font-semibold' : 'text-gray-600'}>
          {p.dagen_bevestigd}
        </span>
        {p.kliks_verdacht > 0 && (
          <div
            className="text-[10px] text-amber-400/80"
            title="Klik binnen 2 minuten na verzenden. Vrijwel zeker een linkscanner van de mailserver, niet iemand die leest."
          >
            +{p.kliks_verdacht} scanner?
          </div>
        )}
        {p.bot_kliks > 0 && (
          <div className="text-[10px] text-gray-500" title="Bot-kliks, niet meegeteld">+{p.bot_kliks} bot</div>
        )}
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap">
        {p.partner_slug ? (
          <div>
            <div className="flex items-center gap-1 text-gray-200">
              <Building2 className="h-3 w-3 text-gray-500" />
              <span title={p.partner_slug}>{p.partner_naam ?? p.partner_slug}</span>
            </div>
            <div className="text-[11px] text-gray-500">
              {p.codes_issued} codes{p.codes_claimed > 0 ? `, ${p.codes_claimed} gebruikt` : ''}
            </div>
          </div>
        ) : onCreatePartner ? (
          <button
            onClick={() => onCreatePartner({ name: p.naam ?? p.slug, slug: p.slug, prospectSlug: p.slug })}
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-atlas-teal"
            title="Opent het Partners-tabblad met naam en slug ingevuld; opslaan koppelt dit bureau"
          >
            <Building2 className="h-3 w-3" /> Partner aanmaken
          </button>
        ) : (
          <span className="text-gray-600">-</span>
        )}
      </td>
      <td className="px-3 py-2 min-w-[14rem]">
        <div className="relative">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={2}
            placeholder="Notities"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-atlas-teal/60 resize-y"
          />
          {savingNotes && <Loader2 className="absolute right-1.5 top-1.5 h-3 w-3 animate-spin text-gray-500" />}
        </div>
      </td>
    </tr>
    {showMails && p.mails.length > 0 && (
      <tr className={`${rowBg}`}>
        <td colSpan={11} className="px-3 pb-3 pt-0">
          <MailHistory mails={p.mails} />
        </td>
      </tr>
    )}
    </>
  );
}

// ─── Mail history under a row ─────────────────────────────────────────────────

const KIND_LABEL: Record<OutreachMail['kind'], string> = {
  eerste: 'eerste mail',
  opvolging: 'opvolging',
  antwoord: 'ons antwoord',
  reactie: 'hun reactie',
};

function MailHistory({ mails }: { mails: OutreachMail[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 divide-y divide-white/5">
      {mails.map((m) => (
        <div key={m.id} className="px-3 py-2 text-xs flex gap-3">
          <div className="shrink-0 w-28 text-gray-500 whitespace-nowrap">{fmt(m.sent_at, true)}</div>
          <div className="shrink-0 w-24 text-gray-400 inline-flex items-center gap-1">
            {m.direction === 'in' ? <ArrowDownLeft className="h-3 w-3 text-atlas-gold" /> : <ArrowUpRight className="h-3 w-3 text-gray-500" />}
            {KIND_LABEL[m.kind]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-gray-300 truncate" title={m.subject ?? ''}>{m.subject ?? '(geen onderwerp)'}</span>
              {m.sentiment && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SENTIMENT_CLS[m.sentiment] ?? SENTIMENT_CLS.overig}`}>
                  {SENTIMENT_LABELS[m.sentiment]}
                </span>
              )}
              {m.draft_id && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-atlas-teal/40 bg-atlas-teal/15 text-atlas-teal inline-flex items-center gap-1">
                  <Mail className="h-2.5 w-2.5" /> concept in Gmail
                </span>
              )}
              {m.status_voor && m.status_na && m.status_voor !== m.status_na && (
                <span className="text-[10px] text-gray-500">
                  {STATUS_LABELS[m.status_voor as OutreachStatus] ?? m.status_voor} → {STATUS_LABELS[m.status_na as OutreachStatus] ?? m.status_na}
                </span>
              )}
            </div>
            {m.samenvatting && <div className="text-gray-300 mt-0.5">{m.samenvatting}</div>}
            {m.snippet && <div className="text-gray-500 mt-0.5 line-clamp-2" title={m.snippet}>{m.snippet}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Raw click log ────────────────────────────────────────────────────────────

function RawLog({ rows }: { rows: ClickRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={card}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-gray-300 hover:text-gray-100"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Ruwe kliklog
        <span className="text-xs text-gray-500">laatste {rows.length} rijen, inclusief bots en scanners</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-white/5">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-xs text-gray-500">Nog geen kliks gelogd.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2 font-semibold">Tijd</th>
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
                  <tr key={r.id} className={`border-t border-white/5 ${r.is_bot || r.verdacht ? 'text-gray-500' : 'text-gray-300'}`}>
                    <td className="px-3 py-1.5 whitespace-nowrap">{fmt(r.created_at, true)}</td>
                    <td className="px-3 py-1.5 font-mono">{r.slug ?? '-'}</td>
                    <td className="px-3 py-1.5">{r.campaign ?? '-'}</td>
                    <td className="px-3 py-1.5">{[r.persona, r.p].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="px-3 py-1.5">
                      {r.is_bot ? (
                        <span className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-amber-300 text-[10px]">bot</span>
                      ) : r.verdacht ? (
                        <span
                          className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/15 text-amber-300 text-[10px]"
                          title="Binnen 2 minuten na verzenden"
                        >
                          scanner?
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded border border-atlas-teal/40 bg-atlas-teal/15 text-atlas-teal text-[10px]">mens</span>
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

export default function OutreachTab({ onCreatePartner }: { onCreatePartner?: (draft: PartnerDraft) => void } = {}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tier, setTier] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [campaign, setCampaign] = useState<string>('all');
  const [onlyClicked, setOnlyClicked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callOutreach<ListResponse>({ action: 'list' });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kon outreach-data niet laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Patch a row in place after a save so the table does not jump while the
  // user is still editing the next one.
  const applyPatch = useCallback((patch: Pick<OutreachProspect, 'slug'> & Partial<OutreachProspect>) => {
    setData((prev) =>
      prev
        ? { ...prev, prospects: prev.prospects.map((p) => (p.slug === patch.slug ? { ...p, ...patch } : p)) }
        : prev,
    );
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.prospects
      .filter((p) => tier === 'all' || p.tier === tier)
      .filter((p) => campaign === 'all' || p.campaign === campaign)
      .filter((p) => !onlyClicked || p.kliks_bevestigd > 0)
      .sort(compareProspects);
  }, [data, tier, campaign, onlyClicked]);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Laden...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-sm text-red-400 py-4">
        {error}{' '}
        <button onClick={load} className="underline text-gray-300">opnieuw</button>
      </div>
    );
  }

  if (!data) return null;

  const counter = (lbl: string, big: number, sub: string) => (
    <div className={`${card} px-4 py-4`}>
      <div className="text-xs text-gray-400">{lbl}</div>
      <div className="text-3xl font-bold text-gray-100 mt-1">{big}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {counter('Bureaus in seed', data.counters.prospects, 'rijen in outreach_prospects')}
        {counter('Bureaus met klik', data.counters.prospects_with_click, 'minstens een bevestigde klik')}
        {counter('Kliks vandaag', data.counters.clicks_today, 'bevestigd, Amsterdamse dag')}
        {counter('Wacht op jou', data.prospects.filter((p) => p.needs_reply).length, 'zij schreven als laatste')}
      </div>

      <div className={`${card} px-4 py-3 flex flex-wrap items-end gap-4`}>
        <label className="block">
          <span className={label}>Tier</span>
          <div className="mt-1 flex gap-1">
            {(['all', 'A', 'B', 'C'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${
                  tier === t ? 'bg-atlas-teal/20 text-atlas-teal border-atlas-teal/40' : 'bg-black/20 text-gray-500 border-white/10 hover:border-white/20'
                }`}
              >
                {t === 'all' ? 'Alle' : t}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className={label}>Campaign</span>
          <div className="mt-1">
            <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={select}>
              <option value="all">Alle</option>
              {data.campaigns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-300 pb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyClicked}
            onChange={(e) => setOnlyClicked(e.target.checked)}
            className="accent-atlas-teal"
          />
          Alleen met klik
        </label>
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          {rows.length} van {data.prospects.length}
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-1 text-gray-300 hover:text-gray-100">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Ververs
          </button>
        </div>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500">
              <th className={`px-3 py-2 ${label}`}>Naam</th>
              <th className={`px-3 py-2 ${label}`}>Tier</th>
              <th className={`px-3 py-2 ${label}`}>Contactpersoon</th>
              <th className={`px-3 py-2 ${label}`}>Status</th>
              <th className={`px-3 py-2 ${label}`}>Mail</th>
              <th className={`px-3 py-2 ${label}`}>Verzonden</th>
              <th className={`px-3 py-2 ${label}`}>Eerste klik</th>
              <th className={`px-3 py-2 ${label}`}>Laatste klik</th>
              <th className={`px-3 py-2 ${label} text-center`}>Kliks</th>
              <th className={`px-3 py-2 ${label}`}>Partner</th>
              <th className={`px-3 py-2 ${label}`}>Notities</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-xs text-gray-500">Geen bureaus binnen dit filter.</td>
              </tr>
            ) : (
              rows.map((p) => <ProspectRow key={p.slug} p={p} onSaved={applyPatch} onCreatePartner={onCreatePartner} />)
            )}
          </tbody>
        </table>
        <div className="px-3 py-2 text-[11px] text-gray-600 border-t border-white/5">
          Kliks = aantal verschillende dagen met een bevestigde klik. Een klik binnen 2 minuten na verzenden telt niet mee en staat als &quot;scanner?&quot;, want dat is de linkcontrole van de mailserver. Bovenaan staan bureaus die als laatste schreven (goud, jij bent aan zet), dan bureaus met een bevestigde klik die nog niet zijn opgevolgd (teal). Mail en statussen komen automatisch uit Gmail via WF11; een conceptantwoord staat in Gmail onder Concepten en wordt nooit vanzelf verstuurd.
        </div>
      </div>

      <RawLog rows={data.log} />
    </div>
  );
}
