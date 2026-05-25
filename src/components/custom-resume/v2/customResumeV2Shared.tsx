// Shared atoms for the v2 Custom Résumé screens. Reuses the dashboard v2
// palette + display fonts; adds resume-specific bits (approach_vis background,
// template tile, status pill).

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';

// Section background — Jendi Coursey on Unsplash, downsized to 1600px wide
// (~350 KB) so it stays crisp on retina laptops without ballooning the page
// weight. The original 5+ MB file lives in the same folder if we ever need
// to re-export at different sizes.
export const APPROACH_VIS_URL = '/dashboard/sections/jendi-coursey-bg.jpg';

const OVERLAY =
  'linear-gradient(180deg, rgba(33,63,79,0.55) 0%, rgba(18,46,59,0.78) 60%, rgba(18,46,59,0.92) 100%)';

// Full-bleed background wrapper for the Custom Résumé pages. The image is
// cropped so the cairn sits at ~92% horizontally; with backgroundSize
// '100% auto' the image fills the viewport width and the cairn lands just
// past where column 3 of the picker ends. backgroundRepeat is none so the
// bottom of taller pages just shows the canvas-deep gradient.
export const ApproachBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: 'relative',
      minHeight: '100vh',
      background: PALETTE.canvasDeep,
      backgroundImage: `${OVERLAY}, url(${APPROACH_VIS_URL})`,
      backgroundSize: '100% auto',
      backgroundPosition: 'center top',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'scroll',
    }}
  >
    {children}
  </div>
);

// Gold eyebrow tag — copied from JobsV2Shared for consistency across the
// tier-1/tier-2/tier-3 unlock screens.
export const REyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = PALETTE.goldBright,
}) => (
  <span
    style={{
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color,
    }}
  >
    {children}
  </span>
);

// Glassy dark card shell used for every selectable thing on the page.
export const glassCardStyle = (selected: boolean, disabled: boolean): React.CSSProperties => ({
  position: 'relative',
  background: selected ? 'rgba(39, 161, 161, 0.20)' : 'rgba(18, 46, 59, 0.55)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: selected
    ? '1.5px solid rgba(39, 161, 161, 0.60)'
    : '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 18,
  textAlign: 'left',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.4 : 1,
  transition: 'all 200ms ease',
});

// Small numbered/badge pill — career tier indicator, used on the picker cards.
export const TierPill: React.FC<{ label: string; selected?: boolean; color?: string }> = ({
  label,
  selected = false,
  color = PALETTE.goldBright,
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 9999,
      background: selected ? color : 'rgba(212,160,36,0.18)',
      color: selected ? PALETTE.canvasDeep : color,
      border: selected ? 'none' : '1px solid rgba(212,160,36,0.36)',
      fontFamily: FONT_DISPLAY,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

// Circular check used in the corner of selectable cards.
export const SelectCheckCircle: React.FC<{ selected: boolean }> = ({ selected }) => (
  <div
    style={{
      width: 24,
      height: 24,
      borderRadius: 9999,
      background: selected ? PALETTE.teal : 'transparent',
      border: selected ? `2px solid ${PALETTE.teal}` : '2px solid rgba(255,255,255,0.20)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    {selected && <CheckCircle2 size={14} color="#fff" />}
  </div>
);

// Status pill for generation status — shown next to career titles in the
// results view.
export const StatusPill: React.FC<{ status: 'processing' | 'completed' | 'failed' }> = ({
  status,
}) => {
  const styles: Record<string, { bg: string; fg: string; border: string; label: string }> = {
    processing: {
      bg: 'rgba(212,160,36,0.18)',
      fg: PALETTE.goldBright,
      border: 'rgba(212,160,36,0.36)',
      label: 'Tailoring…',
    },
    completed: {
      bg: 'rgba(39,161,161,0.20)',
      fg: PALETTE.tealBright,
      border: 'rgba(39,161,161,0.42)',
      label: 'Ready',
    },
    failed: {
      bg: 'rgba(239,68,68,0.18)',
      fg: '#fca5a5',
      border: 'rgba(239,68,68,0.42)',
      label: 'Failed',
    },
  };
  const s = styles[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 9px',
        borderRadius: 9999,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
};

// Section eyebrow + content shell — used by every section on the builder page.
export const PageSection: React.FC<{
  eyebrow: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}> = ({ eyebrow, rightSlot, children }) => (
  <section style={{ marginBottom: 28 }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 12,
      }}
    >
      <REyebrow>{eyebrow}</REyebrow>
      {rightSlot}
    </div>
    {children}
  </section>
);
