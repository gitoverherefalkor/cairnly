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

// Single source of truth for which TOOLS unlock at which referral count.
// Shared by the Dashboard teasers and the Jobs page gate. Tools unlock on
// referrals 1–3; refunds (4–6) live in UNLOCK_LADDER below.
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
    // Cover letters live on the saved-jobs kanban: each saved job card has
    // its own Cover letter affordance (create / view). So route this tile
    // straight to the saved view rather than the search filters page.
    builtYet: true,
    route: '/jobs?mode=saved',
  },
];

// The full 6-step unlock ladder shown on the dashboard toolkit. Each converted
// referral advances one step:
//   1–3  unlock the three tools (a feature)
//   4–6  refund a % of what the user paid (25% / 25% / 50% → 100% cumulative)
// After 6, no further unlocks. This mirrors REFERRAL_PAYOUT_TIERS in the
// payment-success edge function — keep the refund steps in sync.
export type UnlockStep =
  | {
      kind: 'tool';
      featureKey: ReferralFeature['key'];
      requiredReferrals: number;
      title: string;
      description: string;
      builtYet: boolean;
      route?: string;
    }
  | {
      kind: 'refund';
      requiredReferrals: number;
      refundPct: number;
      title: string;
      description: string;
    };

export interface ResolvedUnlockStep {
  step: UnlockStep;
  unlocked: boolean;
}

export const UNLOCK_LADDER: UnlockStep[] = [
  { kind: 'tool', featureKey: 'jobs', requiredReferrals: 1, title: 'Find Job Openings', description: 'Search live job openings matched to your top career recommendations.', builtYet: true, route: '/jobs?mode=search' },
  { kind: 'tool', featureKey: 'resume', requiredReferrals: 2, title: 'Tailor Your Resume', description: 'Rewrite your uploaded resume to fit the specific jobs you want to apply for.', builtYet: true, route: '/custom-resume' },
  { kind: 'tool', featureKey: 'cover-letter', requiredReferrals: 3, title: 'Tailor Cover Letters', description: 'Generate a tailored cover letter for each role, written to the specific posting.', builtYet: true, route: '/jobs?mode=saved' },
  { kind: 'refund', requiredReferrals: 4, refundPct: 25, title: '25% refund', description: 'Get a quarter of what you paid back to your card.' },
  { kind: 'refund', requiredReferrals: 5, refundPct: 25, title: '25% refund', description: 'Another quarter back — now half your purchase recovered.' },
  { kind: 'refund', requiredReferrals: 6, refundPct: 50, title: '50% refund', description: 'The final half back. Your assessment is now completely free.' },
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

  // Tool gating (Jobs page, teaser cards) — unchanged, still keyed off the
  // three tool features.
  const features: ResolvedFeature[] = REFERRAL_FEATURES.map((f) => ({
    ...f,
    unlocked: referralCount >= f.requiredReferrals,
  }));

  // The full 6-step ladder for the dashboard toolkit (3 tools + 3 refunds).
  const ladder: ResolvedUnlockStep[] = UNLOCK_LADDER.map((step) => ({
    step,
    unlocked: referralCount >= step.requiredReferrals,
  }));

  const referralLink = referralCode ? `${PRODUCTION_ORIGIN}/?ref=${referralCode}` : null;

  return {
    referralCode,
    referralLink,
    referralCount,
    features,
    ladder,
    isLoading: codeQuery.isLoading || countQuery.isLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-count', user?.id] });
    },
  };
}
