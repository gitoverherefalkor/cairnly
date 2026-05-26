
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Five fit axes for the career comparison radar. Each is 1-5, oriented as
// fit-for-this-candidate (5 = excellent fit). Written by WF4 into metadata.
export interface FitScores {
  autonomy: number;
  social: number;
  pace: number;
  stability: number;
  schedule: number;
}

// Pre-written comparison shown on Career 2 and Career 3. headline = the
// one-line main difference; explanation = the paragraph the "Explain this
// comparison" button posts into the chat.
export interface CareerComparison {
  headline: string;
  explanation: string;
}

export interface ReportSection {
  id: string;
  report_id: string;
  section_type: string;
  title: string | null;
  content: string;
  order_number: number | null;
  company_size_type: string | null;
  alternate_titles: string | null;
  feedback_category: number | null;
  feedback: string | null;
  explore: string | null;
  fb_status: boolean | null;
  // Compatibility score 0-100, stored as text in DB. Present on top_career_1/2/3 and runner_ups.
  score: string | null;
  // Structured data attached to a section. Currently used for the
  // approach section's personality_scores (5-dim AI-judged 1-10 ratings
  // that drive the Personality Radar). May be extended with other
  // structured fields per section_type in the future.
  metadata: {
    personality_scores?: Record<string, number>;
    fit_scores?: FitScores;
    comparison?: CareerComparison;
  } | null;
  // AI-summarized shareable quotes for the share-card modal. Generated
  // on-demand by the generate-share-quotes edge function and persisted
  // here. Null until first generation. Only populated on top_career_1/2/3
  // and outside_box sections.
  share_quotes: string[] | null;
  created_at: string;
  updated_at: string;
}

// Map database section_type to UI section IDs
// Include variations to handle different naming conventions in the database
export const SECTION_TYPE_MAP: Record<string, string> = {
  // About You sections
  'exec_summary': 'executive-summary',
  'executive_summary': 'executive-summary',
  'approach': 'personality-team',
  'personality_team': 'personality-team',
  'strengths': 'strengths',
  'development': 'growth',
  'values': 'values',
  // Career sections
  'top_career_1': 'first-career',
  'top_career_2': 'second-career',
  'top_career_3': 'third-career',
  'runner_ups': 'runner-up',
  'outside_box': 'outside-box',
  'dream_jobs': 'dream-jobs',
};

export const useReportSections = (reportId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: sections = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['report-sections', reportId],
    queryFn: async (): Promise<ReportSection[]> => {
      if (!reportId) return [];
      
      const { data, error } = await supabase
        .from('report_sections')
        .select('*')
        .eq('report_id', reportId)
        .order('order_number', { ascending: true });

      if (error) {
        console.error('Error fetching report sections:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!reportId,
  });

  const createSectionMutation = useMutation({
    mutationFn: async (section: {
      report_id: string;
      section_type: string;
      title?: string;
      content: string;
      order_number?: number;
      company_size_type?: string;
      alternate_titles?: string;
      feedback?: string;
      explore?: string;
      fb_status?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('report_sections')
        .insert(section)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-sections', reportId] });
    },
    onError: (error) => {
      console.error('Error creating report section:', error);
      toast({
        title: "Error",
        description: "Failed to create report section. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const { error } = await supabase
        .from('report_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-sections', reportId] });
      toast({
        title: "Section deleted",
        description: "The report section has been removed.",
      });
    },
    onError: (error) => {
      console.error('Error deleting report section:', error);
      toast({
        title: "Error",
        description: "Failed to delete report section. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    sections,
    isLoading,
    error,
    createSection: createSectionMutation.mutate,
    isCreating: createSectionMutation.isPending,
    deleteSection: deleteSectionMutation.mutate,
    isDeleting: deleteSectionMutation.isPending,
  };
};
