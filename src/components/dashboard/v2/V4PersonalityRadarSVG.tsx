// V4PersonalityRadarSVG — editorial radar for the "About you" banner.
// Built from the design-handoff README specs (viewBox 400×320, 5 axes,
// 4 rings, radial-gradient teal fill, 0–10 score under each axis label).

import React from 'react';
import { PALETTE } from './dashboardV2Shared';

export interface RadarAxis {
  label: string;
  // Label as rendered. `\n` produces a two-line wrap.
  short: string;
  // 0–1 position along the spoke (0 = center, 1 = outer ring).
  v: number;
  // 0–10 — shown as the small monospace number under the axis label.
  score: number;
}

interface Props {
  axes: RadarAxis[];
  size?: number;
}

const CX = 200;
const CY = 165;
const R = 110;
const LABEL_OFFSET = 28; // distance past the outer ring for axis labels

// Stable gradient id per mount so multiple instances don't collide.
let gradId = 0;

export const V4PersonalityRadarSVG: React.FC<Props> = ({ axes, size }) => {
  const n = axes.length;
  if (n < 3) return null;

  // top spoke at -90°, then evenly spaced clockwise
  const angleFor = (i: number) => -90 + (i * 360) / n;
  const pointAt = (i: number, r: number): [number, number] => {
    const rad = (angleFor(i) * Math.PI) / 180;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  };

  const valuePoints = axes
    .map((ax, i) => pointAt(i, R * Math.max(0, Math.min(1, ax.v))).map((n) => n.toFixed(1)).join(','))
    .join(' ');

  const scales = [0.25, 0.5, 0.75, 1.0];

  const id = `v4radar-fill-${++gradId}`;

  return (
    <svg
      viewBox="0 0 400 320"
      style={{ width: '100%', maxHeight: 300, height: 'auto' }}
      role="img"
      aria-label="Personality radar"
    >
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={PALETTE.teal} stopOpacity="0.42" />
          <stop offset="100%" stopColor={PALETTE.teal} stopOpacity="0.18" />
        </radialGradient>
      </defs>

      {/* Innermost filled ring (cream-light fill) */}
      <circle cx={CX} cy={CY} r={R * scales[0]} fill={PALETTE.creamLight} stroke="none" />

      {/* Concentric rings — increasing stroke opacity outward */}
      {scales.map((s, i) => {
        const isOuter = i === scales.length - 1;
        const opacity = 0.45 + (i / (scales.length - 1)) * 0.25; // 0.45 → 0.70
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
      {axes.map((_, i) => {
        const [x, y] = pointAt(i, R);
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

      {/* Scale markers (0/5/10) intentionally removed — the methodology
          (5 axes × 10 integer buckets) makes per-axis numbers misleading.
          See dashboard handoff discussion. The chart now carries the
          story via shape only. */}

      {/* Value polygon */}
      <polygon
        points={valuePoints}
        fill={`url(#${id})`}
        stroke={PALETTE.teal}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />

      {/* Vertex dots — white halo + teal core */}
      {axes.map((ax, i) => {
        const [x, y] = pointAt(i, R * Math.max(0, Math.min(1, ax.v)));
        return (
          <g key={`vertex-${i}`}>
            <circle cx={x} cy={y} r={5} fill="#fff" />
            <circle cx={x} cy={y} r={2} fill={PALETTE.teal} stroke={PALETTE.teal} strokeWidth={1.8} />
          </g>
        );
      })}

      {/* Axis labels. Per-axis scores intentionally removed — the
          underlying scale (integer 1-10 over 5 axes) ties too often for
          the digits to be meaningful. Shape carries the read. */}
      {axes.map((ax, i) => {
        const [lx, ly] = pointAt(i, R + LABEL_OFFSET);
        const angle = angleFor(i);
        const cos = Math.cos((angle * Math.PI) / 180);
        const anchor: 'start' | 'middle' | 'end' =
          Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
        const lines = ax.short.split('\n');
        return (
          <g key={`label-${i}`}>
            {lines.map((line, li) => (
              <text
                key={li}
                x={lx.toFixed(1)}
                y={(ly + li * 13).toFixed(1)}
                textAnchor={anchor}
                fontFamily="'Inter', sans-serif"
                fontSize={11}
                fontWeight={700}
                fill={PALETTE.canvasDeep}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
};
