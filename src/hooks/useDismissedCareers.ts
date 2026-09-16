import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Reasons offered by the chip row. Kept in sync with the CHECK constraint in
// 20260915140000_dismissed_careers.sql — adding one here needs a migration.
export const DISMISS_REASONS = [
  'not_interested',
  'wrong_level',
  'pay_too_low',
  'already_did',
  'location',
  'other',
] as const;

export type DismissReason = (typeof DISMISS_REASONS)[number];

export interface DismissedCareer {
  id: string;
  user_id: string;
  report_id: string;
  section_id: string;
  section_type: string;
  career_title: string;
  reason: DismissReason | null;
  note: string | null;
  created_at: string;
}

/**
 * section_id → row. Exported separately from the hook so it can be unit
 * tested without a React tree or a Supabase client.
 */
export function indexBySectionId(rows: DismissedCareer[]): Map<string, DismissedCareer> {
  const map = new Map<string, DismissedCareer>();
  for (const r of rows) {
    if (!map.has(r.section_id)) map.set(r.section_id, r);
  }
  return map;
}

// Stable reference for the empty case. A `= []` destructuring default would
// allocate a new array on every render while react-query's data is undefined
// (loading, or disabled), which would make the useMemo below recompute every
// render and defeat every consumer that depends on bySectionId.
const EMPTY: DismissedCareer[] = [];

interface DismissInput {
  sectionId: string;
  sectionType: string;
  careerTitle: string;
}

export function useDismissedCareers(reportId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['dismissed-careers', reportId];

  const {
    data: dismissed = EMPTY,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async (): Promise<DismissedCareer[]> => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from('dismissed_careers')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching dismissed careers:', error);
        throw error;
      }
      return (data as DismissedCareer[]) ?? [];
    },
    enabled: !!reportId && !!user?.id,
  });

  // Memoized: consumers (the dashboard's rows useMemo) list this Map in their
  // own dependency arrays. Rebuilding it every render would make those memos
  // re-run every render and defeat the point.
  const bySectionId = useMemo(() => indexBySectionId(dismissed), [dismissed]);

  const dismissMutation = useMutation({
    mutationFn: async (input: DismissInput) => {
      if (!user?.id || !reportId) throw new Error('No user or report');
      const { data, error } = await supabase
        .from('dismissed_careers')
        .insert({
          user_id: user.id,
          report_id: reportId,
          section_id: input.sectionId,
          section_type: input.sectionType,
          career_title: input.careerTitle,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: unknown) => {
      // A double-click/double-tap can fire two inserts before the first
      // round-trip completes; UNIQUE(report_id, section_id) rejects the
      // second with 23505. The dismissal already succeeded (the first insert
      // landed), so treat this as success rather than an error: refresh the
      // query and skip the destructive toast. Unlike useSavedJobs' "Already
      // saved" info toast, we show nothing here — the card is already
      // greyed out from the first insert, so a toast would just be noise.
      if ((error as { code?: string } | null)?.code === '23505') {
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      console.error('Error dismissing career:', error);
      toast({
        title: 'Could not set that aside',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      if (!user?.id || !reportId) throw new Error('No user or report');
      const { error } = await supabase
        .from('dismissed_careers')
        .delete()
        .eq('report_id', reportId)
        .eq('section_id', sectionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: unknown) => {
      console.error('Error restoring career:', error);
      toast({
        title: 'Could not bring that back',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const setReasonMutation = useMutation({
    mutationFn: async ({ sectionId, reason }: { sectionId: string; reason: DismissReason }) => {
      if (!user?.id || !reportId) throw new Error('No user or report');
      const { error } = await supabase
        .from('dismissed_careers')
        .update({ reason })
        .eq('report_id', reportId)
        .eq('section_id', sectionId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    // Deliberately silent on failure: the reason is optional garnish, and a
    // toast here would punish the user for a nicety they did not have to give.
    onError: (error: unknown) => console.error('Error saving dismiss reason:', error),
  });

  return {
    dismissed,
    bySectionId,
    isLoading,
    error,
    isDismissed: (sectionId: string) => bySectionId.has(sectionId),
    dismiss: dismissMutation.mutate,
    isDismissing: dismissMutation.isPending,
    restore: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
    setReason: setReasonMutation.mutate,
  };
}
