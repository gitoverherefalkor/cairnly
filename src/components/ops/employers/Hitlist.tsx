// The employer hitlist: companies found by research (not Tasha's address
// book) that cold outreach to HR buyers will work through. Same employers
// table as the pipeline; a hitlist company is status 'prospect' until someone
// reaches out, then it shows up in the pipeline too.
//
// The tier is computed in the database (view employer_hitlist): this screen
// shows it, lets Sjoerd or Tasha override it, and lets Tasha mark in bulk who
// she knows. Nothing here sends mail. Rules: src/lib/hitlist.ts and
// supabase/migrations/20261015150000_employer_hitlist.sql.

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Ban, ChevronDown, ChevronRight, ExternalLink, Upload, ListX, Target } from 'lucide-react';
import {
  SIZE_LABEL, SIZE_BANDS, SOURCE_LABEL, TASHA_LABEL, SIGNAL_LABEL, SIGNAL_FRESH_MONTHS,
  IMPORT_HEADER, companySuppression, parseTable, planImport,
  type HitlistRow, type HitlistFields, type EmployerSignal, type Suppression, type SignalKind,
  type TashaLink, type Tier, type Country, type SizeBand, type CompanySource, type ImportPlan,
} from '@/lib/hitlist';
import { ymd, type EmployerContact, type EmployerEvent, type EmployerTouch, type EmployerLite } from '@/lib/employerOutreach';
import { ContactsBlock, TouchLog, blockCompany, type CallEmployers, type BlockContext } from './EmployerOutreach';

export interface HitlistEmployer extends EmployerLite, HitlistFields {
  notes: string | null;
}

const fieldCls = 'bg-[#0E2531] border-white/[0.14]';
const selectCls = 'h-8 rounded-md border border-white/[0.14] bg-[#0E2531] px-2 text-xs text-white/[0.88]';
const chip = (on: boolean) =>
  `text-[11px] px-2 py-0.5 rounded-full border transition-all ${
    on ? 'bg-atlas-teal/20 text-atlas-teal border-atlas-teal/40' : 'bg-white/[0.05] text-white/60 border-white/[0.14] hover:border-white/25'
  }`;

// Same tier colours as the bureau outreach tab.
const TIER_CLS: Record<Tier, string> = {
  A: 'bg-atlas-teal/20 text-atlas-teal border-atlas-teal/40',
  B: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  C: 'bg-white/10 text-white/70 border-white/20',
};

type TierFilter = 'all' | Tier | 'none' | 'excluded' | 'warm';
type StageFilter = 'all' | 'prospect' | 'contacted';

const TIER_ORDER = (r: HitlistRow | undefined) =>
  r?.effective_tier === 'A' ? 0 : r?.effective_tier === 'B' ? 1 : r?.effective_tier === 'C' ? 2 : r?.hard_exclusion || r?.soft_exclusion ? 4 : 3;

const fmtDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
};

function TierBadge({ row, override }: { row?: HitlistRow; override: Tier | null }) {
  if (!row) return <span className="text-[11px] text-white/40">-</span>;
  if (row.hard_exclusion === 'tasha_warm') {
    return <span title={row.tier_reason} className="rounded border border-[#EFBE48]/40 bg-[rgba(239,190,72,0.12)] px-1.5 py-0.5 text-[11px] text-[#EFBE48]">Warm: Tasha</span>;
  }
  if (row.hard_exclusion === 'suppressed') {
    return <span title={row.tier_reason} className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] text-red-200"><Ban className="h-3 w-3" /> No</span>;
  }
  const t = row.effective_tier;
  const title = override
    ? `Set by hand to ${override}. Suggested: ${row.suggested_tier ?? 'none'} (${row.tier_reason})`
    : row.tier_reason;
  if (!t) {
    return <span title={title} className="text-[11px] text-white/45">{row.soft_exclusion ? 'Excluded' : 'No tier yet'}</span>;
  }
  return (
    <span title={title} className={`rounded border px-1.5 py-0.5 text-[11px] ${TIER_CLS[t]}`}>
      {t}{override ? ' ✎' : ''}
    </span>
  );
}

// ─── Company editor ──────────────────────────────────────────────────────────

