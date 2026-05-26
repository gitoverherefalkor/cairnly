import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ReferralFeature {
  key: 'jobs' | 'resume' | 'cover-letter';
  title: string;
  description: string;
  requiredReferrals: number;
  // false → the feature isn't built yet; the teaser shows "Coming soon".
  builtYet: boolean;
  route?: string;
}

export interface ResolvedFeature extends ReferralFeature {
  unlocked: boolean;
}

// Single source of truth for which features unlock at which referral count.
// Shared by the Dashboard teasers and the Jobs page gate. When a future
// feature ships, flip `builtYet` to true and add its `route`.
export const REFERRAL_FEATURES: ReferralFeature[] = [
  {
    key: 'jobs',
    title: 'Find Job Openings',
    description: 'Search live job openings matched to your top career recommendations.',
    requiredReferrals: 1,
    builtYet: true,
    // mode=search ensures clicking the toolkit CTA always lands on the filter
    // page (a fresh start), not on stale results restored from sessionStorage.
    route: '/jobs?mode=search',
  },
  {
    key: 'resume',
    title: 'Tailor Your Resume',
    description: 'Rewrite your uploaded resume to fit the specific jobs you want to apply for.',
    requiredReferrals: 2,
    builtYet: true,
    route: '/custom-resume',
  },
  {
    key: 'cover-letter',
    title: 'Tailor Cover Letters',
    description:
      'Generate a tailored cover letter for each role from your job search — written to the specific posting and organisation.',
    requiredReferrals: 3,
    // Cover letters are generated per posting from the Find Open Roles page —
    // each scraped role on /jobs has its own "Cover letter" action that opens
    // the modal. So this tile routes to /jobs (fresh search), not /custom-resume.
    builtYet: true,
    route: '/jobs?mode=search',
  },
];

const PRODUCTION_ORIGIN = 'https://cairnly.io';

// The referral discount shown in UI copy. The actual discount is defined by
// the Stripe coupon (STRIPE_REFERRAL_COUPON_ID) — keep this number in sync
// with that coupon's percent_off so on-screen copy stays accurate.
export const REFERRAL_DISCOUNT_PERCENT = 25;

/**
 * Exposes the user's personal invite code, their successful-referral count,
 * and which premium features that count has unlocked. The invite code is
 * minted on demand (via the `ensure-referral-code` edge function) the first
 * time this hook runs for a user who doesn't have one yet.
 */
export function useReferralStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // The user's referral code — minted on demand if missing.
  const codeQuery = useQuery({
    queryKey: ['referral-code', user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user?.id) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.referral_code) return profile.referral_code;

      // Not minted yet — ask the edge function to create it.
      const { data, error } = await supabase.functions.invoke('ensure-referral-code');
      if (error) {
        console.error('ensure-referral-code failed:', error);
        return null;
      }
      return data?.referralCode ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // How many successful referrals the user has. The RLS SELECT policy on
  // `referrals` scopes this to rows where the user is the referrer.
  const countQuery = useQuery({
    queryKey: ['referral-count', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_user_id', user.id);
      if (error) {
        console.error('referral count failed:', error);
        return 0;
      }
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  const referralCount = countQuery.data ?? 0;
  const referralCode = codeQuery.data ?? null;

  const features: ResolvedFeature[] = REFERRAL_FEATURES.map((f) => ({
    ...f,
    unlocked: referralCount >= f.requiredReferrals,
  }));

  const referralLink = referralCode ? `${PRODUCTION_ORIGIN}/?ref=${referralCode}` : null;

  return {
    referralCode,
    referralLink,
    referralCount,
    features,
    isLoading: codeQuery.isLoading || countQuery.isLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-count', user?.id] });
    },
  };
}
