// EmployersTab — the employers channel (Tasha's pipeline) in the Ops console.
//
// Everything goes through the admin-gated ops-employers edge function. The flow:
// an HR prospect mails Tasha via "Get a trial code" on /employers (the clicks
// show up top), she adds the company here, clicks "Trial code" and mails or
// hands over the one link. Once they buy, "Seat codes" mints the batch for
// their employees, and the card shows how many were redeemed. Counts only,
// never who: that is what /employers promises the employer, and Ops keeps to it.
//
// Employers are not partners on purpose: see
// supabase/migrations/20261006130000_employers.sql.

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, Check, Briefcase, RefreshCw, Pencil, X, Trash2, Mail, MousePointerClick } from 'lucide-react';

type EmployerStatus = 'lead' | 'trial_sent' | 'in_talks' | 'customer' | 'lost';
type CodeKind = 'trial' | 'seat';

interface Employer {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  status: EmployerStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  trial_issued?: number;
  trial_claimed?: number;
  trial_started?: number;
  trial_reports?: number;
  trial_last_minted_at?: string | null;
  seats_issued?: number;
  seats_claimed?: number;
}

interface TrialClick {
  created_at: string;
  country: string | null;
}

const STATUS_LABEL: Record<EmployerStatus, string> = {
  lead: 'Lead',
  trial_sent: 'Trial sent',
  in_talks: 'In talks',
  customer: 'Customer',
  lost: 'Lost',
};

const STATUS_TONE: Record<EmployerStatus, string> = {
  lead: 'bg-white/[0.08] text-white/75',
  trial_sent: 'bg-[rgba(57,137,175,0.2)] text-[#7FBCD9]',
  in_talks: 'bg-[rgba(239,190,72,0.18)] text-[#EFBE48]',
  customer: 'bg-emerald-500/15 text-emerald-300',
  lost: 'bg-red-500/15 text-red-300',
};

/** Trial codes default to 30 days, so a forgotten trial does not sit valid forever. */
const TRIAL_DAYS = 30;

/** Union of what the ops-employers actions return; each caller reads its own part. */
interface EmployersResponse {
  employers?: Employer[];
  trialClicks?: TrialClick[];
  clickWindowDays?: number;
  id?: string;
  codes?: string[];
  links?: string[];
  codesDeleted?: number;
}