function CompanyForm({
  existing, call, onDone, onCancel,
}: {
  existing?: HitlistEmployer;
  call: CallEmployers;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [country, setCountry] = useState<Country | ''>(existing?.country ?? '');
  const [size, setSize] = useState<SizeBand | ''>(existing?.size_band ?? '');
  const [sector, setSector] = useState(existing?.sector ?? '');
  const [website, setWebsite] = useState(existing?.website ?? '');
  const [source, setSource] = useState<CompanySource | ''>(existing?.source ?? '');
  const [sourceUrl, setSourceUrl] = useState(existing?.source_url ?? '');
  const [frontline, setFrontline] = useState(existing?.frontline ?? false);
  const [tasha, setTasha] = useState<TashaLink>(existing?.tasha_link ?? 'unchecked');
  const [tier, setTier] = useState<Tier | ''>(existing?.tier_override ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await call({
        action: 'save',
        id: existing?.id,
        name,
        status: existing?.status ?? 'prospect',
        notes,
        country: country || null,
        sizeBand: size || null,
        sector,
        website,
        source: source || null,
        sourceUrl,
        frontline,
        tashaLink: tasha,
        tierOverride: tier || null,
      });
      toast.success(existing ? `${name} saved` : `${name} added to the hitlist`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const lbl = 'text-[11px] text-white/60';
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block"><span className={lbl}>Company</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme B.V." className={`mt-0.5 h-8 text-xs ${fieldCls}`} />
        </label>
        <label className="block"><span className={lbl}>Website</span>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.nl" className={`mt-0.5 h-8 text-xs ${fieldCls}`} />
        </label>
        <label className="block"><span className={lbl}>Sector</span>
          <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Insurance" className={`mt-0.5 h-8 text-xs ${fieldCls}`} />
        </label>
        <div className="flex gap-2">
          <label className="block"><span className={lbl}>Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value as Country | '')} className={`mt-0.5 block ${selectCls}`}>
              <option value="">?</option><option value="NL">NL</option><option value="UK">UK</option>
            </select>
          </label>
          <label className="block"><span className={lbl}>Employees</span>
            <select value={size} onChange={(e) => setSize(e.target.value as SizeBand | '')} className={`mt-0.5 block ${selectCls}`}>
              <option value="">?</option>
              {SIZE_BANDS.map((b) => <option key={b} value={b}>{SIZE_LABEL[b]}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block"><span className={lbl}>Found via</span>
          <select value={source} onChange={(e) => setSource(e.target.value as CompanySource | '')} className={`mt-0.5 block w-full ${selectCls}`}>
            <option value="">?</option>
            {(Object.keys(SOURCE_LABEL) as CompanySource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-3"><span className={lbl}>Source link (article, post, event page)</span>
          <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" className={`mt-0.5 h-8 text-xs ${fieldCls}`} />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block"><span className={lbl}>Tasha knows someone there?</span>
          <select value={tasha} onChange={(e) => setTasha(e.target.value as TashaLink)} className={`mt-0.5 block ${selectCls}`}>
            {(Object.keys(TASHA_LABEL) as TashaLink[]).map((t) => <option key={t} value={t}>{TASHA_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="block"><span className={lbl}>Tier</span>
          <select value={tier} onChange={(e) => setTier(e.target.value as Tier | '')} className={`mt-0.5 block ${selectCls}`}>
            <option value="">Automatic</option><option value="A">A (set by hand)</option><option value="B">B (set by hand)</option><option value="C">C (set by hand)</option>
          </select>
        </label>
        <label className="inline-flex h-8 items-center gap-1.5 text-[11px] text-white/70">
          <input type="checkbox" checked={frontline} onChange={(e) => setFrontline(e.target.checked)} />
          Mostly frontline / blue-collar staff
        </label>
      </div>
      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={`h-8 text-xs ${fieldCls}`} />
      {err && <div className="text-[11px] text-red-400">{err}</div>}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={busy || !name.trim()} size="sm" className="h-7 bg-atlas-teal hover:bg-atlas-teal/90 text-xs">
          {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} {existing ? 'Save company' : 'Add to hitlist'}
        </Button>
        {onCancel && <button onClick={onCancel} className="text-[11px] text-white/60 hover:text-white/85">Cancel</button>}
      </div>
    </div>
  );
}

// ─── Signals ─────────────────────────────────────────────────────────────────

function SignalsBlock({
  employerId, signals, call, onChanged,
}: {
  employerId: string;
  signals: EmployerSignal[];
  call: CallEmployers;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<SignalKind>('reorg');
  const [day, setDay] = useState(ymd(new Date()));
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await call({ action: 'signal_save', employerId, kind, signalDate: day, sourceUrl: url, note });
      setAdding(false); setUrl(''); setNote('');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: EmployerSignal) => {
    if (!window.confirm('Delete this signal?')) return;
    try {
      await call({ action: 'signal_delete', signalId: s.id });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
      <div className="flex items-center gap-2 text-[11px] text-white/55">
        Signals
        {!adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 text-white/70 hover:text-white/90">
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>
      {signals.length === 0 && !adding && <div className="text-[11px] text-white/45">No signals yet.</div>}
      {signals.map((s) => (
        <div key={s.id} className="group flex flex-wrap items-baseline gap-x-2 text-[11px]">
          <span className={s.fresh ? 'text-emerald-300' : 'text-white/40 line-through'} title={s.fresh ? `Counts until ${fmtDay(s.fresh_until)}` : `Expired ${fmtDay(s.fresh_until)}`}>
            {SIGNAL_LABEL[s.kind]}
          </span>
          <span className="text-white/50">{fmtDay(s.signal_date)}</span>
          <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#7FBCD9] hover:underline">
            source <ExternalLink className="h-2.5 w-2.5" />
          </a>
          {s.note && <span className="text-white/60">· {s.note}</span>}
          <button onClick={() => remove(s)} aria-label="Delete signal" className="text-white/30 opacity-0 hover:text-red-300 group-hover:opacity-100 focus:opacity-100">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      {adding && (
        <div className="rounded-md border border-white/10 bg-white/[0.02] p-2 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block"><span className="text-[11px] text-white/60">What</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as SignalKind)} className={`mt-0.5 block ${selectCls}`}>
                {(Object.keys(SIGNAL_LABEL) as SignalKind[]).map((k) => (
                  <option key={k} value={k}>{SIGNAL_LABEL[k]} (counts {SIGNAL_FRESH_MONTHS[k]} months)</option>
                ))}
              </select>
            </label>
            <label className="block"><span className="text-[11px] text-white/60">Announced / posted on</span>
              <Input type="date" value={day} max={ymd(new Date())} onChange={(e) => setDay(e.target.value)} className={`mt-0.5 h-8 text-xs ${fieldCls}`} />
            </label>
            <label className="block flex-1 min-w-[200px]"><span className="text-[11px] text-white/60">Source link</span>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={`mt-0.5 h-8 text-xs ${fieldCls}`} />
            </label>
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional): what happened" className={`h-8 text-xs ${fieldCls}`} />
          <div className="flex gap-2">
            <Button onClick={add} disabled={busy || !url.trim()} size="sm" className="h-7 bg-atlas-teal hover:bg-atlas-teal/90 text-xs">
              {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Add signal
            </Button>
            <button onClick={() => setAdding(false)} className="text-[11px] text-white/60 hover:text-white/85">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Import ──────────────────────────────────────────────────────────────────

function ImportPanel({ call, onDone }: { call: CallEmployers; onDone: () => void }) {
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string[] | null>(null);

  const preview = () => { setResult(null); setPlan(planImport(parseTable(text))); };

  const run = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const res = (await call({ action: 'hitlist_import', companies: plan.companies })) as {
        added: number; matched: number; contactsAdded: number; skipped: string[];
      };
      toast.success(`${res.added} companies added, ${res.matched} already there, ${res.contactsAdded} contacts added`);
      setResult(res.skipped);
      setPlan(null);
      setText('');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const contacts = plan?.companies.reduce((n, c) => n + c.contacts.length, 0) ?? 0;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
      <div className="text-sm font-semibold text-white/[0.88]">Paste a list</div>
      <p className="text-[11px] text-white/60">
        Copy rows from a sheet (or a CSV) with a header row, one row per contact; repeat the company on each row.
        Companies that are already here (same website, or same name) only get their new contacts.
        Personal mailboxes and contacts without a source are left out.
      </p>
      <div className="flex items-center gap-2 text-[11px] text-white/55">
        Columns:
        <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-white/75">{IMPORT_HEADER.split('\t').join(' · ')}</code>
        <button
          onClick={() => { void navigator.clipboard.writeText(IMPORT_HEADER); toast.success('Header copied: paste it as row 1 of your sheet'); }}
          className="text-white/70 hover:text-white/90 underline"
        >
          copy header
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setPlan(null); }}
        rows={6}
        placeholder={IMPORT_HEADER}
        className="w-full rounded-lg border border-white/[0.14] bg-[#0E2531] p-2 font-mono text-[11px] text-white/80"
      />
      <div className="flex items-center gap-2">
        <Button onClick={preview} disabled={!text.trim()} size="sm" variant="outline" className="h-7 border-white/15 text-xs">Check</Button>
        {plan && plan.companies.length > 0 && (
          <Button onClick={run} disabled={busy} size="sm" className="h-7 bg-atlas-teal hover:bg-atlas-teal/90 text-xs">
            {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Import {plan.companies.length} {plan.companies.length === 1 ? 'company' : 'companies'}, {contacts} contacts
          </Button>
        )}
      </div>
      {plan && plan.problems.length > 0 && (
        <ul className="list-disc pl-5 text-[11px] text-[#EFBE48] space-y-0.5">
          {plan.problems.slice(0, 30).map((p, i) => <li key={i}>{p}</li>)}
          {plan.problems.length > 30 && <li>…and {plan.problems.length - 30} more</li>}
        </ul>
      )}
      {result && result.length > 0 && (
        <ul className="list-disc pl-5 text-[11px] text-[#EFBE48] space-y-0.5">
          {result.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}

// ─── Do-not-contact list ─────────────────────────────────────────────────────

const TRACK_LABEL: Record<Suppression['track'], string> = {
  employer: 'Employers',
  outplacement: 'Bureaus',
  manual: 'Manual',
};

function SuppressionList({ list, call, onChanged }: { list: Suppression[]; call: CallEmployers; onChanged: () => void }) {
  const remove = async (s: Suppression) => {
    const what = s.email ?? s.domain ?? s.linkedin;
    if (!window.confirm(`Take ${what} off the do-not-contact list?\n\nOnly for a wrong click: if they said no, leave it. A bureau it closed in the Outreach tab stays closed.`)) return;
    try {
      await call({ action: 'unsuppress', suppressionId: s.id });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  };
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
      <div className="text-sm font-semibold text-white/[0.88]">Do-not-contact list</div>
      <p className="text-[11px] text-white/60">
        One list for every track. Anyone here is never contacted again: not by the hitlist, not in Tasha&apos;s log, not by the bureau mailer.
        A company entry blocks every address at that domain.
      </p>
      {list.length === 0 && <div className="text-[11px] text-white/45">Empty.</div>}
      <div className="space-y-1">
        {list.map((s) => (
          <div key={s.id} className="group flex flex-wrap items-baseline gap-x-2 text-[11px] text-white/70">
            <span className="text-white/[0.88]">{s.email ?? (s.domain ? `everyone at ${s.domain}` : `linkedin.com${s.linkedin}`)}</span>
            <span className="text-white/50">{TRACK_LABEL[s.track]}</span>
            {s.reason && <span className="text-white/55">· {s.reason}</span>}
            <span className="text-white/40">· {new Date(s.created_at).toLocaleDateString('en-GB')}</span>
            <button onClick={() => remove(s)} className="text-white/30 opacity-0 hover:text-red-300 group-hover:opacity-100 focus:opacity-100">remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── The hitlist ─────────────────────────────────────────────────────────────

export default function Hitlist({
  employers, hitlist, signals, suppressions, contacts, touches, events, call, onChanged, account,
}: {
  employers: HitlistEmployer[];
  hitlist: HitlistRow[];
  signals: EmployerSignal[];
  suppressions: Suppression[];
  contacts: EmployerContact[];
  touches: EmployerTouch[];
  events: EmployerEvent[];
  call: CallEmployers;
  onChanged: () => void;
  account: string | null;
}) {
  const [tier, setTier] = useState<TierFilter>('all');
  const [country, setCountry] = useState<'all' | Country>('all');
  const [tasha, setTasha] = useState<'all' | TashaLink>('all');
  const [stage, setStage] = useState<StageFilter>('prospect');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'add' | 'import' | 'list'>('none');
  const [bulkBusy, setBulkBusy] = useState(false);

  const rowById = useMemo(() => new Map(hitlist.map((r) => [r.employer_id, r])), [hitlist]);

  const counts = useMemo(() => {
    const c = { A: 0, B: 0, C: 0, warm: 0, unchecked: 0 };
    for (const e of employers) {
      if (e.status !== 'prospect') continue;
      const r = rowById.get(e.id);
      if (r?.effective_tier) c[r.effective_tier]++;
      if (r?.hard_exclusion === 'tasha_warm') c.warm++;
      if (r?.tasha_effective === 'unchecked') c.unchecked++;
    }
    return c;
  }, [employers, rowById]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return employers
      .filter((e) => stage === 'all' || (stage === 'prospect' ? e.status === 'prospect' : e.status !== 'prospect'))
      .filter((e) => country === 'all' || e.country === country)
      .filter((e) => tasha === 'all' || rowById.get(e.id)?.tasha_effective === tasha)
      .filter((e) => {
        const r = rowById.get(e.id);
        if (tier === 'all') return true;
        if (tier === 'warm') return r?.hard_exclusion === 'tasha_warm';
        if (tier === 'excluded') return Boolean(r?.hard_exclusion || (r?.soft_exclusion && !r.effective_tier));
        if (tier === 'none') return !r?.effective_tier && !r?.hard_exclusion && !r?.soft_exclusion;
        return r?.effective_tier === tier;
      })
      .filter((e) => !needle || e.name.toLowerCase().includes(needle) || (e.domain ?? '').includes(needle) || (e.sector ?? '').toLowerCase().includes(needle))
      .sort((a, b) => TIER_ORDER(rowById.get(a.id)) - TIER_ORDER(rowById.get(b.id)) || a.name.localeCompare(b.name));
  }, [employers, rowById, tier, country, tasha, stage, q]);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const allShownSelected = shown.length > 0 && shown.every((e) => selected.has(e.id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((e) => e.id)));

  const bulk = async (fields: Record<string, unknown>, label: string) => {
    setBulkBusy(true);
    try {
      const res = (await call({ action: 'bulk_set', ids: [...selected], ...fields })) as { updated: number };
      toast.success(`${label}: ${res.updated} ${res.updated === 1 ? 'company' : 'companies'}`);
      setSelected(new Set());
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const Tile = ({ label, value, on, onClick, tone }: { label: string; value: number; on: boolean; onClick: () => void; tone?: string }) => (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg border px-3 py-2 text-left transition-all ${on ? 'border-atlas-teal/50 bg-atlas-teal/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}
    >
      <div className="text-[11px] text-white/60">{label}</div>
      <div className={`text-xl font-semibold ${tone ?? 'text-white/[0.92]'}`}>{value}</div>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Tile label="Tier A: human review" value={counts.A} on={tier === 'A'} onClick={() => setTier(tier === 'A' ? 'all' : 'A')} tone="text-atlas-teal" />
        <Tile label="Tier B: signal" value={counts.B} on={tier === 'B'} onClick={() => setTier(tier === 'B' ? 'all' : 'B')} tone="text-amber-300" />
        <Tile label="Tier C: fit, no signal" value={counts.C} on={tier === 'C'} onClick={() => setTier(tier === 'C' ? 'all' : 'C')} />
        <Tile label="Warm intros for Tasha" value={counts.warm} on={tier === 'warm'} onClick={() => setTier(tier === 'warm' ? 'all' : 'warm')} tone="text-[#EFBE48]" />
        <Tile label="Tasha hasn't checked" value={counts.unchecked} on={tasha === 'unchecked'} onClick={() => setTasha(tasha === 'unchecked' ? 'all' : 'unchecked')} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setPanel(panel === 'add' ? 'none' : 'add')} size="sm" variant="outline" className="h-7 border-white/15 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add company
        </Button>
        <Button onClick={() => setPanel(panel === 'import' ? 'none' : 'import')} size="sm" variant="outline" className="h-7 border-white/15 text-xs">
          <Upload className="h-3 w-3 mr-1" /> Paste a list
        </Button>
        <Button onClick={() => setPanel(panel === 'list' ? 'none' : 'list')} size="sm" variant="outline" className="h-7 border-white/15 text-xs">
          <ListX className="h-3 w-3 mr-1" /> Do-not-contact list ({suppressions.length})
        </Button>
      </div>

      {panel === 'add' && <CompanyForm call={call} onDone={() => { setPanel('none'); onChanged(); }} onCancel={() => setPanel('none')} />}
      {panel === 'import' && <ImportPanel call={call} onDone={onChanged} />}
      {panel === 'list' && <SuppressionList list={suppressions} call={call} onChanged={onChanged} />}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-[11px] text-white/55">Tier</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {(['all', 'A', 'B', 'C', 'none', 'warm', 'excluded'] as TierFilter[]).map((t) => (
              <button key={t} onClick={() => setTier(t)} className={chip(tier === t)}>
                {{ all: 'All', A: 'A', B: 'B', C: 'C', none: 'No tier yet', warm: 'Warm (Tasha)', excluded: 'Excluded' }[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-white/55">Country</div>
          <div className="mt-1 flex gap-1">
            {(['all', 'NL', 'UK'] as const).map((c) => (
              <button key={c} onClick={() => setCountry(c)} className={chip(country === c)}>{c === 'all' ? 'All' : c}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-white/55">Tasha</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {(['all', 'unchecked', 'first', 'second', 'none'] as const).map((t) => (
              <button key={t} onClick={() => setTasha(t)} className={chip(tasha === t)}>{t === 'all' ? 'All' : TASHA_LABEL[t]}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-white/55">Stage</div>
          <div className="mt-1 flex gap-1">
            {(['prospect', 'contacted', 'all'] as StageFilter[]).map((s) => (
              <button key={s} onClick={() => setStage(s)} className={chip(stage === s)}>
                {{ prospect: 'Not contacted', contacted: 'In the pipeline', all: 'All' }[s]}
              </button>
            ))}
          </div>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, website, sector" className={`h-8 w-56 text-xs ${fieldCls}`} />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-atlas-teal/40 bg-[#0E2531] px-3 py-2 text-[11px] text-white/80">
          <b>{selected.size} selected</b>
          <span className="text-white/50">Tasha knows them:</span>
          {(['first', 'second', 'none', 'unchecked'] as TashaLink[]).map((t) => (
            <button key={t} disabled={bulkBusy} onClick={() => bulk({ tashaLink: t }, `Tasha: ${TASHA_LABEL[t]}`)} className="rounded border border-white/15 px-2 py-0.5 hover:bg-white/10">
              {TASHA_LABEL[t]}
            </button>
          ))}
          <span className="ml-2 text-white/50">Tier:</span>
          {(['A', 'B', 'C'] as Tier[]).map((t) => (
            <button key={t} disabled={bulkBusy} onClick={() => bulk({ tierOverride: t }, `Tier ${t}`)} className={`rounded border px-2 py-0.5 ${TIER_CLS[t]}`}>{t}</button>
          ))}
          <button disabled={bulkBusy} onClick={() => bulk({ tierOverride: null }, 'Tier back to automatic')} className="rounded border border-white/15 px-2 py-0.5 hover:bg-white/10">Automatic</button>
          {bulkBusy && <Loader2 className="h-3 w-3 animate-spin" />}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-white/55 hover:text-white/85">Clear</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-[11px] text-white/75">
          <thead className="bg-white/[0.03] text-white/55">
            <tr className="text-left">
              <th className="px-3 py-2 w-6">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all shown" />
              </th>
              <th className="px-3 py-2 font-normal">Company</th>
              <th className="px-3 py-2 font-normal">Country</th>
              <th className="px-3 py-2 font-normal">Employees</th>
              <th className="px-3 py-2 font-normal">Signals</th>
              <th className="px-3 py-2 font-normal">Tasha</th>
              <th className="px-3 py-2 font-normal">Contacts</th>
              <th className="px-3 py-2 font-normal">Tier</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-white/55">
                {employers.some((e) => e.status === 'prospect') ? 'No companies match this filter.' : 'The hitlist is empty. Add a company or paste a list.'}
              </td></tr>
            )}
            {shown.map((e) => {
              const r = rowById.get(e.id);
              const isOpen = open === e.id;
              const own = contacts.filter((c) => c.employer_id === e.id);
              const block: BlockContext = { suppressions, employerDomain: e.domain };
              const companyBlocked = companySuppression(e.domain, suppressions);
              return (
                <React.Fragment key={e.id}>
                  <tr className={`border-t border-white/5 ${isOpen ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} aria-label={`Select ${e.name}`} />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setOpen(isOpen ? null : e.id)} className="inline-flex items-center gap-1 text-left text-white/[0.9] hover:text-white">
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {e.name}
                      </button>
                      <div className="pl-4 text-white/45">
                        {[e.domain, e.sector, e.status !== 'prospect' ? 'in the pipeline' : null].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-3 py-2">{e.country ?? '?'}</td>
                    <td className="px-3 py-2">{e.size_band ? SIZE_LABEL[e.size_band] : '?'}{e.frontline ? ' · frontline' : ''}</td>
                    <td className="px-3 py-2">
                      {r && r.all_signals > 0 ? (
                        <span className={r.fresh_signals > 0 ? (r.reorg_fresh ? 'text-atlas-teal' : 'text-emerald-300') : 'text-white/45'}>
                          {r.fresh_signals} fresh{r.all_signals > r.fresh_signals ? ` / ${r.all_signals}` : ''}
                        </span>
                      ) : <span className="text-white/35">-</span>}
                    </td>
                    <td className="px-3 py-2">{r ? TASHA_LABEL[r.tasha_effective] : '-'}</td>
                    <td className="px-3 py-2">{own.length || <span className="text-white/35">0</span>}</td>
                    <td className="px-3 py-2"><TierBadge row={r} override={e.tier_override} /></td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-white/[0.02]">
                      <td colSpan={8} className="px-4 pb-4 pt-2">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <Target className="h-3 w-3 text-white/50" />
                          <span className="text-white/70">{r?.tier_reason}</span>
                          {e.source_url && (
                            <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#7FBCD9] hover:underline">
                              found via {e.source ? SOURCE_LABEL[e.source] : 'link'} <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          {companyBlocked ? (
                            <span className="ml-auto inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-red-200">
                              <Ban className="h-3 w-3" /> Whole company on the do-not-contact list
                            </span>
                          ) : (
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Block everyone at ${e.name}${e.domain ? ` (${e.domain})` : ''}? Nobody there is contacted again, on any track.`)) return;
                                await blockCompany({ employerId: e.id }, call);
                                onChanged();
                              }}
                              className="ml-auto text-white/45 hover:text-red-300"
                            >
                              Block whole company
                            </button>
                          )}
                        </div>
                        <CompanyForm key={`${e.id}-${e.tier_override}-${e.tasha_link}`} existing={e} call={call} onDone={onChanged} />
                        <SignalsBlock employerId={e.id} signals={signals.filter((s) => s.employer_id === e.id)} call={call} onChanged={onChanged} />
                        <ContactsBlock
                          employerId={e.id} contacts={own} call={call} onChanged={onChanged}
                          block={block} touches={touches.filter((t) => t.employer_id === e.id)}
                        />
                        <TouchLog
                          employer={e}
                          touches={touches.filter((t) => t.employer_id === e.id)}
                          contacts={own}
                          events={events}
                          call={call}
                          onChanged={onChanged}
                          account={account}
                          block={block}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-white/50">
        The tier is suggested from the data and can be set by hand (✎). A: fresh reorg signal, 500+ employees or Tasha 2nd degree, so a person reviews every message.
        B: fits and has a fresh signal. C: fits, no signal. Signals count for 6 months (reorg, L&amp;D job ad) or 12 (new HR lead, CAO budget).
        Tasha 1st degree goes to her as a warm intro and is never contacted cold. Under 100 employees or mostly frontline is excluded unless you set a tier by hand.
        Hover a tier to see why.
      </p>
    </div>
  );
}
