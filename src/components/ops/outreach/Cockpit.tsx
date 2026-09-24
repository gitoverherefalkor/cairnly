// The outreach cockpit: the top of the Outreach tab, and the answer to "what
// do I need to do, and will tomorrow's slots be filled?"
//
//   strip       today sent / cap · next slot · tomorrow's empty slots · runway
//   banner      red when sending is paused while mail is scheduled
//   Needs you   every concept waiting for Sjoerd, open and editable
//   Going out   everything scheduled, with an estimated time and an auto tag
//   Handled     what the automation decided today, one line
//
// Spec: docs/superpowers/specs/2026-09-24-outreach-control-center-design.md §5

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, Loader2, Sparkles, Wand2, AlertOctagon, MailX } from 'lucide-react';
import { callOutreach } from './api';
import ConceptCard from './ConceptCard';
import { enablePush, pushState, type PushState } from './pushClient';
import type { CockpitSend, ConceptRow, CriticAgreement, HandledToday } from './types';
import { estimateTimes, runwayDays, tomorrowSlots, COLD_CAP_PER_DAY } from '@/lib/outreachCockpit';
import type { OutreachProspect } from '@/lib/outreach';

const card =
  'rounded-[18px] border border-white/[0.08] bg-[rgba(18,46,59,0.55)] backdrop-blur-[14px] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.40)]';
const label = 'font-heading font-bold text-[11px] uppercase tracking-[0.16em] text-white/50';
const pill = 'text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50';

