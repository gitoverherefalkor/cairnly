import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// A coach response the user saved from the chat, snapshotted and tagged to a
// report section. Written by the `save-chat-response` edge function.
export interface SavedChatResponse {
  id: string;
  report_id: string;
  section_type: string | null;
  label: string | null;
  content: string;
  created_at: string;
}

/**
 * Loads the saved coach responses for a report. The `saved_chat_responses`
 * RLS policy scopes the result to the current user's own rows.
 */
export function useSavedChatResponses(reportId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['saved-chat-responses', reportId];

  const { data: savedResponses = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<SavedChatResponse[]> => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from('saved_chat_responses')
        .select('id, report_id, section_type, label, content, created_at')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('Failed to load saved chat responses:', error);
        return [];
      }
      return (data as SavedChatResponse[]) || [];
    },
    enabled: !!reportId,
  });

  // Remove a saved response. Optimistically drops it from the cached list so
  // the UI updates instantly; on failure we refetch to restore the true state.
  // RLS scopes the delete to the current user's own rows.
  const removeSavedResponse = useCallback(
    async (id: string) => {
      queryClient.setQueryData<SavedChatResponse[]>(queryKey, (prev) =>
        (prev ?? []).filter((r) => r.id !== id),
      );
      const { error } = await supabase
        .from('saved_chat_responses')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('Failed to remove saved chat response:', error);
        queryClient.invalidateQueries({ queryKey });
      }
    },
    // queryKey is derived from reportId; depending on reportId keeps it stable.
    [queryClient, reportId],
  );

  return { savedResponses, isLoading, removeSavedResponse };
}
