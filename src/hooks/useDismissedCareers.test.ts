import { describe, it, expect, vi } from 'vitest';

// useDismissedCareers.ts imports useAuth, which imports src/i18n.ts. i18n's
// custom language detector reads `window.location` from inside an i18next
// init callback that fires on a timer. This suite runs in vitest's default
// Node environment (no jsdom anywhere in this repo), so that callback throws
// "window is not defined" — asynchronously, after this file's assertions
// have already finished, which fails the whole run with an unrelated
// unhandled exception. Mock useAuth out so importing the hook module never
// loads the real i18n side effect; this test only exercises the pure
// indexBySectionId export and has no need for real auth state.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, session: null, isLoading: false }),
}));

import { indexBySectionId, type DismissedCareer } from './useDismissedCareers';

function row(over: Partial<DismissedCareer>): DismissedCareer {
  return {
    id: 'd1',
    user_id: 'u1',
    report_id: 'r1',
    section_id: 's1',
    section_type: 'runner_ups',
    career_title: 'Data Steward',
    reason: null,
    note: null,
    created_at: '2026-09-15T00:00:00Z',
    ...over,
  };
}

describe('indexBySectionId', () => {
  it('returns an empty map for no rows', () => {
    expect(indexBySectionId([]).size).toBe(0);
  });

  it('keys each row by its section_id', () => {
    const map = indexBySectionId([row({ section_id: 'a' }), row({ id: 'd2', section_id: 'b' })]);
    expect(map.size).toBe(2);
    expect(map.get('a')?.section_id).toBe('a');
    expect(map.get('b')?.id).toBe('d2');
  });

  it('keeps the first row when section_id repeats', () => {
    const map = indexBySectionId([
      row({ id: 'first', section_id: 'a' }),
      row({ id: 'second', section_id: 'a' }),
    ]);
    expect(map.get('a')?.id).toBe('first');
  });
});
