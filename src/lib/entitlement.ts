import { supabase } from '@/integrations/supabase/client';

export interface EntitlementResult {
  entitled: boolean;
  linkedCodes: number;
}

/**
 * Calls the link_and_check_entitlement RPC. This both auto-links any unbound
 * purchases to the current user (by email match) AND tells us whether the
 * user is entitled to use the product.
 *
 * Returns `{ entitled: false, linkedCodes: 0 }` on any error so the caller
 * treats it as "block" — failing open would re-introduce the bug.
 */
export async function checkEntitlement(): Promise<EntitlementResult> {
  try {
    const { data, error } = await supabase.rpc('link_and_check_entitlement');
    if (error) {
      console.error('Entitlement check failed:', error);
      return { entitled: false, linkedCodes: 0 };
    }
    // The RPC returns jsonb: { entitled: boolean, linked_codes: number }
    const payload = (data ?? {}) as { entitled?: boolean; linked_codes?: number };
    return {
      entitled: payload.entitled === true,
      linkedCodes: typeof payload.linked_codes === 'number' ? payload.linked_codes : 0,
    };
  } catch (err) {
    console.error('Entitlement check threw:', err);
    return { entitled: false, linkedCodes: 0 };
  }
}

/**
 * Signs the user out and routes them to the landing page with a banner
 * explaining why. The email is shown in the banner so users with multiple
 * Google/LinkedIn accounts can spot that they signed in with the wrong one.
 */
export async function signOutNoPurchase(email: string | null | undefined): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    // Even if sign-out somehow fails, force-clear the local session marker
    // so the next render shows the unauthenticated UI.
    console.error('Sign-out during entitlement block failed:', err);
  }
  const params = new URLSearchParams({ signed_out: 'no_purchase' });
  if (email) params.set('email', email);
  // Hard navigation so any in-memory auth state is fully reset.
  window.location.href = `/?${params.toString()}`;
}
