import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// useAuth's import graph reaches src/i18n.ts, which touches `window` under
// Node; the supabase client isn't needed for the handler under test.
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, session: null, isLoading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { handleCustomResumeRealtimeUpdate } from './useCustomResumes';

describe('handleCustomResumeRealtimeUpdate', () => {
  const queryKey = ['custom-resumes', 'user-1', 'row-1'];
  const fullRow = {
    id: 'row-1',
    status: 'completed',
    resume_json: { contact: { name: 'Test' } },
    strength_review: null,
  };

  it('keeps the full cached row and marks it for refetch instead of writing the partial payload', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKey, [fullRow]);

    // A strength_review-only UPDATE: Realtime leaves out the unchanged,
    // TOASTed resume_json column.
    handleCustomResumeRealtimeUpdate(queryClient, queryKey, ['row-1'], 'row-1');

    const cached = queryClient.getQueryData<typeof fullRow[]>(queryKey);
    expect(cached?.[0].resume_json).toEqual({ contact: { name: 'Test' } });
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });

  it('ignores updates for rows this view is not showing', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKey, [fullRow]);

    handleCustomResumeRealtimeUpdate(queryClient, queryKey, ['row-1'], 'other-row');

    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(false);
  });
});
