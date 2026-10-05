// PartnerLeadsCard — /ops Partners tab: conversations from the /partners
// pre-chat (intake_sessions with audience 'partner') and the leads they left.
//
// Reads and writes through ops-partners (admin-gated, service role):
// `leads`, `setLeadStatus`, `setPilotSlots`. English only, like all of /ops.
// Free credits are minted by hand in the Partners section below; set the lead
// to "Credits sent" once they are out.

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { callPartners } from './PartnersTab';

const INNER = 'rounded-xl bg-white/[0.04] border border-white/[0.06]';

interface Lead {
  id: string;
  created_at: string;
  intent: string;
  language: string;
  status: string;
  messages: Array<{ role: 'assistant' | 'user'; text: string }>;
  extraction: Record<string, unknown> | null;
  email: string | null;
  offer: { kind: string; clientGroup: string | null; payment: string | null; volume: string | null } | null;
  offer_chosen: string | null;
  lead_status: string | null;
  user_turns: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  credits_sent: 'Credits sent',
  pilot_call_booked: 'Pilot call booked',
  pilot_running: 'Pilot running',
  buying: 'Buying',
  lost: 'Lost',
};

const LABELS: Record<string, Record<string, string>> = {
  intent: {
    'clients-blank': 'Clients start from nothing',
    'clients-ai': 'Clients ask about AI',
    validated: 'Validated tests',
    shorter: 'Shorter trajectories',
    'ai-self': 'AI and coaches like me',
    other: 'Own words',
  },
  clientGroup: { office: 'Office', leadership: 'Leadership', mixed: 'Mixed', not_fit: 'Healthcare/edu/production' },
  payment: { fixed_fee: 'Fixed fee', hourly: 'Hourly', client_pays: 'Client pays', mixed: 'Mixed pay' },
  volume: { lt10: '<10/yr', '10_49': '10–49/yr', '50_199': '50–199/yr', '200_plus': '200+/yr' },
  offer: { pilot: 'Pilot offered', credits: 'Credits offered', none: 'No fit', consumer: 'Job seeker' },
  chosen: { pilot_call: 'Pilot call', free_credits: '3 free credits', call: 'Call' },
  practice: { agency: 'Agency', independent_coach: 'Independent coach', test_adviser: 'Test adviser', other: 'Other' },
};

