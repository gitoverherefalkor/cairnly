// The Encore home tab of /ops (2026-11-26 overhaul): Encore is the focus, so
// the first thing on the page is how /encore is doing, then the partners that
// help older people back into work.
//
// Two pieces, both reading straight from the database with the admin's own
// session (no edge function involved):
//   - EncoreStats      ops_encore_stats(p_days): visits, landing bounce, the
//                      payment page, Stripe-paid purchases, surveys done.
//   - EncoreShortlist  ops_encore_shortlist (the approved A-tier), joined in
//                      the browser with the outreach list for "replied?" and
//                      "how often contacted".

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import type { OutreachProspect } from '@/lib/outreach';

const GLASS =
  'rounded-[18px] border border-white/[0.08] bg-[rgba(18,46,59,0.55)] backdrop-blur-[14px] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.40)]';
const EYEBROW = 'font-heading font-bold text-[11px] tracking-[0.24em] uppercase text-[#EFBE48]';
const EYEBROW_QUIET = 'font-heading font-bold text-[11px] tracking-[0.24em] uppercase text-white/55';

// ─── Stats ────────────────────────────────────────────────────────────────────

interface CurPrev {
  cur: number | null;
  prev: number | null;
}
interface CurPrevTotal extends CurPrev {
  total: number;
}
export interface EncoreStatsData {
  days: number;
  visits: CurPrev;
  landed: CurPrev;
  bounce_rate: CurPrev;
  to_payment: CurPrev;
  paid: CurPrevTotal;
  claimed: CurPrevTotal;
  survey_done: CurPrevTotal;
}

/** "+12 vs prior 7d", coloured by whether up is good for this number. */
function Trend({ cur, prev, days, lowerIsBetter = false, suffix = '' }: {
  cur: number | null;
  prev: number | null;
  days: number;
  lowerIsBetter?: boolean;
  suffix?: string;
}) {
  if (cur == null || prev == null) return <span className="text-white/50">no earlier data</span>;
  const d = cur - prev;
  if (d === 0) return <span className="text-white/55">same as prior {days}d</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return (
    <span className={good ? 'text-emerald-400' : 'text-amber-300'}>
      {d > 0 ? '+' : ''}
      {d}
      {suffix} vs prior {days}d
    </span>
  );
}

function Tile({ label, value, sub, tone = 'normal' }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'normal' | 'gold';
}) {
  return (
    <div
      className={`${
        tone === 'gold'
          ? 'rounded-[18px] border border-[rgba(239,190,72,0.32)] bg-[rgba(212,160,36,0.09)] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.40)]'
          : GLASS
      } px-5 py-5`}
    >
      <div className={tone === 'gold' ? EYEBROW : EYEBROW_QUIET}>{label}</div>
      <div
        className={`font-heading font-semibold text-[34px] tracking-[-0.02em] mt-2 ${
          tone === 'gold' ? 'text-[#EFBE48]' : 'text-white'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-white/55 mt-1">{sub}</div>}
    </div>
  );
}

export function EncoreStats() {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<EncoreStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Not in the generated types yet (added 2026-11-26), hence the cast.
    const { data: d, error: e } = await (supabase.rpc as any)('ops_encore_stats', { p_days: days });
    if (e) setError(e.message);
    else setData(d as EncoreStatsData);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const v = (n: number | null | undefined) => (loading || n == null ? '—' : n);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className={EYEBROW}>Encore</div>
          <div className="text-[13px] text-white/60 mt-1">
            cairnly.io/encore, last {days} days. Paid counts Stripe payments only.
          </div>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                days === d
                  ? 'border-[#EFBE48]/60 bg-[rgba(212,160,36,0.16)] text-[#EFBE48]'
                  : 'border-white/[0.12] bg-white/[0.05] text-white/70 hover:text-white'
              }`}
            >
              {d} days
            </button>
          ))}
          <button
            onClick={load}
            aria-label="Refresh Encore stats"
            className="rounded-full border border-white/[0.12] bg-white/[0.05] p-1.5 text-white/70 hover:text-white"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>

      {error ? (
        <div className={`${GLASS} px-5 py-4 text-sm text-red-300`}>Could not load Encore stats: {error}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <Tile
            label="Visits"
            value={v(data?.visits.cur)}
            sub={data && !loading ? <Trend cur={data.visits.cur} prev={data.visits.prev} days={days} /> : 'sessions on /encore'}
          />
          <Tile
            label="Bounce"
            value={loading || data?.bounce_rate.cur == null ? '—' : `${data.bounce_rate.cur}%`}
            sub={
              data && !loading ? (
                <>
                  of {data.landed.cur} landing on /encore ·{' '}
                  <Trend cur={data.bounce_rate.cur} prev={data.bounce_rate.prev} days={days} lowerIsBetter suffix=" pt" />
                </>
              ) : (
                'left within 10s'
              )
            }
          />
          <Tile
            label="To payment"
            value={v(data?.to_payment.cur)}
            sub={
              data && !loading && data.visits.cur
                ? `${Math.round((100 * (data.to_payment.cur ?? 0)) / data.visits.cur)}% of visits reached checkout`
                : 'sessions on /encore/payment'
            }
          />
          <Tile
            label="Paid"
            tone="gold"
            value={v(data?.paid.cur)}
            sub={data && !loading ? `${data.paid.total} paid in total (Stripe)` : 'Stripe payments'}
          />
          <Tile
            label="Survey done"
            value={v(data?.survey_done.cur)}
            sub={data && !loading ? `${data.survey_done.total} of ${data.claimed.total} Encore accounts in total` : 'Encore users'}
          />
        </div>
      )}
    </div>
  );
}

