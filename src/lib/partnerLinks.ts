/**
 * The two links in the partner candidate flow.
 *
 *   partnerLandingPath  /p/:slug?code=…&lang=…   the link a bureau hands out
 *   partnerSignupPath   /auth?flow=signup&code=…  where the landing page sends
 *                                                 the candidate on "Start"
 *
 * The landing page is white-label light: it shows the bureau's logo and name
 * once, then hands over to the normal Cairnly signup with the code pre-filled.
 * The signup path is the SAME url ops-partners used to hand out directly, so
 * every link minted before the landing page existed keeps working.
 *
 * Kept in one place because ops-partners (Deno) mirrors this shape; if the
 * query keys ever change, change them there too.
 */

export type PartnerLang = 'nl' | 'en';

/** Normalise anything (`nl-NL`, `NL`, `de`, null) to a language the site has. */
export function readPartnerLang(raw: string | null | undefined): PartnerLang {
  return String(raw ?? '').slice(0, 2).toLowerCase() === 'nl' ? 'nl' : 'en';
}

export function partnerSignupPath(code: string | null | undefined, lang: PartnerLang): string {
  const trimmed = (code ?? '').trim();
  const codePart = trimmed ? `&code=${encodeURIComponent(trimmed)}` : '';
  return `/auth?flow=signup${codePart}&lang=${lang}`;
}

export function partnerLandingPath(slug: string, code: string, lang: PartnerLang): string {
  return `/p/${slug}?code=${encodeURIComponent(code)}&lang=${lang}`;
}
