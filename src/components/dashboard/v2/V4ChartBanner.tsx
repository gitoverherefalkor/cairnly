// V4ChartBanner — full-width cream-paper banner that anchors a report group.
// Replaces the cramped two-card "Profile at a glance" row. Two banners per
// dashboard: one for "About you" (PersonalityRadar) and one for "Career
// suggestions" (CareerMap). Matches the homepage pricing-card's cream-radial
// gradient treatment.

import React from 'react';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from './dashboardV2Shared';

interface V4ChartBannerProps {
  eyebrow: string;
  icon?: React.ReactNode;
  title: string;
  blurb: string;
  meta?: string;
  // `value` is optional — banners without a meaningful number (e.g. the
  // personality radar, where integer ties make per-axis digits unhelpful)
  // can render label-only.
  stat?: { value?: string; label: string; color?: string };
  chart: React.ReactNode;
  // Right-column width — the radar is square-ish (1.25fr), the career map
  // wants more room (1.55fr).
  chartWidth?: string;
}

export const V4ChartBanner: React.FC<V4ChartBannerProps> = ({
  eyebrow,
  icon,
  title,
  blurb,
  meta,
  stat,
  chart,
  chartWidth = '1.25fr',
}) => (
  <section
    style={{
      background:
        'radial-gradient(circle at 85% 15%, rgba(39,161,161,0.08), transparent 60%),' +
        'radial-gradient(circle at 12% 90%, rgba(212,160,36,0.06), transparent 55%),' +
        '#ECE4D2',
      border: '1px solid rgba(201, 182, 144, 0.5)',
      borderRadius: 22,
      boxShadow: '0 18px 36px -16px rgba(0,0,0,0.4)',
      padding: '22px 26px',
      display: 'grid',
      gridTemplateColumns: `minmax(0, 1fr) minmax(0, ${chartWidth})`,
      gap: 20,
      alignItems: 'center',
    }}
  >
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: FONT_DISPLAY,
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: PALETTE.tealDeep,
          }}
        >
          {icon}
          {eyebrow}
        </span>
        {meta && (
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              fontWeight: 700,
              color: PALETTE.inkSoft,
              letterSpacing: '0.04em',
            }}
          >
            {meta}
          </span>
        )}
      </div>
      <h3
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 22,
          letterSpacing: '-0.018em',
          color: PALETTE.canvasDeep,
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 13.5,
          fontWeight: 500,
          color: PALETTE.inkMuted,
          lineHeight: 1.55,
          margin: 0,
          maxWidth: 460,
        }}
      >
        {blurb}
      </p>
      {stat && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 12,
            borderTop: `1px dashed ${PALETTE.tan}`,
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          {stat.value && (
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 900,
                fontSize: 30,
                letterSpacing: '-0.02em',
                color: stat.color || PALETTE.teal,
                lineHeight: 1,
              }}
            >
              {stat.value}
            </span>
          )}
          <span
            style={{
              fontFamily: FONT_BODY,
              // Label gets a touch more weight when it stands alone.
              fontSize: stat.value ? 12.5 : 14,
              fontWeight: stat.value ? 600 : 700,
              color: stat.value ? PALETTE.inkMuted : (stat.color || PALETTE.tealDeep),
              lineHeight: 1.45,
            }}
          >
            {stat.label}
          </span>
        </div>
      )}
    </div>
    <div style={{ minWidth: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {chart}
    </div>
  </section>
);
