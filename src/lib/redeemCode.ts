/**
 * Helpers for the "Already have an access code?" field (/auth, the checkout
 * pages and /redeem). Pure, so they can be unit tested without Supabase.
 */

/**
 * Trim and uppercase; spaces between the groups become the dashes the codes
 * use, so "hn4r ff3a t783 dumr" and "HN4R - FF3A-T783-DUMR" both match.
 */
export function normaliseAccessCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-');
}

/** Where a visitor goes once their code checks out: the normal code-link signup. */
export function signupPathForCode(code: string, lang: string): string {
  const params = new URLSearchParams({
    flow: 'signup',
    code,
    lang: String(lang ?? 'en').slice(0, 2).toLowerCase() === 'nl' ? 'nl' : 'en',
  });
  return `/auth?${params.toString()}`;
}
