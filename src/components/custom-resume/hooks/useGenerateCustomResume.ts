// Kicks off custom résumé generation via the edge function. The function is
// async — it returns immediately with the new custom_resumes row IDs, which
// the caller passes to useCustomResumes() to subscribe for completion.

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  CareerSelection,
  GenerateResponse,
  TemplateId,
  UserOverrides,
} from '../types';

interface GenerateArgs {
  reportId: string;
  selectedCareers: CareerSelection[];
  templateId: TemplateId;
  includeCoverLetter: boolean;
  userOverrides?: UserOverrides;
}

export function useGenerateCustomResume() {
  return useMutation({
    mutationFn: async (args: GenerateArgs): Promise<GenerateResponse> => {
      const { data, error } = await supabase.functions.invoke('generate-custom-resume', {
        body: {
          report_id: args.reportId,
          selected_careers: args.selectedCareers,
          template_id: args.templateId,
          include_cover_letter: args.includeCoverLetter,
          user_overrides: args.userOverrides ?? {},
        },
      });

      if (error) {
        const message =
          (error as { context?: { responseJson?: { error?: string } } })?.context?.responseJson
            ?.error || error.message || 'Could not start generation.';
        throw new Error(message);
      }

      if (!data?.custom_resume_ids?.length) {
        throw new Error('Generation kickoff returned no résumé IDs.');
      }

      return data as GenerateResponse;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not start résumé generation.');
    },
  });
}
