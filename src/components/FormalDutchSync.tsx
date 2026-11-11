import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFormalDutch } from '@/hooks/useFormalDutch';
import { supabase } from '@/integrations/supabase/client';
import { isEncoreSurveyType } from '@/components/assessment/constants';

/**
 * App-wide: once someone is signed in, their access code's survey decides
 * whether this browser shows Encore's formal Dutch ("u"). Covers pages users
 * land on directly (chat, report, redirects from the dashboard). Reports don't
 * carry the survey, so we ask get-my-access-code (read-only), once per user
 * per browser session.
 */
const cacheKey = (userId: string) => `cairnly_flavor_checked_${userId}`;

export const FormalDutchSync = () => {
  const { user } = useAuth();
  const [isEncore, setIsEncore] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    try {
      const cached = sessionStorage.getItem(cacheKey(user.id));
      if (cached === 'encore' || cached === 'other') {
        setIsEncore(cached === 'encore');
        return;
      }
    } catch {
      /* storage blocked: just ask */
    }
    supabase.functions
      .invoke('get-my-access-code')
      .then(({ data }) => {
        if (cancelled || !data?.found) return; // no code: leave the browser as it is
        const encore = isEncoreSurveyType(data.accessCode?.survey_type);
        try {
          sessionStorage.setItem(cacheKey(user.id), encore ? 'encore' : 'other');
        } catch {
          /* ignore */
        }
        setIsEncore(encore);
      })
      .catch(() => {
        /* copy choice only; never block the app */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useFormalDutch(isEncore);
  return null;
};