const KIND_ORDER: Record<string, number> = { reply: 0, checkin: 2, chase: 3, initial: 4 };

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function Stat({ title, value, sub, tone = 'plain' }: { title: string; value: string; sub?: string; tone?: 'plain' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-white';
  return (
    <div className="min-w-[8rem]">
      <div className={label}>{title}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/50">{sub}</div>}
    </div>
  );
}

function BounceFix({ p, onDone }: { p: OutreachProspect; onDone: () => void }) {
  const [email, setEmail] = useState(p.to_email ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await callOutreach({ action: 'fix_email', slug: p.slug, to_email: email });
      toast.success('Address saved. The next prepare run picks it up.');
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the address');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.05] p-3 flex flex-wrap items-center gap-2">
      <MailX className="h-4 w-4 text-red-300" />
      <span className="text-sm font-bold text-white">{p.naam ?? p.slug}</span>
      <span className="text-xs text-red-300/90">bounced</span>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 min-w-[12rem] bg-[#0E2531] border border-white/[0.14] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-atlas-teal/60"
        aria-label={`New address for ${p.naam ?? p.slug}`}
      />
      <button onClick={save} disabled={busy} className={`${pill} border-atlas-teal/40 text-atlas-teal hover:bg-atlas-teal/10`}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save address'}
      </button>
    </div>
  );
}

export default function Cockpit({
  concepts,
  send,
  handledToday,
  prospects,
  criticAgreement,
  onReload,
  onTogglePause,
}: {
  concepts: ConceptRow[];
  send: CockpitSend;
  handledToday: HandledToday | null;
  criticAgreement: CriticAgreement | null;
  prospects: OutreachProspect[];
  onReload: () => void;
  onTogglePause: (pause: boolean) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [push, setPush] = useState<PushState>('off');
  const now = useMemo(() => new Date(), [concepts, send]);

  useEffect(() => {
    pushState().then(setPush).catch(() => setPush('unsupported'));
  }, []);

  const paused = send.state?.gepauzeerd ?? true;
  const autoOn = Boolean(send.state?.auto_goedkeuren);

  // ── Split the concepts ──
  const needs = useMemo(
    () =>
      concepts
        .filter((c) => c.status === 'voorstel' || (c.status === 'verouderd' && c.bewerkt_op))
        .sort((a, b) => {
          const ka = a.status === 'verouderd' ? 1 : KIND_ORDER[a.soort] ?? 9;
          const kb = b.status === 'verouderd' ? 1 : KIND_ORDER[b.soort] ?? 9;
          if (ka !== kb) return ka - kb;
          const da = a.basis?.dueAt ?? a.created_at;
          const db = b.basis?.dueAt ?? b.created_at;
          return da.localeCompare(db);
        }),
    [concepts],
  );
  const going = useMemo(() => concepts.filter((c) => c.status === 'ingepland'), [concepts]);
  const sentToday = useMemo(() => concepts.filter((c) => c.status === 'verzonden'), [concepts]);

  const estimates = useMemo(
    () =>
      estimateTimes(
        send.state?.next_allowed_at ?? null,
        going
          .filter((c) => c.queue)
          .map((c) => ({
            id: c.id,
            lane: c.soort === 'reply' ? ('reply' as const) : ('cold' as const),
            niet_voor: c.queue?.niet_voor ?? null,
            direct: Boolean(c.queue?.direct),
          })),
        now,
        send.vandaag_koud ?? send.vandaag_verzonden,
      ),
    [going, send, now],
  );
  const goingSorted = useMemo(
    () => [...going].sort((a, b) => (estimates[a.id] ?? a.created_at).localeCompare(estimates[b.id] ?? b.created_at)),
    [going, estimates],
  );
  const tomorrow = useMemo(
    () => tomorrowSlots(now, estimates, going.filter((c) => c.soort !== 'reply').map((c) => c.id)),
    [now, estimates, going],
  );
  const notContacted = prospects.filter(
    (p) => p.status === 'nog_niet_benaderd' && p.to_email && !p.niet_mailen_op && !p.email_ongeldig_op,
  ).length;
  const runway = runwayDays(notContacted);
  const bounced = prospects.filter((p) => p.email_ongeldig_op);
  const nextSlot = goingSorted.length ? estimates[goingSorted[0].id] : null;
  const coldToday = send.vandaag_koud ?? send.vandaag_verzonden;
  const schedulable = needs.filter((c) => c.status === 'voorstel' && (c.soort === 'initial' || c.soort === 'chase'));

  // ── Actions ──
  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Could not ${name}`);
    } finally {
      setBusy(null);
    }
  };

  const prepare = () =>
    run('prepare', async () => {
      const res = await callOutreach<{ result: { chases: number; checkins: number; initials: number } }>({ action: 'prepare_now' });
      const r = res.result;
      const made = r.chases + r.checkins + r.initials;
      toast.success(made ? `Prepared ${r.initials} first mails, ${r.chases} chases, ${r.checkins} check-ins` : 'Nothing new to prepare right now');
      onReload();
    });

  const scheduleAll = () =>
    run('schedule_all', async () => {
      const res = await callOutreach<{ scheduled: number }>({ action: 'concept_schedule_all', ids: schedulable.map((c) => c.id) });
      toast.success(`${res.scheduled} scheduled into the next free slots`);
      onReload();
    });

  const toggleAuto = () =>
    run('auto', async () => {
      await callOutreach({ action: 'auto_toggle', on: !autoOn });
      toast.success(autoOn ? 'Auto-approve off: everything waits for you' : 'Auto-approve on: boilerplate goes out by itself');
      onReload();
    });

  const togglePush = () =>
    run('push', async () => {
      if (push === 'on') {
        await callOutreach({ action: 'push_test' });
        toast.success('Test notification sent');
        return;
      }
      const next = await enablePush();
      setPush(next);
      if (next === 'on') toast.success('Notifications on for this browser');
      else if (next === 'blocked') toast.error('Chrome blocks notifications for this site. Allow them in the site settings.');
    });

  return (
    <div className={`${card} p-4 space-y-4`}>
      {/* Strip */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <Stat title="Today" value={`${coldToday} / ${COLD_CAP_PER_DAY}`} sub={nextSlot ? `next ~${fmtTime(nextSlot)}` : 'nothing scheduled'} />
        <Stat
          title="Tomorrow"
          value={tomorrow.day ? `${tomorrow.filled} / ${tomorrow.capacity}` : '-'}
          sub={tomorrow.empty ? `${tomorrow.empty} slots empty` : 'full'}
          tone={tomorrow.empty ? 'warn' : 'plain'}
        />
        <Stat
          title="Runway"
          value={`${runway} days`}
          sub={`${notContacted} agencies not contacted`}
          tone={runway < 5 ? (runway === 0 ? 'bad' : 'warn') : 'plain'}
        />
        {criticAgreement && (
          <div title="Every mail the second reader judged, compared with what you did: approved untouched counts as good, edited or discarded as not good. Turn auto-approve on once the streak reaches about 20.">
            <Stat
              title="Second reader"
              value={criticAgreement.judged ? `${criticAgreement.streak} in a row` : 'no data yet'}
              sub={
                criticAgreement.judged
                  ? `agreed with you on ${criticAgreement.agreed} of ${criticAgreement.judged}`
                  : 'judges first mails and replies'
              }
              tone={criticAgreement.judged && criticAgreement.streak >= 20 ? 'plain' : 'warn'}
            />
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={prepare} disabled={busy !== null} className={`${pill} border-white/[0.14] text-white/80 hover:bg-white/[0.06] inline-flex items-center gap-1.5`}>
            {busy === 'prepare' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Prepare more
          </button>
          <button
            onClick={toggleAuto}
            disabled={busy !== null}
            className={`${pill} inline-flex items-center gap-1.5 ${autoOn ? 'border-atlas-teal/50 bg-atlas-teal/15 text-atlas-teal' : 'border-white/[0.14] text-white/70 hover:bg-white/[0.06]'}`}
            title="On: first mails, chases and clear-rejection replies that pass the checks are approved by themselves, with an hour to veto. Off: everything waits for you."
          >
            <Sparkles className="h-3.5 w-3.5" /> Auto-approve {autoOn ? 'on' : 'off'}
          </button>
          <button
            onClick={() => onTogglePause(!paused)}
            className={`${pill} ${paused ? 'border-atlas-teal/40 text-atlas-teal hover:bg-atlas-teal/10' : 'border-amber-500/40 text-amber-300 hover:bg-amber-500/10'}`}
          >
            {paused ? 'Start sending' : 'Stop everything'}
          </button>
          {push !== 'unsupported' && (
            <button onClick={togglePush} disabled={busy !== null} className={`${pill} border-white/[0.14] text-white/70 hover:bg-white/[0.06] inline-flex items-center gap-1.5`}>
              {push === 'blocked' ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {push === 'on' ? 'Send test ping' : push === 'blocked' ? 'Blocked in Chrome' : 'Notifications on'}
            </button>
          )}
        </div>
      </div>

      {paused && (going.length > 0 || schedulable.length > 0) && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200 flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 shrink-0" />
          Sending is paused. {going.length ? `${going.length} scheduled ${going.length === 1 ? 'mail waits' : 'mails wait'} until you press Start sending.` : 'Nothing leaves until you press Start sending.'}
        </div>
      )}
      {send.mislukt > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/[0.07] px-3 py-2 text-xs text-red-200">
          {send.mislukt} {send.mislukt === 1 ? 'mail' : 'mails'} failed to send twice and stopped. Last error: {send.state?.laatste_fout ?? 'unknown'}
        </div>
      )}

      {/* Needs you */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className={label}>Needs you ({needs.length + bounced.length})</h3>
          {!autoOn && schedulable.length > 1 && (
            <button onClick={scheduleAll} disabled={busy !== null} className={`${pill} ml-auto border-atlas-teal/40 text-atlas-teal hover:bg-atlas-teal/10`}>
              {busy === 'schedule_all' ? <Loader2 className="h-3 w-3 animate-spin" /> : `Schedule all ${schedulable.length} chases and first mails`}
            </button>
          )}
        </div>
        {needs.length === 0 && bounced.length === 0 && (
          <p className="text-xs text-white/50">Nothing waits for you. Replies from interested agencies land here with a ping.</p>
        )}
        {bounced.map((p) => (
          <BounceFix key={p.slug} p={p} onDone={onReload} />
        ))}
        {needs.map((c) => (
          <ConceptCard key={c.id} concept={c} mode="needs" onChanged={onReload} />
        ))}
      </section>

      {/* Going out */}
      <section className="space-y-2">
        <h3 className={label}>Going out ({goingSorted.length})</h3>
        {goingSorted.length === 0 ? (
          <p className="text-xs text-white/50">Nothing scheduled.</p>
        ) : (
          goingSorted.map((c) => <ConceptCard key={c.id} concept={c} mode="going" estimate={estimates[c.id]} onChanged={onReload} />)
        )}
      </section>

      {/* Handled for you today */}
      <div className="text-xs text-white/60 flex flex-wrap gap-x-4 gap-y-1">
        <span className={label}>Handled for you today</span>
        <span>{sentToday.length} sent</span>
        {handledToday && (
          <>
            <span>{handledToday.auto_rejections} rejections answered</span>
            <span>{handledToday.opt_outs} opt-outs stopped</span>
            <span>{handledToday.bounces} bounces</span>
            <span>{handledToday.out_of_office} out-of-office</span>
          </>
        )}
      </div>
    </div>
  );
}
