
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { JobListing } from '@/hooks/useJobSearch';

export type SavedJobStatus = 'saved' | 'applied' | 'interviewing' | 'archived';

export interface SavedJob {
  id: string;
  user_id: string;
  job_search_id: string | null;
  external_job_id: string;
  job_title: string;
  company_name: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description_snippet: string | null;
  apply_url: string | null;
  source: string;
  posted_date: string | null;
  saved_at: string;
  // Kanban workflow — added by 20260520104900_add_kanban_to_saved_jobs.sql.
  status: SavedJobStatus;
  applied_at: string | null;
  note: string | null;
  stage: string | null;
  archived_reason: string | null;
  from_career: string | null;
  match_score: number | null;
}

interface SaveJobInput {
  job: JobListing;
  // Originating career title so the kanban card can show provenance
  // ("from 'AI Tools Marketplace Publisher'").
  fromCareer?: string;
}

interface UpdateStatusInput {
  externalJobId: string;
  status: SavedJobStatus;
  // Status-specific metadata captured at the transition.
  note?: string | null;
  stage?: string | null;
  archivedReason?: string | null;
}

export const useSavedJobs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: savedJobs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['saved-jobs', user?.id],
    queryFn: async (): Promise<SavedJob[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('saved_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });

      if (error) {
        console.error('Error fetching saved jobs:', error);
        throw error;
      }

      return (data as SavedJob[]) || [];
    },
    enabled: !!user?.id,
  });

  const saveJobMutation = useMutation({
    mutationFn: async (input: SaveJobInput | JobListing) => {
      if (!user?.id) throw new Error('No user found');

      // Backwards compat: accept either { job, fromCareer } or a bare JobListing.
      const isWrapped = (v: unknown): v is SaveJobInput =>
        typeof v === 'object' && v !== null && 'job' in (v as Record<string, unknown>);
      const job = isWrapped(input) ? input.job : input;
      const fromCareer = isWrapped(input) ? input.fromCareer ?? null : null;

      const { data, error } = await supabase
        .from('saved_jobs')
        .insert({
          user_id: user.id,
          external_job_id: job.id,
          job_title: job.title,
          company_name: job.company || null,
          location: job.location || null,
          salary_min: job.salary_min || null,
          salary_max: job.salary_max || null,
          description_snippet: job.description?.slice(0, 500) || null,
          apply_url: job.apply_url || null,
          source: job.source || 'unknown',
          posted_date: job.posted_date || null,
          // New kanban columns — every save starts in the Saved column.
          status: 'saved' as SavedJobStatus,
          from_career: fromCareer,
          match_score: job.match_score ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user?.id] });
      toast({ title: 'Job saved', description: 'Added to your pipeline.' });
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast({ title: 'Already saved', description: 'This job is already in your pipeline.' });
        return;
      }
      console.error('Error saving job:', error);
      toast({
        title: 'Error',
        description: 'Failed to save job. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const unsaveJobMutation = useMutation({
    mutationFn: async (externalJobId: string) => {
      if (!user?.id) throw new Error('No user found');

      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('user_id', user.id)
        .eq('external_job_id', externalJobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user?.id] });
    },
    onError: (error) => {
      console.error('Error removing saved job:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove saved job.',
        variant: 'destructive',
      });
    },
  });

  // Move a job between kanban columns (and optionally attach a note/stage/reason).
  // Optimistic: updates the cache immediately so the drag feels instant; rolls
  // back the cache if the write fails.
  const updateStatusMutation = useMutation({
    mutationFn: async ({ externalJobId, status, note, stage, archivedReason }: UpdateStatusInput) => {
      if (!user?.id) throw new Error('No user found');

      const patch: Record<string, unknown> = { status };
      if (status === 'applied') patch.applied_at = new Date().toISOString();
      if (note !== undefined) patch.note = note;
      if (stage !== undefined) patch.stage = stage;
      if (archivedReason !== undefined) patch.archived_reason = archivedReason;

      const { error } = await supabase
        .from('saved_jobs')
        .update(patch)
        .eq('user_id', user.id)
        .eq('external_job_id', externalJobId);

      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['saved-jobs', user?.id] });
      const prev = queryClient.getQueryData<SavedJob[]>(['saved-jobs', user?.id]);
      if (prev) {
        queryClient.setQueryData<SavedJob[]>(
          ['saved-jobs', user?.id],
          prev.map((j) =>
            j.external_job_id === input.externalJobId
              ? {
                  ...j,
                  status: input.status,
                  applied_at: input.status === 'applied' ? new Date().toISOString() : j.applied_at,
                  note: input.note !== undefined ? input.note : j.note,
                  stage: input.stage !== undefined ? input.stage : j.stage,
                  archived_reason:
                    input.archivedReason !== undefined ? input.archivedReason : j.archived_reason,
                }
              : j,
          ),
        );
      }
      return { prev };
    },
    onError: (error, _input, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['saved-jobs', user?.id], ctx.prev);
      console.error('Error updating saved-job status:', error);
      toast({
        title: 'Could not move job',
        description: 'Please try again.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user?.id] });
    },
  });

  const isJobSaved = (externalJobId: string): boolean => {
    return savedJobs.some((j) => j.external_job_id === externalJobId);
  };

  return {
    savedJobs,
    isLoading,
    error,
    saveJob: saveJobMutation.mutate,
    isSaving: saveJobMutation.isPending,
    unsaveJob: unsaveJobMutation.mutate,
    isUnsaving: unsaveJobMutation.isPending,
    updateStatus: updateStatusMutation.mutate,
    isUpdatingStatus: updateStatusMutation.isPending,
    isJobSaved,
  };
};
