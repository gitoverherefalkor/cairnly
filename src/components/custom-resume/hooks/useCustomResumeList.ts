// Lists every custom_resume row for the current user (most recent first).
// Powers the index view at /custom-resume and the dashboard's "saved résumés"
// summary on the resume ToolCard. Separate from useCustomResumes which is
// scoped to a known set of IDs (used by the results view).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { CustomResumeRow } from './useCustomResumes';

export function useCustomResumeList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['custom-resumes', 'list', user?.id],
    queryFn: async (): Promise<CustomResumeRow[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('custom_resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
    // The list view doesn't need realtime — a normal stale-while-revalidate is
    // fine. Refetch when the user comes back to the tab so freshly-generated
    // résumés land in the list without a manual refresh.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

// Hard-delete a custom_resumes row. RLS scopes deletes to the row owner so
// this is safe from the client. We invalidate both the list query and any
// `useCustomResumes` queries that might have been pointed at this id.
export function useDeleteCustomResume() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_resumes').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-resumes', 'list', user?.id] });
      // Also nuke any cached single-resume queries; safer than trying to splice
      // the deleted id out of every one.
      queryClient.invalidateQueries({ queryKey: ['custom-resumes'] });
    },
  });
}
