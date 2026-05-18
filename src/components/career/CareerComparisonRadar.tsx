import React, { useState } from 'react';
import type { FitScores } from '@/hooks/useReportSections';

export interface RadarCareer {
  label: string;
  scores: FitScores;
  color: string; // hex
  focal: boolean;
}

interface CareerComparisonRadarProps {
  careers: RadarCareer[];
  size?: number; // rendered px width; SVG scales down on narrow screens
}

// The five comparison axes, clockwise from the top. `key` matches FitScores
// fields; `tipLines` is the hover tooltip copy, pre-wrapped to short lines.
const AXES: { key: keyof FitScores; label: string; angle: number; tipLines: string[] }[] = [
  {
    key: 'autonomy',
    label: 'Autonomy',
    angle: -90,
    tipLines: ["How well the role's independence matches", 'your need to make your own decisions.'],
  },
  {
    key: 'stability',
    label: 'Stability',
    angle: -18,
    tipLines: ['How well the income and path stability', 'matches your need for security.'],
  },
  {
    key: 'schedule',
    label: 'Schedule',
    angle: 54,
    tipLines: ['How well the working schedule matches', 'your work-life-balance needs.'],
  },
  {
    key: 'pace',
    label: 'Pace & pressure',
    angle: 126,
    tipLines: ["How well the role's intensity and pressure", 'matches your stress tolerance.'],
  },
  {
    key: 'social',
    label: 'Social load',
    angle: 198,
    tipLines: ['How well the people and interaction', 'demands fit your social energy.'],
  },
];

const CX = 160;
const CY = 150;
const MAX_R = 105; // radius for a score of 5
const LABEL_R = 128;

function pointAt(angleDeg: number, score: number): { x: number; y: number } {
  const clamped = Math.max(1, Math.min(5, score));
  const r = (clamped / 5) * MAX_R;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function polygonPoints(scores: FitScores): string {
  return AXES.map((a) => {
    const p = pointAt(a.angle, scores[a.key]);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');
}

export const CareerComparisonRadar: React.FC<CareerComparisonRadarProps> = ({
  careers,
  size = 320,
}) => {
  // Custom hover tooltip — instant, unlike the browser's native <title> delay.
  const [hovered, setHovered] = useState<keyof FitScores | null>(null);

  if (!careers || careers.length === 0) return null;

  const rings = [1, 2, 3, 4, 5].map((lvl) => (lvl / 5) * MAX_R);
  // Draw non-focal careers first so the focal polygon sits on top.
  const ordered = [...careers].sort((a, b) => Number(a.focal) - Number(b.focal));

  const hoveredAxis = AXES.find((a) => a.key === hovered) ?? null;

  return (
    <svg
      viewBox="-50 0 420 305"
      width={size}
      style={{ maxWidth: '100%', height: 'auto' }}
      role="img"
      aria-label="Career comparison radar"
    >
      {rings.map((r, i) => (
        <circle
          key={i}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke={i === rings.length - 1 ? '#e2e8f0' : '#eef2f6'}
          strokeWidth={1}
        />
      ))}

      {AXES.map((a) => {
        const p = pointAt(a.angle, 5);
        return (
          <line key={a.key} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#cbd5e1" strokeWidth={1} />
        );
      })}

      {ordered.map((c) => (
        <polygon
          key={c.label}
          points={polygonPoints(c.scores)}
          fill={c.focal ? c.color : 'none'}
          fillOpacity={c.focal ? 0.2 : undefined}
          stroke={c.color}
          strokeWidth={c.focal ? 2.5 : 2}
        />
      ))}

      {ordered
        .filter((c) => c.focal)
        .map((c) =>
          AXES.map((a) => {
            const p = pointAt(a.angle, c.scores[a.key]);
            return <circle key={`${c.label}-${a.key}`} cx={p.x} cy={p.y} r={3.5} fill={c.color} />;
          }),
        )}

      {AXES.map((a) => {
        const rad = (a.angle * Math.PI) / 180;
        const x = CX + LABEL_R * Math.cos(rad);
        const y = CY + LABEL_R * Math.sin(rad);
        const cos = Math.cos(rad);
        const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
        // Generous transparent hit area so the label is easy to hover.
        const w = a.label.length * 8 + 8;
        const hx = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x - 4 : x - w + 4;
        return (
          <g
            key={a.key}
            onMouseEnter={() => setHovered(a.key)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'help' }}
          >
            <rect x={hx} y={y - 14} width={w} height={22} fill="transparent" />
            <text
              x={x.toFixed(1)}
              y={(y + 4).toFixed(1)}
              textAnchor={anchor}
              fontSize={13}
              fontWeight={700}
              fill="#1e293b"
            >
              {a.label}
            </text>
          </g>
        );
      })}

      {hoveredAxis &&
        (() => {
          const rad = (hoveredAxis.angle * Math.PI) / 180;
          const lx = CX + LABEL_R * Math.cos(rad);
          const ly = CY + LABEL_R * Math.sin(rad);
          const lineH = 15;
          const pad = 9;
          const maxChars = Math.max(...hoveredAxis.tipLines.map((l) => l.length));
          const bw = maxChars * 6 + pad * 2;
          const bh = hoveredAxis.tipLines.length * lineH + pad * 2 - 3;
          let bx = lx - bw / 2;
          bx = Math.max(-46, Math.min(bx, 366 - bw));
          let by = ly < CY ? ly + 14 : ly - bh - 14;
          by = Math.max(4, Math.min(by, 301 - bh));
          return (
            <g pointerEvents="none">
              <rect x={bx} y={by} width={bw} height={bh} rx={7} fill="#1e293b" />
              <text x={bx + pad} y={by + pad + 9} fontSize={11} fill="#ffffff">
                {hoveredAxis.tipLines.map((line, i) => (
                  <tspan key={i} x={bx + pad} dy={i === 0 ? 0 : lineH}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })()}
    </svg>
  );
};
