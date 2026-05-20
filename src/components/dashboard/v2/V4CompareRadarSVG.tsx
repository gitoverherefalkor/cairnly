// V4CompareRadarSVG + V4CompareLegend — the comparison radar used on the
// back face of the hero match flip. Mirrors the production axes / colors
// from AllRolesComparisonRadar (Autonomy / Stability / Schedule / Pace &
// pressure / Social load). Focal polygon filled with vertex dots; non-focal
// careers as dashed strokes only.

import React from 'react';
import { PALETTE } from './dashboardV2Shared';

export interface CompareCareer {
  rank: 1 | 2 | 3;
  label: string;
  // 0–1 per axis, in axis order (Autonomy, Stability, Schedule, Pace, Social).
  scores: [number, number, number, number, number];
}

const RANK_COLOR: Record<1 | 2 | 3, string> = {
  1: '#d97706', // amber
  2: '#6366f1', // indigo
  3: '#0d9488', // teal
};

// Axes match production AllRolesComparisonRadar/CareerComparisonRadar.
const AXES = [
  { label: 'Autonomy', angle: -90 },
  { label: 'Stability', angle: -18 },
  { label: 'Schedule', angle: 54 },
  { label: 'Pace & pressure', angle: 126 },
  { label: 'Social load', angle: 198 },
];

interface RadarProps {
  careers: CompareCareer[];
  focalRank?: 1 | 2 | 3;
  // 'compact' renders the smaller viewBox used inside the hero flip.
  variant?: 'compact' | 'full';
}

export const V4CompareRadarSVG: React.FC<RadarProps> = ({
  careers,
  focalRank = 1,
  variant = 'compact',
}) => {
  const compact = variant === 'compact';
  const VB_W = compact ? 380 : 460;
  const VB_H = compact ? 320 : 360;
  const CX = VB_W / 2;
  const CY = VB_H / 2 - 10;
  const R = compact ? 95 : 118;
  const LABEL_OFFSET = compact ? 22 : 26;

  const pointAt = (axisIdx: number, score: number): [number, number] => {
    const a = AXES[axisIdx];
    const rad = (a.angle * Math.PI) / 180;
    const r = Math.max(0, Math.min(1, score)) * R;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  };

  const polygonPoints = (c: CompareCareer) =>
    AXES.map((_, i) => pointAt(i, c.scores[i]).map((n) => n.toFixed(1)).join(',')).join(' ');

  // Render order: non-focal first, focal last so it sits on top.
  const ordered = [...careers].sort((a, b) => Number(a.rank === focalRank) - Number(b.rank === focalRank));

  const scales = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ width: '100%', maxHeight: compact ? 280 : 340, height: 'auto' }}
      role="img"
      aria-label="Career comparison radar"
    >
      {/* Innermost ring filled cream-light */}
      <circle cx={CX} cy={CY} r={R * scales[0]} fill={PALETTE.creamLight} />

      {/* Concentric rings */}
      {scales.map((s, i) => {
        const isOuter = i === scales.length - 1;
        const opacity = 0.45 + (i / (scales.length - 1)) * 0.25;
        return (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={R * s}
            fill="none"
            stroke={PALETTE.tan}
            strokeWidth={isOuter ? 1.2 : 0.9}
            opacity={opacity}
          />
        );
      })}

      {/* Axis spurs */}
      {AXES.map((_, i) => {
        const [x, y] = pointAt(i, 1);
        return (
          <line
            key={`spur-${i}`}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke={PALETTE.tan}
            strokeWidth={0.6}
            opacity={0.55}
          />
        );
      })}

      {/* Polygons (non-focal first, focal last) */}
      {ordered.map((c) => {
        const isFocal = c.rank === focalRank;
        const color = RANK_COLOR[c.rank];
        return (
          <polygon
            key={c.rank}
            points={polygonPoints(c)}
            fill={isFocal ? color : 'none'}
            fillOpacity={isFocal ? 0.22 : undefined}
            stroke={color}
            strokeWidth={isFocal ? 2.2 : 1.6}
            strokeDasharray={isFocal ? undefined : '4 3'}
            strokeLinejoin="round"
          />
        );
      })}

      {/* Vertex dots — focal only */}
      {ordered
        .filter((c) => c.rank === focalRank)
        .map((c) => {
          const color = RANK_COLOR[c.rank];
          return AXES.map((_, i) => {
            const [x, y] = pointAt(i, c.scores[i]);
            return (
              <g key={`vtx-${c.rank}-${i}`}>
                <circle cx={x} cy={y} r={4.5} fill="#ffffff" />
                <circle cx={x} cy={y} r={2} fill={color} stroke={color} strokeWidth={1.6} />
              </g>
            );
          });
        })}

      {/* Axis labels */}
      {AXES.map((a, i) => {
        const rad = (a.angle * Math.PI) / 180;
        const x = CX + (R + LABEL_OFFSET) * Math.cos(rad);
        const y = CY + (R + LABEL_OFFSET) * Math.sin(rad);
        const cos = Math.cos(rad);
        const anchor: 'start' | 'middle' | 'end' =
          Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
        return (
          <text
            key={a.label}
            x={x.toFixed(1)}
            y={(y + 4).toFixed(1)}
            textAnchor={anchor}
            fontFamily="'Inter', sans-serif"
            fontSize={compact ? 11 : 12}
            fontWeight={700}
            fill={PALETTE.canvasDeep}
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
};

interface LegendProps {
  careers: CompareCareer[];
  focalRank?: 1 | 2 | 3;
}

export const V4CompareLegend: React.FC<LegendProps> = ({ careers, focalRank = 1 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {careers
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((c) => {
        const color = RANK_COLOR[c.rank];
        const isFocal = c.rank === focalRank;
        return (
          <div
            key={c.rank}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: isFocal ? 1 : 0.85,
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 22,
                height: 4,
                background: isFocal ? color : 'transparent',
                borderTop: isFocal ? 'none' : `2px dashed ${color}`,
                borderRadius: 2,
              }}
            />
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color,
              }}
            >
              {c.rank}. {c.label}
            </span>
          </div>
        );
      })}
  </div>
);

export { RANK_COLOR };
