// Pure chart-data builders shared by the live dashboard (DashboardV4) and the
// print/PDF document. Extracted so both consumers derive identical payloads —
// previously these lived as useMemo blocks inside DashboardV4.

import { extractAIImpact, type AIImpactLevel } from '@/components/chat/CareerScoreCard';
import type { ReportSection } from '@/hooks/useReportSections';
import type { RadarAxis } from './V4PersonalityRadarSVG';
import type { CareerPoint } from './V4CareerMapSVG';
import type { CompareCareer } from './V4CompareRadarSVG';
import type { RadarCareer } from '@/components/career/CareerComparisonRadar';
import { stripHtml } from './dashboardV2Shared';

/** Polygon colours by rank. Kept identical across the front-face preview and
 *  the back-face detail radar so a polygon never changes identity. */
export const RADAR_COLORS: Record<1 | 2 | 3, string> = {
  1: '#d97706', // amber
  2: '#6366f1', // indigo
  3: '#0d9488', // teal
};

const TOPS: { type: string; rank: 1 | 2 | 3 }[] = [
  { type: 'top_career_1', rank: 1 },
  { type: 'top_career_2', rank: 2 },
  { type: 'top_career_3', rank: 3 },
];

const PERSONALITY_AXES: { key: string; label: string; short: string }[] = [
  { key: 'strategic_depth', label: 'Strategic Depth', short: 'Strategic\nDepth' },
  { key: 'execution_bias', label: 'Execution', short: 'Execution' },
  { key: 'people_intuition', label: 'People Intuition', short: 'People\nIntuition' },
  { key: 'ambiguity_tolerance', label: 'Ambiguity Tolerance', short: 'Ambiguity\nTolerance' },
  { key: 'recognition_pull', label: 'Recognition Pull', short: 'Recognition\nPull' },
];

/** Personality radar — from the approach section's metadata.personality_scores
 *  (5 axes, 1-10). Returns [] when the section or scores are absent. */
export function buildRadarAxes(sections: ReportSection[]): RadarAxis[] {
  const approach = sections.find(
    (s) => s.section_type === 'approach' || s.section_type === 'personality_team',
  );
  const ps = approach?.metadata?.personality_scores;
  if (!ps) return [];
  return PERSONALITY_AXES.map((m) => {
    const score = ps[m.key];
    if (typeof score !== 'number') return null;
    return { label: m.label, short: m.short, v: score / 10, score };
  }).filter(Boolean) as RadarAxis[];
}

/** AI exposure on the clinical 5-level scale, spread across 0..1. */
function xForImpact(impact: AIImpactLevel | null): number {
  switch (impact) {
    case 'Minimal':
      return 0.12;
    case 'Moderate':
      return 0.35;
    case 'High':
      return 0.58;
    case 'Severe':
      return 0.78;
    case 'Critical':
      return 0.92;
    default:
      return 0.5;
  }
}

/** Career map — top 3 as ranked bubbles, runner-ups as unranked secondaries.
 *  y = 1 - match/100 so the strongest match sits at the top of the chart. */
export function buildCareerMapPoints(sections: ReportSection[]): CareerPoint[] {
  const points: CareerPoint[] = [];

  for (const { type, rank } of TOPS) {
    const s = sections.find((x) => x.section_type === type);
    if (!s) continue;
    const score = s.score != null ? Number(s.score) : NaN;
    if (!Number.isFinite(score)) continue;
    points.push({
      x: xForImpact(extractAIImpact(s.content || '')),
      y: 1 - score / 100,
      label: stripHtml(s.title || `Career ${rank}`),
      rank,
    });
  }

  for (const s of sections.filter((x) => x.section_type === 'runner_ups')) {
    const score = s.score != null ? Number(s.score) : NaN;
    if (!Number.isFinite(score)) continue;
    points.push({
      x: xForImpact(extractAIImpact(s.content || '')),
      y: 1 - score / 100,
      label: stripHtml(s.title || 'Runner-up'),
    });
  }

  return points;
}

/** Tuple form for the compact front-face V4CompareRadarSVG.
 *  Axis order is fixed: autonomy, stability, schedule, pace, social. */
export function buildCompareCareers(sections: ReportSection[]): CompareCareer[] {
  const out: CompareCareer[] = [];
  const norm = (n: number) => Math.max(0, Math.min(1, n / 5));
  for (const { type, rank } of TOPS) {
    const s = sections.find((x) => x.section_type === type);
    const f = s?.metadata?.fit_scores;
    if (!s || !f) continue;
    out.push({
      rank,
      label: stripHtml(s.title || `Career ${rank}`),
      scores: [norm(f.autonomy), norm(f.stability), norm(f.schedule), norm(f.pace), norm(f.social)],
    });
  }
  return out;
}

/** Object form for the larger CareerComparisonRadar detail view. */
export function buildCompareCareersRich(sections: ReportSection[]): RadarCareer[] {
  const out: RadarCareer[] = [];
  for (const { type, rank } of TOPS) {
    const s = sections.find((x) => x.section_type === type);
    const f = s?.metadata?.fit_scores;
    if (!s || !f) continue;
    out.push({
      label: stripHtml(s.title || `Career ${rank}`),
      scores: f,
      color: RADAR_COLORS[rank],
      focal: rank === 1,
    });
  }
  return out;
}
