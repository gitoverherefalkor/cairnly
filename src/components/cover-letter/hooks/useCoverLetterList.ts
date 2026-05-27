// Lists every cover_letters row for the current user (most recent first).
// Used by the pipeline / kanban so each saved-job card can tell whether a
// letter already exists for that posting (matched on job_external_id) and
// surface a "View letter" affordance instead of "Create letter".

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { CoverLetterRow } from '../types';

export function useCoverLetterList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cover-letters', 'list', user?.id],
    queryFn: async (): Promise<CoverLetterRow[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('cover_letters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CoverLetterRow[];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
