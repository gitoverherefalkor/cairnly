// Shared atoms for the v2 /jobs redesign (handoff prototype: jobs-v1.jsx).
// Reuses the dashboard v2 palette + LakeBackground; adds jobs-specific bits:
// match-tone helper, career tier badge, meta chips, monogram company logo,
// match histogram.

import React from 'react';
import { Award, Lightbulb } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';

export type JobsTier = 'top-1' | 'top-2' | 'top-3' | 'runner-up' | 'outside-box';

export const TIER_LABEL: Record<JobsTier, string> = {
  'top-1': 'Top Career #1',
  'top-2': 'Top Career #2',
  'top-3': 'Top Career #3',
  'runner-up': 'Runner-up',
  'outside-box': 'Outside the Box',
};

// Match-score colour bands. 8+ = strong, 5–7 = decent, <5 = adjacent.
export const MATCH_EXCELLENT = '#10B981';
export const MATCH_DECENT = PALETTE.gold;
export const MATCH_ADJACENT = 'rgba(255,255,255,0.30)';

export function matchTone(score: number | null | undefined, surface: 'dark' | 'cream' = 'dark'): string {
  if (score == null) return surface === 'cream' ? PALETTE.inkSoft : 'rgba(255,255,255,0.40)';
  if (score >= 8) return MATCH_EXCELLENT;
  if (score >= 5) return surface === 'cream' ? PALETTE.gold : PALETTE.goldBright;
  return surface === 'cream' ? PALETTE.inkSoft : MATCH_ADJACENT;
}

export function matchLabel(score: number | null | undefined): string {
  if (score == null) return 'Unscored';
  if (score >= 8) return 'Excellent fit';
  if (score >= 5) return 'Decent fit';
  return 'Adjacent';
}

// "2 days ago" / "Today" / "1 week ago" from an ISO posted_date.
export function postedAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

// Gold/teal eyebrow tag used across all four jobs screens.
export const JEyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = PALETTE.goldBright,
}) => (
  <span
    style={{
      fontFamily: FONT_DISPLAY,
      fontWeight: 900,
      fontSize: 11,
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color,
    }}
  >
    {children}
  </span>
);

// Tier badge — gold pill with a number (top-1/2/3) or an icon (runner/outside).
export const CareerTierBadge: React.FC<{
  tier: JobsTier;
  tierLabel?: string;
  selected?: boolean;
}> = ({ tier, tierLabel, selected = false }) => {
  const number = ({ 'top-1': 1, 'top-2': 2, 'top-3': 3 } as Record<string, number>)[tier];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 9999,
          background: selected ? PALETTE.goldBright : 'rgba(212,160,36,0.18)',
          color: selected ? PALETTE.canvasDeep : PALETTE.goldBright,
          border: selected ? 'none' : '1px solid rgba(212,160,36,0.36)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT_DISPLAY,
          fontSize: 11,
          fontWeight: 900,
        }}
      >
        {number ? number : tier === 'runner-up' ? <Award size={12} /> : <Lightbulb size={12} />}
      </span>
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 10,
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        {tierLabel ?? TIER_LABEL[tier]}
      </span>
    </div>
  );
};

// Small grey chip used for seniority / employment / "actively hiring".
// (Currently unused — left in place for forward-compatibility with a richer
// scraped payload, see /jobs handoff README.)
export const MetaChip: React.FC<{ children: React.ReactNode; variant?: 'neutral' | 'gold' }> = ({
  children,
  variant = 'neutral',
}) => {
  const styles =
    variant === 'gold'
      ? {
          background: 'rgba(212,160,36,0.18)',
          color: '#8C6800',
          border: '1px solid rgba(212,160,36,0.45)',
        }
      : {
          background: 'rgba(18,46,59,0.06)',
          color: PALETTE.inkMuted,
          border: '1px solid rgba(201, 182, 144, 0.5)',
        };
  return (
    <span
      style={{
        ...styles,
        padding: '2px 9px',
        borderRadius: 9999,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};

// Company logo — real URL when present (forward-compatible with scraper),
// deterministic letter-monogram fallback otherwise.
export const CompanyLogo: React.FC<{ company: string; src?: string | null; size?: number }> = ({
  company,
  src,
  size = 44,
}) => {
  const initial = (company || '?').charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < (company || '').length; i++) {
    hash = (company.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  }
  const h = ((hash % 360) + 360) % 360;
  const bg = `hsl(${h}, 32%, 26%)`;
  const fg = `hsl(${h}, 40%, 88%)`;

  if (src) {
    return (
      <img
        src={src}
        alt={company}
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          flexShrink: 0,
          objectFit: 'cover',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)',
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        flexShrink: 0,
        background: bg,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_DISPLAY,
        fontWeight: 900,
        fontSize: size * 0.4,
        letterSpacing: '-0.01em',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)',
      }}
    >
      {initial}
    </div>
  );
};

// Stacked bar showing how many roles in a career fall in each match band.
export const MatchHistogram: React.FC<{ jobs: { match_score?: number | null }[] }> = ({ jobs }) => {
  const excellent = jobs.filter((j) => (j.match_score ?? 0) >= 8).length;
  const decent = jobs.filter((j) => (j.match_score ?? 0) >= 5 && (j.match_score ?? 0) < 8).length;
  const adjacent = jobs.filter((j) => (j.match_score ?? 0) < 5).length;
  const total = excellent + decent + adjacent;
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 9999,
          overflow: 'hidden',
          minWidth: 140,
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        {excellent > 0 && <div style={{ width: `${(excellent / total) * 100}%`, background: MATCH_EXCELLENT }} />}
        {decent > 0 && <div style={{ width: `${(decent / total) * 100}%`, background: MATCH_DECENT }} />}
        {adjacent > 0 && <div style={{ width: `${(adjacent / total) * 100}%`, background: MATCH_ADJACENT }} />}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <HistogramKey color={MATCH_EXCELLENT} count={excellent} />
        <HistogramKey color={MATCH_DECENT} count={decent} />
        <HistogramKey color={MATCH_ADJACENT} count={adjacent} />
      </div>
    </div>
  );
};

const HistogramKey: React.FC<{ color: string; count: number }> = ({ color, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span style={{ width: 8, height: 8, borderRadius: 9999, background: color }} />
    <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
      {count}
    </span>
  </div>
);
