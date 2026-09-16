import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useReferralStatus } from '@/hooks/useReferralStatus';

// Mirrors FREE_SEARCH_LIMIT in supabase/functions/_shared/searchCredits.ts.
// The edge function is the enforcer; this is display only. Keep them in sync.
export const FREE_SEARCH_LIMIT = 4;

export interface JobSearchCredits {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  isLoading: boolean;
}

/**
 * How many of the 4 free job searches this report has spent. Only 'charged'
 * rows count: cache hits (including Recent Searches chips) are free.
 */
export function useJobSearchCredits(reportId?: string): JobSearchCredits {
  const { user } = useAuth();
  const referral = useReferralStatus();
  const unlimited = !!referral.features.find((f) => f.key === 'jobs')?.unlocked;

  const { data: used = 0, isLoading } = useQuery({
    queryKey: ['job-search-credits', reportId],
    queryFn: async (): Promise<number> => {
      if (!reportId) return 0;
      const { count, error } = await supabase
        .from('user_job_searches')
        .select('id', { count: 'exact', head: true })
        .eq('report_id', reportId)
        .eq('search_status', 'charged');
      if (error) {
        console.error('job search credit count failed:', error);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!reportId && !!user?.id && !unlimited,
  });

  return {
    used,
    limit: FREE_SEARCH_LIMIT,
    remaining: Math.max(0, FREE_SEARCH_LIMIT - used),
    unlimited,
    isLoading: isLoading || referral.isLoading,
  };
}
