// Subscribes to a single cover_letters row by id. The modal uses this to
// flip from "Generating…" to the rendered letter the moment n8n writes
// status='completed' on the row.
//
// Mirrors useCustomResumes' Realtime + polling fallback pattern.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { CoverLetterRow } from '../types';

interface UseCoverLetterArgs {
  id: string | null;
  terminalStates?: Array<'completed' | 'failed'>;
}

export function useCoverLetter({
  id,
  terminalStates = ['completed', 'failed'],
}: UseCoverLetterArgs) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['cover-letter', user?.id, id ?? 'none'];

  const [isTerminal, setIsTerminal] = useState(false);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<CoverLetterRow | null> => {
      if (!user?.id || !id) return null;
      const { data, error } = await supabase
        .from('cover_letters')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      // Narrow the generated `letter_json: Json | null` + `status: string`
      // to our stricter CoverLetterRow shape via unknown — the runtime
      // shape is guaranteed by the table's CHECK constraint + the n8n
      // workflow that writes letter_json.
      return (data as unknown as CoverLetterRow) ?? null;
    },
    enabled: !!user?.id && !!id,
    refetchInterval: isTerminal ? false : 3_000,
  });

  useEffect(() => {
    const row = query.data;
    if (!row) {
      setIsTerminal(false);
      return;
    }
    setIsTerminal(terminalStates.includes(row.status as 'completed' | 'failed'));
  }, [query.data, terminalStates]);

  // Realtime subscription — push row updates into the query cache so the UI
  // flips as soon as n8n writes the completed row.
  useEffect(() => {
    if (!user?.id || !id) return;

    const channel = supabase
      .channel(`cover-letter-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cover_letters',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as unknown as CoverLetterRow;
          queryClient.setQueryData<CoverLetterRow | null>(queryKey, updated);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // queryKey is derived from id+userId, no need in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id, queryClient]);

  return query;
}
