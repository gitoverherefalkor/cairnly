import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Decision } from './types';

// AUTO_ANALYZE: fire analysis as soon as a resume completes (spec decision 2).
// Flip to false to only analyze when the user opens Strengthen.
export const AUTO_ANALYZE = true;

export function useStrengthen(customResumeId: string | null) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef<Set<string>>(new Set()); // guard: one auto-fire per row per mount

  const call = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke('resume-strengthen', { body });
    setBusy(false);
    if (fnError) {
      setError(fnError.message ?? 'Something went wrong.');
      return null;
    }
    return data;
  }, []);

  const analyze = useCallback(async () => {
    if (!customResumeId || requested.current.has(customResumeId)) return null;
    requested.current.add(customResumeId);
    return call({ action: 'analyze', custom_resume_id: customResumeId });
  }, [customResumeId, call]);

  // Identical to analyze but without the one-shot `requested` guard. The guard
  // exists to stop auto-analyze effects from looping; a user-tapped retry
  // (stale/failed banner) must always be allowed through, even if an auto-fire
  // already ran for this row.
  const analyzeForRetry = useCallback(async () => {
    if (!customResumeId) return null;
    return call({ action: 'analyze', custom_resume_id: customResumeId });
  }, [customResumeId, call]);

  const apply = useCallback(
    (decisions: Decision[]) =>
      customResumeId ? call({ action: 'apply', custom_resume_id: customResumeId, decisions }) : null,
    [customResumeId, call],
  );

  return { analyze, analyzeForRetry, apply, busy, error };
}