async function callEmployers(body: Record<string, unknown>): Promise<EmployersResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const r = await fetch(`${url}/functions/v1/ops-employers`, {
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

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** yyyy-mm-dd, `days` from today, for a date input. */
function dateInDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** One line on how far the trial got: the furthest step wins. */
function trialLine(e: Employer): { text: string; tone: string } {
  if (!e.trial_issued) return { text: 'No trial code yet', tone: 'text-white/55' };
  if (e.trial_reports) return { text: 'Trial: report done', tone: 'text-emerald-300' };
  if (e.trial_started) return { text: 'Trial: assessment started', tone: 'text-[#7FBCD9]' };
  if (e.trial_claimed) return { text: 'Trial: signed up, not started', tone: 'text-[#7FBCD9]' };
  const sent = e.trial_last_minted_at ? ` ${fmtDate(e.trial_last_minted_at)}` : '';
  return { text: `Trial: code made${sent}, not used yet`, tone: 'text-amber-300' };
}

// ─── Trial requests (clicks on "Get a trial code") ──────────────────────────

function TrialRequests({ clicks, windowDays }: { clicks: TrialClick[]; windowDays: number }) {
  const last7 = clicks.filter((c) => Date.now() - new Date(c.created_at).getTime() < 7 * 86_400_000).length;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white/[0.88]">
        <MousePointerClick className="h-4 w-4" />
        Trial requests
        <span className="text-[11px] font-normal text-white/60">
          {clicks.length} in the last {windowDays} days{last7 > 0 ? ` · ${last7} this week` : ''}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-white/60">
        Clicks on “Get a trial code” on /employers. The button opens a mail to natasha@cairnly.io in the visitor’s own
        mail app, so a click means they started that mail. Whether they actually sent it only shows in Tasha’s inbox.
      </p>
      {clicks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {clicks.slice(0, 20).map((c, i) => (
            <span key={i} className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/75">
              {fmtDateTime(c.created_at)}
              {c.country ? ` · ${c.country}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add / edit form ─────────────────────────────────────────────────────────

function EmployerForm({
  editing,
  onSaved,
  onCancel,
}: {
  editing: Employer | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [contactName, setContactName] = useState(editing?.contact_name ?? '');
  const [contactEmail, setContactEmail] = useState(editing?.contact_email ?? '');
  const [status, setStatus] = useState<EmployerStatus>(editing?.status ?? 'lead');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      await callEmployers({ action: 'save', id: editing?.id, name, contactName, contactEmail, status, notes });
      toast.success(editing ? `${name} updated` : `${name} added`);
      if (!editing) {
        setName(''); setContactName(''); setContactEmail(''); setStatus('lead'); setNotes('');
      }
      onSaved();
      onCancel?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const unused = (editing.trial_issued ?? 0) + (editing.seats_issued ?? 0) - (editing.trial_claimed ?? 0) - (editing.seats_claimed ?? 0);
    const msg = [
      `Delete ${editing.name}?`,
      unused > 0 ? `• Unused codes are deleted: links already sent stop working.` : null,
      'People who already signed up keep their account and report.',
    ].filter(Boolean).join('\n');
    if (!window.confirm(msg)) return;
    setDeleting(true);
    try {
      const res = await callEmployers({ action: 'delete', id: editing.id });
      toast.success(`${editing.name} deleted${res.codesDeleted ? `, ${res.codesDeleted} unused codes with it` : ''}`);
      onSaved();
      onCancel?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/[0.88]">
        {editing ? <Pencil className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
        {editing ? 'Edit this employer' : 'Add an employer'}
        {onCancel && (
          <button onClick={onCancel} className="ml-auto inline-flex items-center gap-1 text-[11px] font-normal text-white/60 hover:text-white/80">
            <X className="h-3 w-3" /> Cancel
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-white/70">Company</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme B.V." className="mt-1 bg-[#0E2531] border-white/[0.14]" />
        </label>
        <label className="block">
          <span className="text-xs text-white/70">Contact person</span>
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Head of HR" className="mt-1 bg-[#0E2531] border-white/[0.14]" />
        </label>
        <label className="block">
          <span className="text-xs text-white/70">Contact email</span>
          <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hr@acme.nl" className="mt-1 bg-[#0E2531] border-white/[0.14]" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="block">
          <span className="text-xs text-white/70">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EmployerStatus)}
            className="mt-1 h-10 w-full rounded-md border border-white/[0.14] bg-[#0E2531] px-2 text-sm text-white/[0.88]"
          >
            {(Object.keys(STATUS_LABEL) as EmployerStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-white/70">Notes</span>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Met at HR event, 250 staff, decides in Q1" className="mt-1 bg-[#0E2531] border-white/[0.14]" />
        </label>
      </div>

      {err && <div className="text-xs text-red-400">{err}</div>}

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || deleting || !name.trim()} size="sm" className="bg-atlas-teal hover:bg-atlas-teal/90">
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {editing ? 'Save changes' : 'Save employer'}
        </Button>
        {editing && (
          <button
            onClick={remove}
            disabled={saving || deleting}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete employer
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Mint codes ──────────────────────────────────────────────────────────────

function MintRow({ employer, onMinted }: { employer: Employer; onMinted: () => void }) {
  const [kind, setKind] = useState<CodeKind>('trial');
  const [count, setCount] = useState('1');
  const [expires, setExpires] = useState(dateInDays(TRIAL_DAYS));
  const [lang, setLang] = useState<'nl' | 'en'>('nl');
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // A trial is one code with the 30-day default; a seat batch has no default
  // expiry, since the employer decides how long their rollout runs.
  const pickKind = (k: CodeKind) => {
    setKind(k);
    setCount(k === 'trial' ? '1' : '10');
    setExpires(k === 'trial' ? dateInDays(TRIAL_DAYS) : '');
    setLinks(null);
  };

  const mint = async () => {
    setErr(null);
    setBusy(true);
    try {
      const res = await callEmployers({
        action: 'mint',
        id: employer.id,
        kind,
        count: Number(count),
        lang,
        // End of day, so a code that "expires on the 31st" works all of the 31st.
        expiresAt: expires ? `${expires}T23:59:00` : null,
      });
      setLinks(res.links ?? []);
      onMinted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to mint');
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    if (!links) return;
    await navigator.clipboard.writeText(links.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const mailHref =
    links && links.length === 1 && employer.contact_email
      ? `mailto:${employer.contact_email}?body=${encodeURIComponent(links[0])}`
      : null;

  return (
    <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="inline-flex rounded-md border border-white/[0.14] p-0.5">
          {(['trial', 'seat'] as CodeKind[]).map((k) => (
            <button
              key={k}
              onClick={() => pickKind(k)}
              className={`h-7 rounded px-2.5 text-xs ${kind === k ? 'bg-white/[0.14] text-white' : 'text-white/60 hover:text-white/85'}`}
            >
              {k === 'trial' ? 'Trial code' : 'Seat codes'}
            </button>
          ))}
        </div>
        {kind === 'seat' && (
          <label className="block">
            <span className="text-[11px] text-white/60">How many</span>
            <Input value={count} onChange={(e) => setCount(e.target.value)} className="mt-0.5 h-8 w-20 bg-[#0E2531] border-white/[0.14] text-xs" />
          </label>
        )}
        <label className="block">
          <span className="text-[11px] text-white/60">Expires{kind === 'seat' ? ' (optional)' : ''}</span>
          <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="mt-0.5 h-8 bg-[#0E2531] border-white/[0.14] text-xs" />
        </label>
        <label className="block">
          <span className="text-[11px] text-white/60">Link language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as 'nl' | 'en')}
            className="mt-0.5 h-8 rounded border border-white/[0.08] bg-[#0E2531] px-2 text-xs text-white/[0.88]"
          >
            <option value="nl">Nederlands</option>
            <option value="en">English</option>
          </select>
        </label>
        <Button onClick={mint} disabled={busy} size="sm" variant="outline" className="h-8 border-white/15 text-xs">
          {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {kind === 'trial' ? 'Make trial link' : 'Mint'}
        </Button>
      </div>
      <p className="text-[11px] text-white/50">
        {kind === 'trial'
          ? 'For the HR contact to try it themselves. Normal Cairnly experience, no employer notice.'
          : 'For their employees. The first screen tells them their employer paid and sees nothing. Here you only see how many were redeemed.'}
      </p>

      {err && <div className="text-xs text-red-400">{err}</div>}

      {links && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-emerald-400">{links.length === 1 ? 'Link ready' : `${links.length} links ready`}</span>
            <Button onClick={copyAll} size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? 'Copied' : links.length === 1 ? 'Copy' : 'Copy all'}
            </Button>
            {mailHref && (
              <a href={mailHref} className="inline-flex h-6 items-center rounded px-2 text-[11px] text-white/80 hover:bg-white/10">
                <Mail className="h-3 w-3 mr-1" /> Mail to {employer.contact_email}
              </a>
            )}
          </div>
          <textarea
            readOnly
            value={links.join('\n')}
            rows={Math.min(6, links.length)}
            className="w-full rounded-lg border border-white/[0.14] bg-[#0E2531] p-2 font-mono text-[11px] text-white/80"
          />
          <p className="text-[11px] text-white/60">
            One link is one person. Copy now: the codes stay in the database, but this list is not shown again.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

const EmployersTab: React.FC = () => {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [clicks, setClicks] = useState<TrialClick[]>([]);
  const [windowDays, setWindowDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await callEmployers({ action: 'list' });
      setEmployers(res.employers ?? []);
      setClicks(res.trialClicks ?? []);
      setWindowDays(res.clickWindowDays ?? 90);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <TrialRequests clicks={clicks} windowDays={windowDays} />

      <EmployerForm editing={null} onSaved={load} />

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/[0.88]">Employers</h3>
        <Button onClick={load} size="sm" variant="ghost" className="h-7 px-2 text-xs text-white/70">
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {err && <div className="text-xs text-red-400">{err}</div>}
      {loading && <div className="flex items-center gap-2 text-xs text-white/60"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>}

      {!loading && employers.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-white/60">
          No employers yet. Add one above.
        </div>
      )}

      {employers.map((e) => {
        const trial = trialLine(e);
        return (
          <div key={e.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-white/[0.92]">{e.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_TONE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
              {(e.contact_name || e.contact_email) && (
                <span className="text-[11px] text-white/60">
                  {[e.contact_name, e.contact_email].filter(Boolean).join(' · ')}
                </span>
              )}
              <button
                onClick={() => setEditingId(editingId === e.id ? null : e.id)}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white/[0.88]"
              >
                <Pencil className="h-3 w-3" /> {editingId === e.id ? 'Close' : 'Edit'}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/70">
              <span className={trial.tone}>{trial.text}</span>
              {(e.seats_issued ?? 0) > 0 && (
                <span>
                  Seats redeemed <b className="text-white/[0.88]">{e.seats_claimed ?? 0}</b> of {e.seats_issued}
                </span>
              )}
              <span className="text-white/45">updated {fmtDate(e.updated_at)}</span>
            </div>
            {e.notes && <div className="mt-1 text-[11px] text-white/60">{e.notes}</div>}

            {editingId === e.id && (
              <div className="mt-3">
                <EmployerForm editing={e} onSaved={load} onCancel={() => setEditingId(null)} />
              </div>
            )}

            <MintRow employer={e} onMinted={load} />
          </div>
        );
      })}
    </div>
  );
};

export default EmployersTab;
