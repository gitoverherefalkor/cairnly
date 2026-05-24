// Subscribes to a set of custom_resumes rows. Used by the results view to
// flip cards from "Generating…" to "Ready" as n8n completes each one.
//
// Uses Supabase Realtime for low-latency updates, plus a polling fallback in
// case the Realtime channel is wedged or the user's network blocks websockets.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type CustomResumeRow = Tables<'custom_resumes'>;

interface UseCustomResumesArgs {
  ids: string[];
  // Stop polling/subscribing once every row is in a terminal state.
  terminalStates?: Array<'completed' | 'failed'>;
}

export function useCustomResumes({
  ids,
  terminalStates = ['completed', 'failed'],
}: UseCustomResumesArgs) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['custom-resumes', user?.id, ids.slice().sort().join(',')];

  const [allTerminal, setAllTerminal] = useState(false);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<CustomResumeRow[]> => {
      if (!user?.id || ids.length === 0) return [];
      const { data, error } = await supabase
        .from('custom_resumes')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id && ids.length > 0,
    // Poll every 4s while any row is still in progress. Cheaper than relying
    // only on Realtime, and self-healing if the channel disconnects.
    refetchInterval: allTerminal ? false : 4_000,
  });

  // Compute terminal state from query data and feed it back into the
  // refetchInterval guard above.
  useEffect(() => {
    const rows = query.data;
    if (!rows || rows.length < ids.length) {
      setAllTerminal(false);
      return;
    }
    const done = rows.every((r) => terminalStates.includes(r.status as 'completed' | 'failed'));
    setAllTerminal(done);
  }, [query.data, ids.length, terminalStates]);

  // Realtime subscription — pushes row updates into the React Query cache.
  useEffect(() => {
    if (!user?.id || ids.length === 0) return;

    const channel = supabase
      .channel(`custom-resumes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'custom_resumes',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as CustomResumeRow;
          if (!ids.includes(updated.id)) return;
          queryClient.setQueryData<CustomResumeRow[]>(queryKey, (prev) => {
            if (!prev) return [updated];
            const next = prev.map((r) => (r.id === updated.id ? updated : r));
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // queryKey is derived from ids+userId so we don't need it in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ids.join(','), queryClient]);

  return query;
}
