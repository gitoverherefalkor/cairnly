// DismissalsCard — /ops Platform tab: careers users set aside via the
// dashboard "Not for me" control (public.dismissed_careers).
//
// Presentational only — no fetching here. RLS on dismissed_careers scopes
// SELECT to auth.uid() = user_id, so a browser query from this component
// would only ever see the founder's own rows; the real aggregate is computed
// server-side in ops-feed (with the service role) and handed down as a prop.

import React from 'react';

// ─── Types — mirrors the `dismissals` shape ops-feed returns ──────────────────

export interface DismissalsByCareer {
  career_title: string;
  section_type: string;
  n: number;
}

export interface DismissalsByReason {
  reason: string;
  n: number;
}

export interface DismissalsAggregate {
  total: number;
  by_career: DismissalsByCareer[];
  by_reason: DismissalsByReason[];
}

// ─── Surface — copied from src/pages/Ops.tsx's own INNER constant. Not
// shared across files: MarketingTab.tsx keeps its own local copy of the same
// card language too, so this follows the existing convention rather than
// introducing a new shared-styles module. ─────────────────────────────────────

const INNER = 'rounded-xl bg-white/[0.04] border border-white/[0.06]';

// ─── Labels ─────────────────────────────────────────────────────────────────
// Never show a raw enum key. Known reasons get a proper label; anything the
// DB CHECK constraint allows in future that this map hasn't caught up to yet
// still gets de-slugged rather than shown as raw snake_case.

const REASON_LABELS: Record<string, string> = {
  not_interested: 'Not interested',
  wrong_level: 'Wrong level',
  pay_too_low: 'Pay too low',
  already_did: 'Already did this',
  location: 'Location',
  other: 'Something else',
  unstated: 'No reason given',
};

function reasonLabel(reason: string): string {
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  return reason.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

// English literals mirror src/components/dashboard/v2/V4SavedResponses.tsx's
// SECTION_LABELS for the career-facing section types (/ops has no i18n).
const SECTION_TYPE_LABELS: Record<string, string> = {
  top_career_1: 'Primary match',
  top_career_2: 'Second match',
  top_career_3: 'Third match',
  runner_ups: 'Runner-up',
  outside_box: 'Outside-the-box',
  dream_jobs: 'Dream job',
};

function sectionTypeLabel(sectionType: string): string {
  return SECTION_TYPE_LABELS[sectionType] ?? sectionType;
}

// ─── A single "label ⋯ bar ⋯ count" row ────────────────────────────────────

function CountRow({
  label,
  sub,
  n,
  max,
}: {
  label: string;
  sub?: string;
  n: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-white/80 truncate">{label}</span>
          {sub && <span className="text-[11px] text-white/50 shrink-0">· {sub}</span>}
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mt-1">
          <div
            className="h-full bg-atlas-teal/60 rounded-full"
            style={{ width: `${max > 0 ? (n / max) * 100 : 0}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-white/[0.88] font-semibold w-6 text-right shrink-0 tabular-nums">
        {n}
      </span>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function DismissalsCard({ dismissals }: { dismissals: DismissalsAggregate }) {
  if (dismissals.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/50">
        <div className="text-sm">Nobody has set a career aside yet.</div>
      </div>
    );
  }

  const maxCareer = Math.max(1, ...dismissals.by_career.map((c) => c.n));
  const maxReason = Math.max(1, ...dismissals.by_reason.map((r) => r.n));

  return (
    <div className="space-y-4">
      <div className="text-xs text-white/60">
        <span className="text-white/85 font-semibold">{dismissals.total}</span>{' '}
        career{dismissals.total === 1 ? '' : 's'} set aside in total.
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className={`${INNER} px-3.5 py-3`}>
          <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">
            Most set aside
          </div>
          {dismissals.by_career.length === 0 ? (
            <div className="text-xs text-white/50">Nothing yet</div>
          ) : (
            <div className="space-y-2">
              {dismissals.by_career.map((c) => (
                <CountRow
                  key={`${c.section_type}:${c.career_title}`}
                  label={c.career_title}
                  sub={sectionTypeLabel(c.section_type)}
                  n={c.n}
                  max={maxCareer}
                />
              ))}
            </div>
          )}
        </div>

        <div className={`${INNER} px-3.5 py-3`}>
          <div className="text-[11px] uppercase tracking-wider text-white/60 mb-2">Why</div>
          {dismissals.by_reason.length === 0 ? (
            <div className="text-xs text-white/50">Nothing yet</div>
          ) : (
            <div className="space-y-2">
              {dismissals.by_reason.map((r) => (
                <CountRow key={r.reason} label={reasonLabel(r.reason)} n={r.n} max={maxReason} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
