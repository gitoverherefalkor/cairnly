import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/i18n', () => ({ default: {} }));
import { resolveLang } from './ReportPrintDocument';
import type { ReportSection } from '@/hooks/useReportSections';

const sec = (over: Partial<ReportSection>): ReportSection =>
  ({ section_type: 'top_career_1', content: 'x', content_i18n: null, language: 'en', ...over }) as ReportSection;

describe('resolveLang', () => {
  it('counts native Dutch sections (Encore) as translated', () => {
    expect(resolveLang([sec({ language: 'nl' }), sec({ section_type: 'top_career_2', language: 'nl' })], 'nl')).toBe('nl');
  });
  it('mixes native and translated sections', () => {
    expect(
      resolveLang([sec({ language: 'nl' }), sec({ section_type: 'exec_summary', content_i18n: { nl: { content: 'y' } } })], 'nl'),
    ).toBe('nl');
  });
  it('falls back to English when an English section has no translation', () => {
    expect(resolveLang([sec({ language: 'nl' }), sec({ section_type: 'exec_summary' })], 'nl')).toBe('en');
  });
});
