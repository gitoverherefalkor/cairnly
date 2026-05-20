// V4CareerMapSVG — quadrant chart for the "Career suggestions" banner.
// AI exposure (x) × match strength (y) — sweet spot top-left.
// Built from the design-handoff README specs (viewBox 520×360).

import React from 'react';
import { PALETTE } from './dashboardV2Shared';

export interface CareerPoint {
  x: number; // 0–1, AI exposure (0 = safe, 1 = at risk)
  y: number; // 0–1, match strength (0 = strongest, 1 = weakest)
  label: string;
  rank?: 1 | 2 | 3;
}

interface Props {
  points: CareerPoint[];
}

const W = 520;
const H = 360;
const PAD_L = 64;
const PAD_R = 24;
const PAD_T = 40;
const PAD_B = 50;
const PLOT_W = W - PAD_L - PAD_R; // 432
const PLOT_H = H - PAD_T - PAD_B; // 270

const RANK_COLOR: Record<1 | 2 | 3, string> = {
  1: '#d97706', // amber
  2: '#6366f1', // indigo
  3: '#0d9488', // teal
};

export const V4CareerMapSVG: React.FC<Props> = ({ points }) => {
  const xPx = (x: number) => PAD_L + Math.max(0, Math.min(1, x)) * PLOT_W;
  const yPx = (y: number) => PAD_T + Math.max(0, Math.min(1, y)) * PLOT_H;

  const cx = PAD_L + PLOT_W / 2;
  const cy = PAD_T + PLOT_H / 2;

  // Render order: secondaries first, then top-3 on top.
  const secondaries = points.filter((p) => !p.rank);
  const tops = points.filter((p) => p.rank).sort((a, b) => (b.rank! - a.rank!));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', maxHeight: 340, height: 'auto' }}
      role="img"
      aria-label="Career map quadrant"
    >
      {/* Plot frame */}
      <rect
        x={PAD_L}
        y={PAD_T}
        width={PLOT_W}
        height={PLOT_H}
        fill={PALETTE.creamLight}
        stroke={PALETTE.tan}
        strokeWidth={0.8}
        rx={6}
      />

      {/* Sweet-spot wash — top-left quadrant */}
      <rect
        x={PAD_L}
        y={PAD_T}
        width={PLOT_W / 2}
        height={PLOT_H / 2}
        fill={PALETTE.teal}
        fillOpacity={0.08}
      />
      <text
        x={PAD_L + 10}
        y={PAD_T + 16}
        fontFamily="'Poppins', sans-serif"
        fontWeight={900}
        fontSize={10}
        letterSpacing="0.18em"
        fill={PALETTE.tealDeep}
        opacity={0.85}
      >
        SWEET SPOT
      </text>

      {/* Quadrant gridlines */}
      <line x1={cx} y1={PAD_T} x2={cx} y2={PAD_T + PLOT_H} stroke={PALETTE.tan} strokeWidth={0.8} strokeDasharray="3 3" opacity={0.7} />
      <line x1={PAD_L} y1={cy} x2={PAD_L + PLOT_W} y2={cy} stroke={PALETTE.tan} strokeWidth={0.8} strokeDasharray="3 3" opacity={0.7} />

      {/* X axis labels */}
      {([
        { x: PAD_L + 8, label: 'SAFE', color: PALETTE.canvasDeep, anchor: 'start' },
        { x: cx, label: 'AUGMENTED', color: PALETTE.canvasDeep, anchor: 'middle' },
        { x: PAD_L + PLOT_W - 8, label: 'AT RISK', color: PALETTE.canvasDeep, anchor: 'end' },
      ] as const).map((t) => (
        <text
          key={t.label}
          x={t.x}
          y={PAD_T + PLOT_H + 18}
          textAnchor={t.anchor}
          fontFamily="'Poppins', sans-serif"
          fontSize={10}
          fontWeight={900}
          letterSpacing="0.18em"
          fill={t.color}
        >
          {t.label}
        </text>
      ))}
      <text
        x={cx}
        y={H - 8}
        textAnchor="middle"
        fontFamily="'Inter', sans-serif"
        fontSize={11}
        fontWeight={600}
        fill={PALETTE.inkMuted}
      >
        ← AI exposure →
      </text>

      {/* Y axis labels */}
      <text
        x={PAD_L - 8}
        y={PAD_T + 4}
        textAnchor="end"
        fontFamily="'Poppins', sans-serif"
        fontSize={10}
        fontWeight={900}
        letterSpacing="0.16em"
        fill={PALETTE.canvasDeep}
      >
        STRONG
      </text>
      <text
        x={PAD_L - 8}
        y={PAD_T + PLOT_H + 4}
        textAnchor="end"
        fontFamily="'Poppins', sans-serif"
        fontSize={10}
        fontWeight={900}
        letterSpacing="0.16em"
        fill={PALETTE.inkMuted}
      >
        WEAKER
      </text>
      <text
        x={18}
        y={cy}
        textAnchor="middle"
        transform={`rotate(-90 18 ${cy})`}
        fontFamily="'Inter', sans-serif"
        fontSize={11}
        fontWeight={600}
        fill={PALETTE.inkMuted}
      >
        ← match strength →
      </text>

      {/* Secondaries first */}
      {secondaries.map((p, i) => {
        const px = xPx(p.x);
        const py = yPx(p.y);
        return (
          <g key={`sec-${i}`}>
            <circle cx={px} cy={py} r={8} fill={PALETTE.tan} stroke={PALETTE.inkMuted} strokeWidth={0.6} opacity={0.65} />
            <text
              x={px + 13}
              y={py + 4}
              fontFamily="'Inter', sans-serif"
              fontSize={11}
              fontWeight={600}
              fill={PALETTE.inkMuted}
            >
              {p.label}
            </text>
          </g>
        );
      })}

      {/* Top-3 on top */}
      {tops.map((p) => {
        const px = xPx(p.x);
        const py = yPx(p.y);
        const color = RANK_COLOR[p.rank!];
        return (
          <g key={`top-${p.rank}`}>
            <circle cx={px} cy={py} r={18} fill={color} opacity={0.15} />
            <circle cx={px} cy={py} r={12} fill={color} stroke="#ffffff" strokeWidth={2.4} />
            <text
              x={px}
              y={py + 4.5}
              textAnchor="middle"
              fontFamily="'Poppins', sans-serif"
              fontSize={13}
              fontWeight={900}
              fill="#ffffff"
            >
              {p.rank}
            </text>
            <text
              x={px + 16}
              y={py + 4.5}
              fontFamily="'Inter', sans-serif"
              fontSize={12.5}
              fontWeight={700}
              fill={PALETTE.canvasDeep}
            >
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
