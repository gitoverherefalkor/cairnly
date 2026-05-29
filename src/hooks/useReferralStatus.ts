import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ReferralFeature {
  key: 'jobs' | 'resume' | 'cover-letter';
  title: string;
  description: string;
  requiredReferrals: number;
  // Marginal cash-back this referral earns the referrer, as a % of what they
  // paid for their own assessment. Tiers are 25 / 25 / 50 → 100% cumulative
  // after 3 referrals. Mirror of the backend REFERRAL_PAYOUT_TIERS in the
  // payment-success edge function — keep the two in sync.
  refundPct: number;
  // false → the feature isn't built yet; the teaser shows "Coming soon".
  builtYet: boolean;
  route?: string;
}

export interface ResolvedFeature extends ReferralFeature {
  unlocked: boolean;
  // Euro value of this tier's refund, in cents — only known once we've loaded
  // the referrer's own purchase price. null → fall back to showing the %.
  refundCents: number | null;
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
    refundPct: 25,
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
    refundPct: 25,
    builtYet: true,
    route: '/custom-resume',
  },
  {
    key: 'cover-letter',
    title: 'Tailor Cover Letters',
    description:
      'Generate a tailored cover letter for each role from your job search — written to the specific posting and organisation.',
    requiredReferrals: 3,
    refundPct: 50,
    // Cover letters live on the saved-jobs kanban: each saved job card has
    // its own Cover letter affordance (create / view). So route this tile
    // straight to the saved view rather than the search filters page.
    builtYet: true,
    route: '/jobs?mode=saved',
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

  // What the user paid for their own assessment, in euros. Drives the real
  // "€X back" figures on the refund tiers. We read it from the access code
  // bound to this user (price_paid is the net amount actually charged, so a
  // user who bought at a discount sees their tiers calculated off the lower
  // base — matching how the backend computes payouts). A user with no bound
  // purchase (e.g. a grandfathered beta tester) returns null → UI falls back
  // to showing the percentage instead of a euro amount.
  const priceQuery = useQuery({
    queryKey: ['referral-self-price', user?.id],
    queryFn: async (): Promise<number | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('access_codes')
        .select('price_paid')
        .eq('user_id', user.id)
        .not('price_paid', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('referral self-price lookup failed:', error);
        return null;
      }
      const paid = data?.price_paid;
      return typeof paid === 'number' && paid > 0 ? paid : null;
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  const referralCount = countQuery.data ?? 0;
  const referralCode = codeQuery.data ?? null;
  // price_paid is in euros (e.g. 39.00); convert to cents for tidy math.
  const netPaidCents =
    typeof priceQuery.data === 'number' ? Math.round(priceQuery.data * 100) : null;

  const features: ResolvedFeature[] = REFERRAL_FEATURES.map((f) => ({
    ...f,
    unlocked: referralCount >= f.requiredReferrals,
    refundCents:
      netPaidCents !== null ? Math.round((netPaidCents * f.refundPct) / 100) : null,
  }));

  // Cumulative cash-back already earned, plus the full potential (100% of what
  // they paid). Powers the "€X of €Y back" banner tracker.
  const earnedRefundCents =
    netPaidCents !== null
      ? features
          .filter((f) => f.unlocked)
          .reduce((sum, f) => sum + (f.refundCents ?? 0), 0)
      : null;

  const referralLink = referralCode ? `${PRODUCTION_ORIGIN}/?ref=${referralCode}` : null;

  return {
    referralCode,
    referralLink,
    referralCount,
    features,
    netPaidCents,
    earnedRefundCents,
    // Total possible refund = 100% of net paid (tiers sum to 100).
    maxRefundCents: netPaidCents,
    isLoading: codeQuery.isLoading || countQuery.isLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-count', user?.id] });
    },
  };
}

/** Format a cents amount as a euro string, e.g. 975 → "€9.75", 3900 → "€39". */
export function formatEuro(cents: number): string {
  const euros = cents / 100;
  return Number.isInteger(euros) ? `€${euros}` : `€${euros.toFixed(2)}`;
}
