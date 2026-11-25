// Derives profile defaults from the user's most-recent submitted survey.
//
// The Profile page has Pronouns and Age Range fields that the user can edit,
// but those exact answers already live in the Section 1 survey payload. This
// hook pulls them so Profile can pre-fill the empty form fields without
// asking the user to re-type what they just answered.
//
// Currently exposes:
//   - pronouns  (mapped to the Profile dropdown value: he/him, she/her, ...)
//   - ageRange  (bucketed from the numeric age into 18-24, 25-34, ...)
//   - country   (checkout country name, when the survey pick pins one down)
//
// Works for every survey flavor: pro, starter, encore v1 and encore v2 each
// have their own age / region question ids.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { REGION_QUESTION_IDS, countryFromSurveyPick } from '@/lib/countryToRegion';

// Section 1 question UUIDs — kept in sync with useAIResumePreFill.ts.
const QID_PRONOUN = '11111111-1111-1111-1111-11111111111b';
// Age question per survey: pro, starter, encore v1, encore v2.
const AGE_QUESTION_IDS = [
  '11111111-1111-1111-1111-111111111113',
  'a1a1a1a1-0001-4000-a000-000000000002',
  'b2b2b2b2-0001-4000-a000-000000000002',
  'c3c3c3c3-0001-4000-a000-000000000002',
];

interface SurveyDerivedProfile {
  pronouns: string | null;
  ageRange: string | null;
  country: string | null;
}

const EMPTY: SurveyDerivedProfile = { pronouns: null, ageRange: null, country: null };

const firstAnswer = (payload: Record<string, unknown>, ids: string[]) =>
  ids.map((id) => payload[id]).find((v) => v !== undefined && v !== null && v !== '');

function normalizePronoun(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase().replace(/\s+/g, '');
  // Match the dropdown values in Profile.tsx exactly.
  if (s.includes('he/him') || s === 'hehim') return 'he/him';
  if (s.includes('she/her') || s === 'sheher') return 'she/her';
  if (s.includes('they/them') || s === 'theythem') return 'they/them';
  if (s.includes('prefer') && s.includes('not')) return 'prefer-not-to-say';
  if (s) return 'other';
  return null;
}

function bucketAge(raw: unknown): string | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < 18) return null;
  if (n <= 24) return '18-24';
  if (n <= 34) return '25-34';
  if (n <= 44) return '35-44';
  if (n <= 54) return '45-54';
  if (n <= 64) return '55-64';
  return '65+';
}

export function useSurveyDerivedProfile(): {
  data: SurveyDerivedProfile;
  isLoading: boolean;
} {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['survey-derived-profile', user?.id],
    queryFn: async (): Promise<SurveyDerivedProfile> => {
      if (!user?.id) return EMPTY;

      // Find access_codes for this user, then the latest submitted answers
      // row. We pull only the two columns we need from the payload via the
      // jsonb -> operator so we don't ship the whole survey across the wire.
      const { data: codes } = await supabase
        .from('access_codes')
        .select('id')
        .eq('user_id', user.id);

      const codeIds = (codes ?? []).map((c) => c.id);
      if (codeIds.length === 0) return EMPTY;

      const { data: answers } = await supabase
        .from('answers')
        .select('payload, submitted_at, status')
        .in('access_code_id', codeIds)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .limit(1);

      const payload = (answers?.[0]?.payload ?? null) as Record<string, unknown> | null;
      if (!payload) return EMPTY;

      return {
        pronouns: normalizePronoun(payload[QID_PRONOUN]),
        ageRange: bucketAge(firstAnswer(payload, AGE_QUESTION_IDS)),
        country: countryFromSurveyPick(firstAnswer(payload, REGION_QUESTION_IDS) as string | undefined),
      };
    },
    enabled: !!user?.id,
    // These rarely change once the survey's submitted; keep them sticky.
    staleTime: 10 * 60 * 1000,
  });

  return {
    data: query.data ?? EMPTY,
    isLoading: query.isLoading,
  };
}
