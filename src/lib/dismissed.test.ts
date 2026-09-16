import { describe, it, expect } from 'vitest';
import { filterDismissed, isSetAside, type DismissedRef } from './dismissed';
import type { ReportSection } from '@/hooks/useReportSections';

let seq = 0;
function section(over: Partial<ReportSection>): ReportSection {
  return {
    id: `id-${seq++}`,
    report_id: 'r1',
    section_type: 'runner_ups',
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
    content_i18n: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as ReportSection;
}

const ref = (section_id: string, section_type: string): DismissedRef => ({ section_id, section_type });

describe('filterDismissed', () => {
  it('returns every section when nothing is dismissed', () => {
    const s = [section({ id: 'a' }), section({ id: 'b' })];
    expect(filterDismissed(s, []).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('drops a dismissed runner-up', () => {
    const s = [section({ id: 'a' }), section({ id: 'b' })];
    expect(filterDismissed(s, [ref('a', 'runner_ups')]).map((x) => x.id)).toEqual(['b']);
  });

  it('drops dismissed outside_box and dream_jobs too', () => {
    const s = [
      section({ id: 'a', section_type: 'outside_box' }),
      section({ id: 'b', section_type: 'dream_jobs' }),
      section({ id: 'c', section_type: 'runner_ups' }),
    ];
    const out = filterDismissed(s, [ref('a', 'outside_box'), ref('b', 'dream_jobs')]);
    expect(out.map((x) => x.id)).toEqual(['c']);
  });

  it('KEEPS a dismissed top-3 career, because the prose refers to them by number', () => {
    const s = [
      section({ id: 'a', section_type: 'top_career_1' }),
      section({ id: 'b', section_type: 'top_career_2' }),
    ];
    expect(filterDismissed(s, [ref('a', 'top_career_1')]).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('never drops a non-career section even if somehow referenced', () => {
    const s = [section({ id: 'a', section_type: 'values' })];
    expect(filterDismissed(s, [ref('a', 'values')]).map((x) => x.id)).toEqual(['a']);
  });
});

describe('isSetAside', () => {
  it('is true for a dismissed top-3 career', () => {
    expect(isSetAside(section({ id: 'a', section_type: 'top_career_2' }), [ref('a', 'top_career_2')])).toBe(true);
  });

  it('is false for a career that was not dismissed', () => {
    expect(isSetAside(section({ id: 'a', section_type: 'top_career_2' }), [])).toBe(false);
  });

  it('is false for a dismissed runner-up, which is dropped rather than marked', () => {
    expect(isSetAside(section({ id: 'a', section_type: 'runner_ups' }), [ref('a', 'runner_ups')])).toBe(false);
  });
});