// ─── A-tier shortlist ─────────────────────────────────────────────────────────

interface ShortlistRow {
  slug: string;
  naam: string;
  spoor: 'partner' | 'instantie' | 'pr';
  score: number | null;
  bewijs: string | null;
  bewijs_url: string | null;
  haak: string | null;
}

const SPOOR_LABEL: Record<ShortlistRow['spoor'], string> = {
  partner: 'Partner',
  instantie: 'Institution',
  pr: 'Press',
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

/** Contact history for one shortlisted party, from the outreach mail log. */
function contactFacts(p: OutreachProspect | undefined) {
  if (!p) return { contacted: 0, lastOut: null as string | null, replied: false, lastIn: null as string | null };
  const out = p.mails.filter((m) => m.direction === 'out');
  const inbound = p.mails.filter((m) => m.direction === 'in' && m.sentiment !== 'auto');
  return {
    contacted: out.length,
    lastOut: out[0]?.sent_at ?? null,
    replied: inbound.length > 0,
    lastIn: inbound[0]?.sent_at ?? null,
  };
}

export function EncoreShortlist({ prospects, loading: prospectsLoading }: { prospects: OutreachProspect[]; loading: boolean }) {
  const [rows, setRows] = useState<ShortlistRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await (supabase.from as any)('ops_encore_shortlist')
        .select('slug, naam, spoor, score, bewijs, bewijs_url, haak')
        .order('score', { ascending: false, nullsFirst: false });
      if (e) setError(e.message);
      else setRows((data ?? []) as ShortlistRow[]);
    })();
  }, []);

  const bySlug = new Map(prospects.map((p) => [p.slug, p]));

  if (error) {
    return <div className="text-sm text-red-300">Could not load the A-tier list: {error}</div>;
  }
  if (!rows) {
    return <div className="h-20 rounded-xl bg-white/[0.04] animate-pulse" />;
  }
  if (rows.length === 0) {
    return (
      <div className="text-sm text-white/60">
        No A-tier approved yet. Only parties that demonstrably work with older, white-collar candidates go on this list.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-left text-[13px] min-w-[720px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.14em] text-white/50">
            <th className="px-2 py-2 font-semibold">Party</th>
            <th className="px-2 py-2 font-semibold">Why A-tier</th>
            <th className="px-2 py-2 font-semibold text-right">Contacted</th>
            <th className="px-2 py-2 font-semibold">Last mail</th>
            <th className="px-2 py-2 font-semibold">Replied</th>
            <th className="px-2 py-2 font-semibold">Codes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = bySlug.get(r.slug);
            const f = contactFacts(p);
            return (
              <tr key={r.slug} className="border-t border-white/[0.07] align-top">
                <td className="px-2 py-3">
                  <div className="font-semibold text-white/[0.92]">{r.naam}</div>
                  <div className="text-xs text-white/55 mt-0.5">
                    {SPOOR_LABEL[r.spoor]}
                    {r.score != null && <> · score {r.score}</>}
                    {!p && <> · not in outreach yet</>}
                  </div>
                </td>
                <td className="px-2 py-3 text-white/75 max-w-[420px]">
                  {r.haak && <div>{r.haak}</div>}
                  {r.bewijs_url && (
                    <a
                      href={r.bewijs_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#2ABFBF] hover:underline mt-1"
                    >
                      {r.bewijs ?? 'Evidence'} <ExternalLink size={11} />
                    </a>
                  )}
                </td>
                <td className="px-2 py-3 text-right font-heading font-semibold text-white">
                  {prospectsLoading ? '—' : `${f.contacted}×`}
                </td>
                <td className="px-2 py-3 text-white/70">{prospectsLoading ? '—' : fmtDate(f.lastOut)}</td>
                <td className="px-2 py-3">
                  {prospectsLoading ? (
                    '—'
                  ) : f.replied ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      Yes · {fmtDate(f.lastIn)}
                    </span>
                  ) : (
                    <span className="text-white/50">No</span>
                  )}
                </td>
                <td className="px-2 py-3 text-white/70">
                  {p && p.codes_issued > 0 ? `${p.codes_claimed}/${p.codes_issued} used` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