const label = (group: string, key: unknown) => (typeof key === 'string' ? LABELS[group]?.[key] ?? key : null);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const Tag: React.FC<{ children: React.ReactNode; tone?: 'teal' | 'gold' | 'muted' }> = ({ children, tone = 'muted' }) => {
  const cls =
    tone === 'teal'
      ? 'bg-[#27A1A1]/15 text-[#7FD3D3] border-[#27A1A1]/30'
      : tone === 'gold'
        ? 'bg-[#EFBE48]/12 text-[#EFBE48] border-[#EFBE48]/30'
        : 'bg-white/[0.04] text-white/70 border-white/10';
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${cls}`}>{children}</span>;
};

const LeadRow: React.FC<{ lead: Lead; onStatus: (id: string, status: string) => void }> = ({ lead, onStatus }) => {
  const [open, setOpen] = useState(false);
  const x = lead.extraction ?? {};
  const o = lead.offer;
  const tags = [
    label('practice', x.practice_type),
    label('clientGroup', o?.clientGroup ?? x.client_group),
    label('payment', o?.payment ?? x.payment),
    label('volume', o?.volume ?? x.volume),
  ].filter(Boolean) as string[];

  return (
    <div className={`${INNER} px-4 py-3`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[12px] tabular-nums text-white/50">{fmtDate(lead.created_at)}</span>
        <span className="text-[12px] font-semibold uppercase text-white/45">{lead.language}</span>
        <span className="text-[13.5px] font-semibold text-white/90">{label('intent', lead.intent)}</span>
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className="text-[13.5px] font-semibold text-[#7FD3D3] underline-offset-2 hover:underline">
            {lead.email}
          </a>
        ) : (
          <span className="text-[12.5px] text-white/40">
            {lead.status === 'active' ? `stopped at turn ${lead.user_turns}` : 'no email'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {lead.offer_chosen && <Tag tone="gold">{label('chosen', lead.offer_chosen)}</Tag>}
          {lead.email && (
            <select
              value={lead.lead_status ?? 'new'}
              onChange={(e) => onStatus(lead.id, e.target.value)}
              className="rounded-lg border border-white/15 bg-[#122E3B] px-2 py-1 text-[12.5px] font-semibold text-white/90 outline-none focus:border-[#27A1A1]"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {o && <Tag tone={o.kind === 'pilot' ? 'teal' : 'muted'}>{label('offer', o.kind)}</Tag>}
        {tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
        {x.asked_adviser_view === true && <Tag tone="gold">Asked for adviser view</Tag>}
        {typeof x.instruments === 'string' && x.instruments && <Tag>{x.instruments}</Tag>}
      </div>

      {typeof x.summary === 'string' && <p className="mt-2 text-[13px] leading-relaxed text-white/70">{x.summary}</p>}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-white/45 hover:text-white/80"
      >
        <ChevronDown size={13} className={open ? 'rotate-180' : ''} />
        {open ? 'Hide conversation' : `Conversation (${lead.messages.length} messages)`}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border-l border-white/10 pl-3">
          {lead.messages.map((m, i) => (
            <p key={i} className={`whitespace-pre-wrap text-[12.5px] leading-relaxed ${m.role === 'user' ? 'text-[#7FD3D3]' : 'text-white/60'}`}>
              <span className="font-bold">{m.role === 'user' ? 'Them: ' : 'Chat: '}</span>
              {m.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

const PartnerLeadsCard: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [slots, setSlots] = useState<number | null>(null);
  const [slotsDraft, setSlotsDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSlots, setSavingSlots] = useState(false);
  const [onlyLeads, setOnlyLeads] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callPartners({ action: 'leads' });
      setLeads(res.leads ?? []);
      setSlots(res.pilotSlotsLeft ?? 0);
      setSlotsDraft(String(res.pilotSlotsLeft ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the pre-chat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, lead_status: status } : l)));
    try {
      await callPartners({ action: 'setLeadStatus', id, status });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the status');
      load();
    }
  };

  const saveSlots = async () => {
    const n = Number(slotsDraft);
    if (!Number.isInteger(n) || n < 0) return;
    setSavingSlots(true);
    try {
      const res = await callPartners({ action: 'setPilotSlots', pilotSlotsLeft: n });
      setSlots(res.pilotSlotsLeft);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the slots');
    } finally {
      setSavingSlots(false);
    }
  };

  const withEmail = leads.filter((l) => l.email);
  const adviserAsks = leads.filter((l) => l.extraction?.asked_adviser_view === true).length;
  const pitched = leads.filter((l) => l.status !== 'active').length;
  const shown = onlyLeads ? withEmail : leads;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="text-[13px] text-white/70">
          <span className="font-semibold text-white/90">{leads.length}</span> conversations (90 days) ·{' '}
          <span className="font-semibold text-white/90">{pitched}</span> reached the offer ·{' '}
          <span className="font-semibold text-white/90">{withEmail.length}</span> left an email ·{' '}
          <span className="font-semibold text-white/90">{adviserAsks}</span> asked for an adviser view
        </div>

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveSlots();
          }}
        >
          <label htmlFor="pilot-slots" className="text-[12.5px] font-semibold text-white/70">
            Pilot slots left
          </label>
          <input
            id="pilot-slots"
            type="number"
            min={0}
            max={100}
            value={slotsDraft}
            onChange={(e) => setSlotsDraft(e.target.value)}
            className="w-16 rounded-lg border border-white/15 bg-[#122E3B] px-2 py-1 text-[13px] font-semibold text-white outline-none focus:border-[#27A1A1]"
          />
          <button
            type="submit"
            disabled={savingSlots || slotsDraft === String(slots)}
            className="rounded-lg bg-[#27A1A1] px-3 py-1 text-[12.5px] font-bold text-white disabled:opacity-40"
          >
            {savingSlots ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
          </button>
          <button type="button" onClick={load} title="Reload" className="rounded-lg p-1.5 text-white/50 hover:text-white">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </form>
      </div>
      {slots === 0 && (
        <p className="text-[12.5px] text-[#EFBE48]">No pilot slots left: the chat offers free credits first to everyone.</p>
      )}

      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setOnlyLeads(v)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
              onlyLeads === v ? 'border-[#27A1A1] bg-[#27A1A1]/20 text-white' : 'border-white/15 text-white/60 hover:text-white'
            }`}
          >
            {v ? `Leads (${withEmail.length})` : `All conversations (${leads.length})`}
          </button>
        ))}
      </div>

      {error && <p className="text-[13px] text-red-300">{error}</p>}
      {!loading && shown.length === 0 && (
        <p className="text-[13px] text-white/50">{onlyLeads ? 'No leads yet.' : 'No conversations yet.'}</p>
      )}
      <div className="space-y-2.5">
        {shown.map((lead) => (
          <LeadRow key={lead.id} lead={lead} onStatus={setStatus} />
        ))}
      </div>
    </div>
  );
};

export default PartnerLeadsCard;
