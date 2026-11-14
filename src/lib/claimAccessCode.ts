import { supabase } from '@/integrations/supabase/client';
import type { PendingAccessCode } from './pendingAccessCode';

/**
 * Binds an access code to the signed-in user (claim-access-code). Used after
 * a Google/LinkedIn return (AuthConfirm) and by the "Already have an access
 * code?" field for a visitor who is already signed in.
 * Returns the user-facing error when the code could not be claimed, null when
 * it was claimed (or was already this user's).
 */
export async function claimPendingCode(pending: PendingAccessCode, accessToken?: string): Promise<string | null> {
  try {
    const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
    const { data, error } = await supabase.functions.invoke('claim-access-code', {
      body: { code: pending.code, lang: pending.lang },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!error && data?.claimed) return null;
    return (data?.error as string | undefined) ?? 'We could not activate your access code.';
  } catch (err) {
    console.error('Claiming the access code failed:', err);
    return 'We could not activate your access code.';
  }
}
