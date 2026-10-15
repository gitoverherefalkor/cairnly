// The outreach half of the Employers tab: stats, the follow-up list, events,
// and per employer its contacts and touch log. All logged by hand by Tasha
// (LinkedIn has no API we may use, her mail runs from her own inbox). The
// numbers come from src/lib/employerOutreach.ts.

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Plus, Trash2, Linkedin, CalendarDays, BellRing, BarChart3, X, ExternalLink, MessageSquarePlus, CalendarPlus, Ban,
} from 'lucide-react';
import {
  CHANNEL_LABEL, KIND_LABEL, STAGE_LABEL, CLOSED_STATUSES,
  computeStats, dueFollowUps, personLabel, suggestFollowUp, ymd, googleCalendarUrl, followUpDetails,
  type Channel, type TouchKind, type LinkedinStage, type Period,
  type EmployerContact, type EmployerEvent, type EmployerTouch, type EmployerLite,
} from '@/lib/employerOutreach';
import {
  ROLE_LABEL, TASHA_LABEL, MAX_FOLLOW_UPS, followUpCount, suggestRoleType, suppressionFor, isWorkEmail,
  type RoleType, type TashaLink, type Suppression,
} from '@/lib/hitlist';

export type CallEmployers = (body: Record<string, unknown>) => Promise<unknown>;

const fieldCls = 'bg-[#0E2531] border-white/[0.14]';
const selectCls = 'h-8 rounded-md border border-white/[0.14] bg-[#0E2531] px-2 text-xs text-white/[0.88]';

const fmtDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : '–');

const STAGE_TONE: Record<LinkedinStage, string> = {
  none: 'text-white/55',
  invite_sent: 'text-[#7FBCD9]',
  connected: 'text-emerald-300',
  in_conversation: 'text-[#EFBE48]',
};

// ─── Overview: stats, follow-ups due, events ─────────────────────────────────

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[11px] text-white/60">{label}</div>
      <div className="text-xl font-semibold text-white/[0.92]">{value}</div>
      {sub && <div className="text-[11px] text-white/50">{sub}</div>}
    </div>
  );
}

