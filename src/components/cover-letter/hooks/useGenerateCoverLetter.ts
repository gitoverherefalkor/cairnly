// Kicks off cover-letter generation for a specific job posting + (optional)
// source résumé. Async — returns immediately with the new cover_letters row
// id, which the modal subscribes to via useCoverLetter() for completion.

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { JobListing } from '@/hooks/useJobSearch';

interface GenerateArgs {
  reportId: string;
  job: JobListing;
  sourceResumeId?: string | null;
}

interface GenerateResponse {
  cover_letter_id: string;
  status: 'processing';
}

export function useGenerateCoverLetter() {
  return useMutation({
    mutationFn: async (args: GenerateArgs): Promise<GenerateResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-cover-letter', {
        body: {
          report_id: args.reportId,
          source_resume_id: args.sourceResumeId ?? null,
          // Send the full JobListing as the snapshot — the edge function
          // pulls out the columns it needs and forwards the rest to n8n.
          job: {
            id: args.job.id,
            title: args.job.title,
            company: args.job.company,
            location: args.job.location,
            description: args.job.description,
            apply_url: args.job.apply_url,
            source: args.job.source,
          },
        },
      });

      if (error) {
        const message =
          (error as { context?: { responseJson?: { error?: string } } })?.context?.responseJson
            ?.error || error.message || 'Could not start cover letter generation.';
        throw new Error(message);
      }

      if (!data?.cover_letter_id) {
        throw new Error('Generation kickoff returned no cover letter id.');
      }

      return data as GenerateResponse;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not start cover letter generation.');
    },
  });
}
