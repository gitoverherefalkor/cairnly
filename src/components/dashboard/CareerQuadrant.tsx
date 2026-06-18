import React, { useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
  ReferenceLine,
} from 'recharts';
import type { ReportSection } from '@/hooks/useReportSections';
import { extractAIImpact } from '@/components/chat/CareerScoreCard';

// AI Impact axis: discrete 5-tier clinical scale matching CareerScoreCard.
// X position = tier index (0..4). Recharts ScatterChart requires numeric x,
// so we use a category-style numeric axis with a custom tick formatter.
const AI_IMPACT_LEVELS = ['Minimal', 'Moderate', 'High', 'Severe', 'Critical'] as const;
type AIImpactLevel = typeof AI_IMPACT_LEVELS[number];

const IMPACT_COLOR: Record<AIImpactLevel, string> = {
  Minimal: '#10b981',  // emerald-500
  Moderate: '#0ea5e9', // sky-500
  High: '#f59e0b',     // amber-500
  Severe: '#f97316',   // orange-500
  Critical: '#ef4444', // red-500
};

// Section types that have a meaningful match score.
// dream_jobs intentionally excluded (no score, uses Feasibility instead).
const SCORED_TYPES = new Set([
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
]);

const RANK_LABEL: Record<string, string> = {
  top_career_1: 'Top Career',
  top_career_2: 'Top Career',
  top_career_3: 'Top Career',
  runner_ups: 'Runner-up',
  outside_box: 'Outside-the-box',
};

interface QuadrantPoint {
  title: string;
  score: number;
  aiImpact: AIImpactLevel;
  aiImpactX: number;
  rank: string;
  // Numeric weight used by ZAxis to scale bubble size.
  // Top careers are emphasized so they pop visually.
  weight: number;
}

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
}

function buildPoints(sections: ReportSection[] | undefined): QuadrantPoint[] {
  if (!sections) return [];
  const out: QuadrantPoint[] = [];
  for (const s of sections) {
    if (!SCORED_TYPES.has(s.section_type)) continue;
    const score = s.score != null ? Number(s.score) : NaN;
    if (!Number.isFinite(score)) continue;
    const aiImpact = extractAIImpact(s.content || '');
    if (!aiImpact) continue;
    const x = AI_IMPACT_LEVELS.indexOf(aiImpact);
    if (x < 0) continue;
    out.push({
      title: stripHtml(s.title || 'Untitled'),
      score,
      aiImpact,
      aiImpactX: x,
      rank: RANK_LABEL[s.section_type] || s.section_type,
      weight: s.section_type.startsWith('top_career') ? 220 : 130,
    });
  }
  return out;
}

// Custom tooltip — keeps it readable in the editorial palette.
const QuadrantTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as QuadrantPoint;
  return (
    <div className="rounded-xl border border-atlas-navy/10 bg-white px-3 py-2 shadow-lg text-sm">
      <div className="font-semibold text-atlas-navy">{p.title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{p.rank}</div>
      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="text-atlas-teal font-semibold">Match {p.score}/100</span>
        <span
          className="font-semibold"
          style={{ color: IMPACT_COLOR[p.aiImpact] }}
        >
          {p.aiImpact}
        </span>
      </div>
    </div>
  );
};

// Custom dot — colored by AI Impact tier, sized by ZAxis weight, with an
// outline so points stay visible against the warm-paper card background.
const QuadrantDot: React.FC<any> = (props) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const point = payload as QuadrantPoint;
  const radius = point.rank === 'Top Career' ? 11 : 8;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={IMPACT_COLOR[point.aiImpact]}
        fillOpacity={0.9}
        stroke="#fff"
        strokeWidth={2}
      />
    </g>
  );
};

interface CareerQuadrantProps {
  sections: ReportSection[] | undefined;
  className?: string;
  // 'compact' = sized to fit a hero-row column, smaller chart, condensed
  // legend. 'full' = standalone-section size with the full intro copy.
  variant?: 'full' | 'compact';
  // 'bare' = strip the outer rounded-border wrapper so the chart can sit
  // inside another card (e.g. as a ChapterCard customHeader) without a
  // double border.
  bare?: boolean;
  // 'locked' = user hasn't run an assessment yet. Render the empty grid
  // (axes, reference line, legend) without any scatter points so the
  // user gets a preview of the shape that's coming. Distinct from the
  // sections-empty state which says "Mapping your matches…" (used while
  // sections finish processing post-assessment).
  locked?: boolean;
}