export function OutreachOverview<E extends EmployerLite>({
  employers, contacts, events, touches, call, onChanged, onJump,
}: {
  employers: E[];
  contacts: EmployerContact[];
  events: EmployerEvent[];
  touches: EmployerTouch[];
  call: CallEmployers;
  onChanged: () => void;
  onJump: (employerId: string) => void;
}) {
  const [period, setPeriod] = useState<Period>(30);
  const today = ymd(new Date());
  const stats = useMemo(
    () => computeStats(touches, contacts, events, employers, period, today),
    [touches, contacts, events, employers, period, today],
  );
  const due = useMemo(() => dueFollowUps(employers, today), [employers, today]);
  const pipeline = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of employers) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [employers]);

  return (
    <div className="space-y-3">
      {/* Follow up today */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/[0.88]">
          <BellRing className="h-4 w-4" /> Follow up today
          <span className="text-[11px] font-normal text-white/60">
            {due.length === 0 ? 'nothing due' : `${due.length} due`}
          </span>
        </div>
        {due.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {due.map((e) => (
              <button
                key={e.id}
                onClick={() => onJump(e.id)}
                className={`rounded px-2 py-1 text-[11px] hover:bg-white/10 ${
                  e.follow_up_on! < today ? 'bg-red-500/15 text-red-200' : 'bg-[rgba(239,190,72,0.15)] text-[#EFBE48]'
                }`}
              >
                {e.name} · {e.follow_up_on! < today ? `overdue since ${fmtDay(e.follow_up_on!)}` : 'today'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white/[0.88]">
          <BarChart3 className="h-4 w-4" /> Outreach
          <div className="ml-auto inline-flex rounded-md border border-white/[0.14] p-0.5">
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`h-6 rounded px-2 text-[11px] font-normal ${period === p ? 'bg-white/[0.14] text-white' : 'text-white/60 hover:text-white/85'}`}
              >
                {p} days
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="First contacts" value={stats.totals.first_contact} />
          <Tile label="Follow-ups" value={stats.totals.follow_up} />
          <Tile label="Replies" value={stats.totals.reply} />
          <Tile label="Meetings / calls" value={stats.totals.meeting} />
        </div>

        {stats.channels.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-white/75">
              <thead className="text-white/55">
                <tr className="text-left">
                  <th className="py-1 pr-3 font-normal">Channel</th>
                  <th className="py-1 pr-3 font-normal text-right">First</th>
                  <th className="py-1 pr-3 font-normal text-right">Follow-ups</th>
                  <th className="py-1 pr-3 font-normal text-right">Replies</th>
                  <th className="py-1 pr-3 font-normal text-right">Meetings</th>
                  <th className="py-1 font-normal text-right" title="Of the employers first reached on this channel in the period, how many replied or met afterwards (on any channel)">
                    Reply rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.channels.map((r) => (
                  <tr key={r.channel} className="border-t border-white/5">
                    <td className="py-1 pr-3 text-white/[0.88]">{CHANNEL_LABEL[r.channel]}</td>
                    <td className="py-1 pr-3 text-right">{r.firstContacts}</td>
                    <td className="py-1 pr-3 text-right">{r.followUps}</td>
                    <td className="py-1 pr-3 text-right">{r.replies}</td>
                    <td className="py-1 pr-3 text-right">{r.meetings}</td>
                    <td className="py-1 text-right">
                      {pct(r.replied, r.reached)}
                      {r.reached > 0 && <span className="text-white/45"> ({r.replied}/{r.reached})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-white/55">Nothing logged in the last {period} days.</p>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/70">
          <span className="inline-flex items-center gap-1">
            <Linkedin className="h-3 w-3" />
            Invites sent <b className="text-white/[0.88]">{stats.linkedin.invited}</b>
            · accepted <b className="text-white/[0.88]">{stats.linkedin.connected}</b>
            · conversations <b className="text-white/[0.88]">{stats.linkedin.conversations}</b>
            {stats.linkedin.acceptRate !== null && (
              <span className="text-white/50">(accept rate all-time {Math.round(stats.linkedin.acceptRate * 100)}%)</span>
            )}
          </span>
          {stats.byPerson.length > 0 && (
            <span>Logged by {stats.byPerson.map((p) => `${p.who} ${p.count}`).join(' · ')}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/5 pt-2 text-[11px] text-white/70">
          <span className="text-white/55">Pipeline now:</span>
          {(['lead', 'trial_sent', 'in_talks', 'customer', 'lost'] as const).map((s) => (
            <span key={s}>
              {{ lead: 'Lead', trial_sent: 'Trial sent', in_talks: 'In talks', customer: 'Customer', lost: 'Lost' }[s]}{' '}
              <b className="text-white/[0.88]">{pipeline[s] ?? 0}</b>
            </span>
          ))}
        </div>
      </div>

      <EventsCard rows={stats.events} call={call} onChanged={onChanged} />
    </div>
  );
}

function EventsCard({
  rows, call, onChanged,
}: {
  rows: ReturnType<typeof computeStats>['events'];
  call: CallEmployers;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      await call({ action: 'event_save', name, eventDate: date || null });
      toast.success(`${name} added`);
      setName(''); setDate('');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add event');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ev: EmployerEvent) => {
    if (!window.confirm(`Remove ${ev.name} from the list? Touches logged there stay, without the event name.`)) return;
    try {
      await call({ action: 'event_delete', eventId: ev.id });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove event');
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/[0.88]">
        <CalendarDays className="h-4 w-4" /> Events
        <span className="text-[11px] font-normal text-white/60">all-time, so an event's follow-through keeps counting</span>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-white/75">
            <thead className="text-white/55">
              <tr className="text-left">
                <th className="py-1 pr-3 font-normal">Event</th>
                <th className="py-1 pr-3 font-normal text-right">People met</th>
                <th className="py-1 pr-3 font-normal text-right">Companies</th>
                <th className="py-1 pr-3 font-normal text-right">Replied</th>
                <th className="py-1 pr-3 font-normal text-right">Trials</th>
                <th className="py-1 pr-3 font-normal text-right">Customers</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.event.id} className="border-t border-white/5">
                  <td className="py-1 pr-3 text-white/[0.88]">
                    {r.event.name}
                    {r.event.event_date && <span className="text-white/50"> · {fmtDay(r.event.event_date)}</span>}
                  </td>
                  <td className="py-1 pr-3 text-right">{r.people}</td>
                  <td className="py-1 pr-3 text-right">{r.employers}</td>
                  <td className="py-1 pr-3 text-right">{r.replied}</td>
                  <td className="py-1 pr-3 text-right">{r.trials}</td>
                  <td className="py-1 pr-3 text-right">{r.customers}</td>
                  <td className="py-1 text-right">
                    <button onClick={() => remove(r.event)} aria-label={`Remove ${r.event.name}`} className="text-white/40 hover:text-red-300">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-[11px] text-white/60">New event</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HR Live 2026" className={`mt-0.5 h-8 w-56 text-xs ${fieldCls}`} />
        </label>
        <label className="block">
          <span className="text-[11px] text-white/60">Date</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-0.5 h-8 text-xs ${fieldCls}`} />
        </label>
        <Button onClick={add} disabled={busy || !name.trim()} size="sm" variant="outline" className="h-8 border-white/15 text-xs">
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />} Add event
        </Button>
      </div>
    </div>
  );
}

// ─── Per employer: contacts ──────────────────────────────────────────────────

/** What the contact rows need to know about the do-not-contact list. */
export interface BlockContext {
  suppressions: Suppression[];
  employerDomain: string | null;
}

/**
 * Put someone on the do-not-contact list. A buyer saying no usually means the
 * company said no, so for a buyer the whole-company block is offered straight
 * after.
 */
export async function blockContact(c: EmployerContact, call: CallEmployers, onChanged: () => void) {
  if (!window.confirm(`Put ${c.name} on the do-not-contact list?\n\nNobody reaches out to them again, on any channel, in any track (employers and bureaus). Their replies can still be logged.`)) return;
  try {
    await call({ action: 'suppress', scope: 'person', contactId: c.id, reason: 'Said no' });
    toast.success(`${c.name} is on the do-not-contact list`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to block');
    onChanged();
    return;
  }
  const ask = c.role_type === 'buyer'
    ? `${c.name} is the buyer. Block the whole company (every address at their domain) too?`
    : null;
  if (ask && window.confirm(ask)) await blockCompany({ contactId: c.id }, call);
  onChanged();
}

export async function blockCompany(target: { contactId?: string; employerId?: string }, call: CallEmployers) {
  try {
    await call({ action: 'suppress', scope: 'company', ...target, reason: 'Company said no' });
    toast.success('Whole company is on the do-not-contact list');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to block the company');
  }
}

const TASHA_TONE: Record<TashaLink, string> = {
  unchecked: 'text-white/40',
  none: 'text-white/55',
  first: 'text-[#EFBE48]',
  second: 'text-[#7FBCD9]',
};

function ContactRow({
  c, call, onChanged, block, followUps,
}: {
  c: EmployerContact;
  call: CallEmployers;
  onChanged: () => void;
  block?: BlockContext;
  followUps: number;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const blocked = block ? suppressionFor(c, block.employerDomain, block.suppressions) : null;

  const setStage = async (stage: LinkedinStage) => {
    setBusy(true);
    try {
      const res = (await call({ action: 'contact_save', contactId: c.id, linkedinStage: stage })) as { touchLogged?: boolean };
      if (res.touchLogged) toast.success('Invite logged as a LinkedIn touch, follow-up set');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${c.name}? Touches logged with them stay.`)) return;
    try {
      await call({ action: 'contact_delete', contactId: c.id });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    }
  };

  if (editing) {
    return <ContactForm existing={c} employerId={c.employer_id} call={call} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <span className={blocked ? 'text-white/50 line-through' : 'text-white/[0.88]'}>{c.name}</span>
      {blocked && (
        <span
          title={`${blocked.reason ?? 'On the list'}${blocked.domain ? ` (whole company: ${blocked.domain})` : ''}, since ${new Date(blocked.created_at).toLocaleDateString('en-GB')}`}
          className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-red-200"
        >
          <Ban className="h-3 w-3" /> Do not contact
        </span>
      )}
      {c.role_type && <span className={`rounded px-1 py-0.5 ${c.role_type === 'buyer' ? 'bg-[rgba(239,190,72,0.15)] text-[#EFBE48]' : 'bg-white/[0.06] text-white/70'}`}>{ROLE_LABEL[c.role_type]}</span>}
      {c.role && <span className="text-white/55">{c.role}</span>}
      {c.email && <a href={`mailto:${c.email}`} className="text-white/60 hover:text-white/85">{c.email}</a>}
      {c.linkedin_url && (
        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[#7FBCD9] hover:underline">
          <Linkedin className="h-3 w-3" /> profile <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
      <select
        value={c.linkedin_stage}
        disabled={busy}
        onChange={(e) => setStage(e.target.value as LinkedinStage)}
        aria-label={`LinkedIn stage for ${c.name}`}
        className={`h-6 rounded border border-white/[0.14] bg-[#0E2531] px-1 text-[11px] ${STAGE_TONE[c.linkedin_stage]}`}
      >
        {(Object.keys(STAGE_LABEL) as LinkedinStage[]).map((s) => (
          <option key={s} value={s}>{STAGE_LABEL[s]}</option>
        ))}
      </select>
      {c.tasha_link && c.tasha_link !== 'unchecked' && (
        <span className={TASHA_TONE[c.tasha_link]} title="Tasha's relationship with this person">Tasha: {TASHA_LABEL[c.tasha_link]}</span>
      )}
      {c.contact_source && <span className="text-white/40" title="Where this contact came from">via {c.contact_source}</span>}
      {followUps >= MAX_FOLLOW_UPS && (
        <span className="text-[#EFBE48]" title="Two follow-ups is the agreed maximum per person">{followUps} follow-ups</span>
      )}
      <button onClick={() => setEditing(true)} className="text-white/55 hover:text-white/85">Edit</button>
      {!blocked && (
        <button onClick={() => blockContact(c, call, onChanged)} className="text-white/45 hover:text-red-300" title="They said no: never contact again">
          Block
        </button>
      )}
      <button onClick={remove} aria-label={`Remove ${c.name}`} className="text-white/40 hover:text-red-300">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function ContactForm({
  existing, employerId, call, onDone, onCancel,
}: {
  existing?: EmployerContact;
  employerId: string;
  call: CallEmployers;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [role, setRole] = useState(existing?.role ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(existing?.linkedin_url ?? '');
  const [roleType, setRoleType] = useState<RoleType | ''>(existing?.role_type ?? '');
  const [roleTouched, setRoleTouched] = useState(Boolean(existing?.role_type));
  const [source, setSource] = useState(existing?.contact_source ?? '');
  const [tasha, setTasha] = useState<TashaLink>(existing?.tasha_link ?? 'unchecked');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const personal = email.trim() !== '' && email.includes('@') && !isWorkEmail(email);

  // The role type follows the title until it is picked by hand.
  const onTitle = (v: string) => {
    setRole(v);
    if (!roleTouched) setRoleType(suggestRoleType(v) ?? '');
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await call({
        action: 'contact_save', contactId: existing?.id, employerId, name, role, email, linkedinUrl,
        roleType: roleType || null, contactSource: source, tashaLink: tasha,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-2 space-y-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" className={`h-8 text-xs ${fieldCls}`} />
        <Input value={role} onChange={(e) => onTitle(e.target.value)} placeholder="Title (Head of HR)" aria-label="Title" className={`h-8 text-xs ${fieldCls}`} />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" aria-label="Work email" className={`h-8 text-xs ${fieldCls}`} />
        <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/…" aria-label="LinkedIn profile" className={`h-8 text-xs ${fieldCls}`} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-[11px] text-white/60">Role type</span>
          <select
            value={roleType}
            onChange={(e) => { setRoleType(e.target.value as RoleType | ''); setRoleTouched(true); }}
            className={`mt-0.5 block ${selectCls}`}
          >
            <option value="">Unknown</option>
            <option value="buyer">Buyer (HR director / CHRO)</option>
            <option value="champion">Champion (HRBP, L&amp;D, mobility, career)</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-white/60">Contact source</span>
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="LinkedIn, company site, event…" aria-label="Contact source" className={`mt-0.5 h-8 w-48 text-xs ${fieldCls}`} />
        </label>
        <label className="block">
          <span className="text-[11px] text-white/60">Tasha knows them?</span>
          <select value={tasha} onChange={(e) => setTasha(e.target.value as TashaLink)} className={`mt-0.5 block ${selectCls}`}>
            {(Object.keys(TASHA_LABEL) as TashaLink[]).map((t) => <option key={t} value={t}>{TASHA_LABEL[t]}</option>)}
          </select>
        </label>
      </div>
      {personal && <div className="text-[11px] text-[#EFBE48]">That looks like a personal mailbox. Only work addresses can be saved.</div>}
      {err && <div className="text-[11px] text-red-400">{err}</div>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy || !name.trim()} size="sm" className="h-7 bg-atlas-teal hover:bg-atlas-teal/90 text-xs">
          {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} {existing ? 'Save contact' : 'Add contact'}
        </Button>
        <button onClick={onCancel} className="text-[11px] text-white/60 hover:text-white/85">Cancel</button>
      </div>
    </div>
  );
}

export function ContactsBlock({
  employerId, contacts, call, onChanged, block, touches = [],
}: {
  employerId: string;
  contacts: EmployerContact[];
  call: CallEmployers;
  onChanged: () => void;
  block?: BlockContext;
  touches?: EmployerTouch[];
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
      <div className="flex items-center gap-2 text-[11px] text-white/55">
        Contacts
        {!adding && (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-0.5 text-white/70 hover:text-white/90">
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>
      {contacts.length === 0 && !adding && <div className="text-[11px] text-white/45">No contacts yet.</div>}
      {contacts.map((c) => (
        <ContactRow key={c.id} c={c} call={call} onChanged={onChanged} block={block} followUps={followUpCount(touches, c.id)} />
      ))}
      {adding && (
        <ContactForm employerId={employerId} call={call} onDone={() => { setAdding(false); onChanged(); }} onCancel={() => setAdding(false)} />
      )}
    </div>
  );
}

// ─── Per employer: touch log ─────────────────────────────────────────────────

function LogTouchForm({
  employer, contacts, events, call, onDone, onCancel, touches, block,
}: {
  employer: EmployerLite;
  contacts: EmployerContact[];
  events: EmployerEvent[];
  call: CallEmployers;
  onDone: () => void;
  onCancel: () => void;
  touches: EmployerTouch[];
  block?: BlockContext;
}) {
  const today = ymd(new Date());
  const closed = CLOSED_STATUSES.includes(employer.status);
  const [channel, setChannel] = useState<Channel>('linkedin');
  const [kind, setKind] = useState<TouchKind>('first_contact');
  const [contactId, setContactId] = useState(contacts.length === 1 ? contacts[0].id : '');
  const [eventId, setEventId] = useState('');
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  // The suggestion follows channel and type until she edits the date herself.
  const [followUp, setFollowUp] = useState(closed ? '' : suggestFollowUp('first_contact', 'linkedin', today));
  const [followTouched, setFollowTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const outbound = kind === 'first_contact' || kind === 'follow_up';
  const picked = contacts.find((c) => c.id === contactId);
  const blocked = outbound && block
    ? suppressionFor(picked ?? {}, block.employerDomain, block.suppressions)
    : null;
  const priorFollowUps = picked ? followUpCount(touches, picked.id) : 0;

  const resuggest = (k: TouchKind, ch: Channel) => {
    if (!followTouched && !closed) setFollowUp(suggestFollowUp(k, ch, today));
  };

  const save = async () => {
    if (channel === 'event' && !eventId) {
      setErr('Pick the event (add it under Events first if it is not there).');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await call({
        action: 'touch_log',
        employerId: employer.id,
        channel, kind,
        contactId: contactId || null,
        eventId: channel === 'event' ? eventId : null,
        touchedOn: day,
        note,
        followUpOn: followUp || null,
      });
      toast.success(`${KIND_LABEL[kind]} logged for ${employer.name}`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to log');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-2 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-[11px] text-white/60">What</span>
          <select value={kind} onChange={(e) => { const k = e.target.value as TouchKind; setKind(k); resuggest(k, channel); }} className={`mt-0.5 block ${selectCls}`}>
            {(Object.keys(KIND_LABEL) as TouchKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-white/60">Channel</span>
          <select value={channel} onChange={(e) => { const ch = e.target.value as Channel; setChannel(ch); resuggest(kind, ch); }} className={`mt-0.5 block ${selectCls}`}>
            {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </select>
        </label>
        {channel === 'event' && (
          <label className="block">
            <span className="text-[11px] text-white/60">Event</span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={`mt-0.5 block ${selectCls}`}>
              <option value="">Pick an event…</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}{ev.event_date ? ` · ${fmtDay(ev.event_date)}` : ''}</option>
              ))}
            </select>
          </label>
        )}
        {contacts.length > 0 && (
          <label className="block">
            <span className="text-[11px] text-white/60">With</span>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={`mt-0.5 block ${selectCls}`}>
              <option value="">Company in general</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-[11px] text-white/60">On</span>
          <Input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className={`mt-0.5 h-8 text-xs ${fieldCls}`} />
        </label>
        <label className="block">
          <span className="text-[11px] text-white/60">Follow up by</span>
          <Input
            type="date"
            value={followUp}
            onChange={(e) => { setFollowUp(e.target.value); setFollowTouched(true); }}
            className={`mt-0.5 h-8 text-xs ${fieldCls}`}
          />
        </label>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional): what was said, what's next" className={`h-8 text-xs ${fieldCls}`} />
      {blocked && (
        <div className="text-[11px] text-red-300">
          {picked ? picked.name : employer.name} is on the do-not-contact list. Reaching out can't be logged; a reply or meeting can.
        </div>
      )}
      {!blocked && kind === 'follow_up' && priorFollowUps >= MAX_FOLLOW_UPS && (
        <div className="text-[11px] text-[#EFBE48]">
          {picked?.name} already had {priorFollowUps} follow-ups. The agreed maximum is {MAX_FOLLOW_UPS}: this one is your call.
        </div>
      )}
      {err && <div className="text-[11px] text-red-400">{err}</div>}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={busy || Boolean(blocked)} size="sm" className="h-7 bg-atlas-teal hover:bg-atlas-teal/90 text-xs">
          {busy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Log it
        </Button>
        <button onClick={onCancel} className="text-[11px] text-white/60 hover:text-white/85">Cancel</button>
        <span className="ml-auto text-[11px] text-white/45">Empty “follow up by” means no chase planned.</span>
      </div>
    </div>
  );
}

export function TouchLog({
  employer, touches, contacts, events, call, onChanged, account, block,
}: {
  employer: EmployerLite;
  block?: BlockContext;
  /** Signed-in Ops email, so the calendar link opens the right Google account. */
  account?: string | null;
  touches: EmployerTouch[];
  contacts: EmployerContact[];
  events: EmployerEvent[];
  call: CallEmployers;
  onChanged: () => void;
}) {
  const [logging, setLogging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const today = ymd(new Date());
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const eventName = new Map(events.map((e) => [e.id, e.name]));
  const shown = showAll ? touches : touches.slice(0, 3);
  const fu = employer.follow_up_on;
  const closed = CLOSED_STATUSES.includes(employer.status);

  const clearFollowUp = async () => {
    try {
      await call({ action: 'follow_up_set', employerId: employer.id, followUpOn: null });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to clear');
    }
  };

  const remove = async (t: EmployerTouch) => {
    if (!window.confirm('Delete this log entry?')) return;
    try {
      await call({ action: 'touch_delete', touchId: t.id });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
        Outreach
        {fu && !closed && (
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
            fu < today ? 'bg-red-500/15 text-red-200' : fu === today ? 'bg-[rgba(239,190,72,0.15)] text-[#EFBE48]' : 'bg-white/[0.06] text-white/70'
          }`}>
            Follow up {fu < today ? `overdue (${fmtDay(fu)})` : fu === today ? 'today' : `by ${fmtDay(fu)}`}
            <button onClick={clearFollowUp} aria-label="Clear follow-up date" className="opacity-70 hover:opacity-100">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        )}
        {fu && !closed && fu >= today && (
          <a
            href={googleCalendarUrl({
              title: `Follow up: ${employer.name}`,
              day: fu,
              details: followUpDetails(contacts, touches[0]),
              account,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-white/70 hover:bg-white/10 hover:text-white/90"
          >
            <CalendarPlus className="h-3 w-3" /> Add to Google Calendar
          </a>
        )}
        {!logging && (
          <button
            onClick={() => setLogging(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
          >
            <MessageSquarePlus className="h-3 w-3" /> Log touch
          </button>
        )}
      </div>

      {logging && (
        <LogTouchForm
          employer={employer} contacts={contacts} events={events} call={call}
          touches={touches} block={block}
          onDone={() => { setLogging(false); onChanged(); }}
          onCancel={() => setLogging(false)}
        />
      )}

      {touches.length === 0 && !logging && <div className="text-[11px] text-white/45">Nothing logged yet.</div>}
      {shown.map((t) => (
        <div key={t.id} className="group flex flex-wrap items-baseline gap-x-2 text-[11px] text-white/70">
          <span className="w-12 shrink-0 text-white/50">{fmtDay(t.touched_on)}</span>
          <span className={t.kind === 'reply' || t.kind === 'meeting' ? 'text-emerald-300' : 'text-white/[0.88]'}>
            {KIND_LABEL[t.kind]}
          </span>
          <span className="text-white/55">
            via {CHANNEL_LABEL[t.channel]}
            {t.event_id && eventName.get(t.event_id) ? ` (${eventName.get(t.event_id)})` : ''}
            {t.contact_id && contactName.get(t.contact_id) ? ` · ${contactName.get(t.contact_id)}` : ''}
          </span>
          {t.note && <span className="text-white/60">· {t.note}</span>}
          <span className="text-white/35">· {personLabel(t.created_by)}</span>
          <button onClick={() => remove(t)} aria-label="Delete log entry" className="text-white/30 opacity-0 hover:text-red-300 group-hover:opacity-100 focus:opacity-100">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      {touches.length > 3 && (
        <button onClick={() => setShowAll(!showAll)} className="text-[11px] text-white/55 hover:text-white/85">
          {showAll ? 'Show fewer' : `Show all ${touches.length}`}
        </button>
      )}
    </div>
  );
}
