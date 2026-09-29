import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// Post-report coach (WF5C). Spec: docs/superpowers/specs/
// 2026-09-15-jobs-cap-chat-continuation-dismiss-design.md, Phase C.
//
// The new tables are not in the generated Supabase types yet, so they go
// through one untyped client (same pattern as useContentFeedback). Regenerate
// src/integrations/supabase/types.ts to drop it.

// Mirrors COACH_MONTHLY_LIMIT in supabase/functions/chat-proxy/index.ts.
// chat-proxy is the enforcer; this is display only. Keep them in sync.
export const COACH_MONTHLY_LIMIT = 40;

export type { CoachEntryPoint } from '@/lib/coachUrl';
export { coachUrl } from '@/lib/coachUrl';

/** The coach thread gets its own chat_messages session, apart from the first chat. */
export const coachSessionId = (reportId: string) => `coach-${reportId}`;

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7) + '-01';
}

export interface CoachAccess {
  /** Kill switch on AND the first chat is finished. */
  available: boolean;
  used: number;
  limit: number;
  remaining: number;
  isLoading: boolean;
}

export function useCoachAccess(reportId?: string): CoachAccess {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['coach-access', reportId, user?.id],
    queryFn: async () => {
      const [flag, engagement, usage] = await Promise.all([
        db.from('app_flags').select('value').eq('key', 'coach_enabled').maybeSingle(),
        db
          .from('user_engagement_tracking')
          .select('chat_completed_at')
          .eq('user_id', user!.id)
          .maybeSingle(),
        db
          .from('coach_usage')
          .select('messages_used')
          .eq('report_id', reportId!)
          .eq('month', currentMonth())
          .maybeSingle(),
      ]);
      const enabled = !!(flag.data as { value?: boolean } | null)?.value;
      const completed = !!(engagement.data as { chat_completed_at?: string | null } | null)?.chat_completed_at;
      const used = (usage.data as { messages_used?: number } | null)?.messages_used ?? 0;
      return { available: enabled && completed, used };
    },
    enabled: !!reportId && !!user?.id,
    staleTime: 30_000,
  });

  const used = data?.used ?? 0;
  return {
    available: !!data?.available,
    used,
    limit: COACH_MONTHLY_LIMIT,
    remaining: Math.max(0, COACH_MONTHLY_LIMIT - used),
    isLoading,
  };
}

export interface CoachNextStep {
  id: string;
  step: string;
  career_title: string | null;
  check_in_at: string;
  status: 'open' | 'done' | 'dropped';
  created_at: string;
}

export function useCoachNextSteps(reportId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['coach-next-steps', reportId];

  const { data: steps = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<CoachNextStep[]> => {
      const { data, error } = await db
        .from('coach_next_steps')
        .select('id, step, career_title, check_in_at, status, created_at')
        .eq('report_id', reportId!)
        .neq('status', 'dropped')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('coach next steps load failed:', error);
        return [];
      }
      return (data ?? []) as unknown as CoachNextStep[];
    },
    enabled: !!reportId && !!user?.id,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CoachNextStep['status'] }) => {
      const { error } = await db
        .from('coach_next_steps')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<CoachNextStep[]>(key);
      queryClient.setQueryData<CoachNextStep[]>(key, (old = []) =>
        status === 'dropped' ? old.filter((s) => s.id !== id) : old.map((s) => (s.id === id ? { ...s, status } : s)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
  });

  return {
    steps,
    openSteps: steps.filter((s) => s.status === 'open'),
    isLoading,
    setStatus: setStatus.mutate,
    refresh: () => queryClient.invalidateQueries({ queryKey: key }),
  };
}
