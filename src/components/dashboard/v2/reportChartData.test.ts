import { describe, it, expect } from 'vitest';
import {
  buildRadarAxes,
  buildCareerMapPoints,
  buildCompareCareers,
  RADAR_COLORS,
} from './reportChartData';
import type { ReportSection } from '@/hooks/useReportSections';

// Minimal ReportSection factory — only the fields the builders read.
let seq = 0;
function section(over: Partial<ReportSection>): ReportSection {
  return {
    id: `id-${seq++}`,
    report_id: 'r1',
    section_type: 'top_career_1',
    title: 'A Career',
    content: '',
    order_number: 1,
    company_size_type: null,
    alternate_titles: null,
    feedback_category: null,
    feedback: null,
    explore: null,
    fb_status: null,
    score: null,
    metadata: null,
    share_quotes: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  } as ReportSection;
}

describe('buildRadarAxes', () => {
  it('returns empty when no approach section exists', () => {
    expect(buildRadarAxes([section({ section_type: 'top_career_1' })])).toEqual([]);
  });

  it('normalises 1-10 scores to 0-1 and keeps the raw score', () => {
    const axes = buildRadarAxes([
      section({
        section_type: 'approach',
        metadata: { personality_scores: { strategic_depth: 8, execution_bias: 5 } },
      }),
    ]);
    expect(axes).toHaveLength(2);
    expect(axes[0]).toMatchObject({ label: 'Strategic Depth', v: 0.8, score: 8 });
    expect(axes[1]).toMatchObject({ label: 'Execution', v: 0.5, score: 5 });
  });

  it('skips axes whose score is missing or non-numeric', () => {
    const axes = buildRadarAxes([
      section({
        section_type: 'approach',
        metadata: { personality_scores: { strategic_depth: 8, execution_bias: 'x' as never } },
      }),
    ]);
    expect(axes).toHaveLength(1);
  });

  it('also accepts personality_team as the source section', () => {
    const axes = buildRadarAxes([
      section({
        section_type: 'personality_team',
        metadata: { personality_scores: { people_intuition: 10 } },
      }),
    ]);
    expect(axes).toHaveLength(1);
    expect(axes[0].v).toBe(1);
  });
});

describe('buildCareerMapPoints', () => {
  it('maps match score to y as 1 - score/100', () => {
    const pts = buildCareerMapPoints([
      section({ section_type: 'top_career_1', score: '80', title: 'Product Lead' }),
    ]);
    expect(pts).toHaveLength(1);
    expect(pts[0].y).toBeCloseTo(0.2);
    expect(pts[0].label).toBe('Product Lead');
    expect(pts[0].rank).toBe(1);
  });

  it('drops sections with a non-numeric score', () => {
    expect(buildCareerMapPoints([section({ score: null })])).toEqual([]);
    expect(buildCareerMapPoints([section({ score: 'abc' })])).toEqual([]);
  });

  it('includes runner_ups as unranked secondary points', () => {
    const pts = buildCareerMapPoints([
      section({ section_type: 'top_career_1', score: '90' }),
      section({ section_type: 'runner_ups', score: '60', title: 'Ops Manager' }),
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[1].rank).toBeUndefined();
    expect(pts[1].label).toBe('Ops Manager');
  });

  it('defaults x to 0.5 when AI impact cannot be read from content', () => {
    const pts = buildCareerMapPoints([section({ score: '50', content: 'no impact marker' })]);
    expect(pts[0].x).toBe(0.5);
  });

  it('strips HTML from titles', () => {
    const pts = buildCareerMapPoints([
      section({ score: '70', title: '<h3><strong>Data Lead</strong></h3>' }),
    ]);
    expect(pts[0].label).toBe('Data Lead');
  });
});

describe('buildCompareCareers', () => {
  const fit = { autonomy: 5, stability: 4, schedule: 3, pace: 2, social: 1 };

  it('normalises the 1-5 fit scores to 0-1 in fixed axis order', () => {
    const out = buildCompareCareers([
      section({ section_type: 'top_career_1', title: 'X', metadata: { fit_scores: fit } }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].scores).toEqual([1, 0.8, 0.6, 0.4, 0.2]);
    expect(out[0].rank).toBe(1);
  });

  it('skips careers with no fit_scores', () => {
    expect(buildCompareCareers([section({ metadata: null })])).toEqual([]);
  });

  it('clamps out-of-range values into 0-1', () => {
    const out = buildCompareCareers([
      section({ metadata: { fit_scores: { ...fit, autonomy: 9, social: -3 } } }),
    ]);
    expect(out[0].scores[0]).toBe(1);
    expect(out[0].scores[4]).toBe(0);
  });

  it('exposes a stable colour per rank', () => {
    expect(RADAR_COLORS[1]).toBe('#d97706');
    expect(RADAR_COLORS[2]).toBe('#6366f1');
    expect(RADAR_COLORS[3]).toBe('#0d9488');
  });
});