// Single chart that shows every recommended career on a Match × AI Impact
// grid. Top Careers render larger; tooltip surfaces full title + rank.
export const CareerQuadrant: React.FC<CareerQuadrantProps> = ({ sections, className, variant = 'full', bare = false, locked = false }) => {
  const points = useMemo(() => buildPoints(sections), [sections]);
  const isCompact = variant === 'compact';

  // Locked state: skip the "Mapping your matches…" placeholder and fall
  // through to the main render. The Scatter component below is gated on
  // !locked so no points draw; the axes + reference line + legend stay.
  if (!locked && points.length < 2) {
    // Compact slot keeps a placeholder so the hero row stays balanced
    // while sections are still being processed.
    if (isCompact) {
      return (
        <div className={className}>
          <div className={bare ? 'p-5 h-[380px] flex flex-col' : 'rounded-2xl border border-atlas-navy/10 bg-white/60 backdrop-blur-sm p-5 h-full flex flex-col'}>
            <div className="flex items-center gap-2 mb-2 text-atlas-teal">
              <MapIcon className="w-4 h-4" strokeWidth={2.25} />
              <span className="text-xs uppercase tracking-[0.16em] font-semibold">
                Career Map
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400 italic min-h-[180px]">
              Mapping your matches…
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Y-axis floor — every recommended career passes the suitability filter,
  // so 0 wastes space. Start at 50 unless a real point sits below it.
  // Locked state has no points, so fall back to 50 directly.
  const minScore = locked || points.length === 0
    ? 50
    : Math.min(...points.map((p) => p.score));
  const yMin = Math.min(50, Math.floor(minScore / 5) * 5);

  // Wrapper varies on `bare`: when set, drop the rounded-border so the
  // chart can sit inside another card without a double frame.
  // Locked to h-[380px] so this column-header lines up exactly with
  // PersonalityRadar's bare wrapper across the two columns — that puts
  // the divider underneath both cards on the same horizontal line.
  // Avoid h-full because ChapterCard has no fixed height — Recharts
  // would measure 0 and bail.
  const wrapperBase = bare
    ? 'bg-white h-[380px] flex flex-col p-5'
    : `rounded-2xl border border-atlas-navy/10 bg-white shadow-sm h-full flex flex-col ${isCompact ? 'p-4' : 'p-4 sm:p-6'}`;

  return (
    <div className={className}>
      <div className={wrapperBase}>
        <div className="flex items-baseline justify-between mb-1">
          {isCompact ? (
            <div className="flex items-center gap-2 text-atlas-teal">
              <MapIcon className="w-4 h-4" strokeWidth={2.25} />
              <span className="text-xs uppercase tracking-[0.16em] font-semibold">
                Career Map
              </span>
            </div>
          ) : (
            <h3 className="text-base sm:text-lg font-semibold text-atlas-navy font-heading">
              Your Career Map
            </h3>
          )}
          <span className={`text-gray-500 ${isCompact ? 'text-[10px] uppercase tracking-wider font-semibold text-atlas-navy/40' : 'text-xs'}`}>
            {locked ? '7 roles' : `${points.length} roles`}
          </span>
        </div>
        {!isCompact && (
          <p className="text-xs text-gray-500 mb-4">
            {locked
              ? 'Available after your assessment.'
              : 'Every recommendation plotted by how well it fits you and how AI is reshaping it.'}
          </p>
        )}
        {isCompact && (
          <p className="text-[11px] text-gray-500 mb-3">
            {locked
              ? 'Available after your assessment.'
              : 'Match score vs AI impact, every recommended role.'}
          </p>
        )}

        {/* Explicit height only — flex-1 fought the inline height when
            parent didn't constrain, leading to 0-height SVG. */}
        <div className="w-full" style={{ height: isCompact ? 240 : 360 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 16, right: 12, bottom: 32, left: 8 }}>
              <CartesianGrid stroke="#E5E7EB" strokeDasharray="2 4" />
              <XAxis
                type="number"
                dataKey="aiImpactX"
                domain={[-0.5, 4.5]}
                ticks={[0, 1, 2, 3, 4]}
                tickFormatter={(v: number) => AI_IMPACT_LEVELS[v] ?? ''}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                stroke="#E5E7EB"
                label={{
                  value: 'AI Impact',
                  position: 'bottom',
                  offset: 12,
                  style: { fontSize: 11, fill: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 },
                }}
              />
              <YAxis
                type="number"
                dataKey="score"
                domain={[yMin, 100]}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                stroke="#E5E7EB"
                label={{
                  value: 'Match',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 16,
                  style: { fontSize: 11, fill: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 },
                }}
              />
              <ZAxis dataKey="weight" range={[80, 240]} />
              {/* Tooltip only fires on populated charts — nothing to hover
                  on a locked grid. */}
              {!locked && (
                <Tooltip content={<QuadrantTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#27A1A1' }} />
              )}
              {/* Soft horizontal at 85 — the "outstanding match" threshold so
                  users can immediately see which roles cluster above it. */}
              <ReferenceLine
                y={85}
                stroke="#27A1A1"
                strokeOpacity={0.35}
                strokeDasharray="4 4"
                // 'insideTopRight' keeps the label inside the plot area so
                // it can't get clipped by the chart's right margin like
                // position='right' did. Slight offset so it doesn't sit
                // directly on the line.
                label={{
                  value: 'Outstanding',
                  position: 'insideTopRight',
                  offset: 4,
                  style: { fontSize: 10, fill: '#27A1A1', fontWeight: 600 },
                }}
              />
              {/* Scatter is omitted in locked state — the empty grid +
                  axes + reference line + legend show users the shape
                  that's coming without any preview data. */}
              {!locked && <Scatter data={points} shape={<QuadrantDot />} />}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend — kept inline so the chart is self-explanatory without
            needing a separate doc / tooltip hunt. Compact variant uses
            tighter spacing + smaller dots to fit the hero column. */}
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${isCompact ? 'mt-2 text-[10px]' : 'mt-4 text-xs'}`}>
          {AI_IMPACT_LEVELS.map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: IMPACT_COLOR[level] }}
              />
              <span className="text-gray-600">{level}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-auto text-gray-400">
            <span className="inline-block w-3 h-3 rounded-full bg-gray-300 border-2 border-white" />
            <span>Larger = top career</span>
          </div>
        </div>
      </div>
    </div>
  );
};
