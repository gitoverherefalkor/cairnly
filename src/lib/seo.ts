/**
 * Central SEO configuration.
 *
 * SITE_URL is the single source of truth for the canonical origin used across
 * every <link rel="canonical">, og:url, sitemap entry, and JSON-LD block.
 *
 * ⚠️ If you ever change the primary domain (e.g. switch from www.cairnly.io to
 * the bare apex cairnly.io), change ONLY this one line — everything downstream
 * derives from it. Keep it in sync with the "primary" domain set in Vercel
 * (whichever one the others redirect TO).
 */
export const SITE_URL = 'https://www.cairnly.io';

/**
 * Fallbacks used when a page doesn't override them. This is the ONLY place
 * these defaults are defined — index.html deliberately has no static
 * description/OG/Twitter tags, to avoid duplicate conflicting tags once
 * <Seo> mounts (see index.html for why).
 */
export const DEFAULT_TITLE = 'Cairnly — Career change clarity. Find a career that fits.';
export const DEFAULT_DESCRIPTION =
  "Thinking about a career change? Cairnly's assessment matches your personality, skills, and goals to careers that actually fit — with an AI career coach to talk it through.";
// Dedicated 1200x630 share card (public/og-card.png), regenerated via a
// headless-browser render of the brand card — not the raw logo file.
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-card.png`;

/** Build an absolute canonical URL from a route path (e.g. "/journal"). */
export function canonical(path = '/'): string {
  if (!path || path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Resolve an image (root-relative or absolute) to an absolute URL. */
export function absoluteImage(image?: string): string {
  if (!image) return DEFAULT_OG_IMAGE;
  if (image.startsWith('http')) return image;
  return `${SITE_URL}${image.startsWith('/') ? image : `/${image}`}`;
}

/**
 * Organization schema — describes Cairnly as an entity to search engines.
 * Powers knowledge-panel eligibility and brand recognition in results.
 */
export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Cairnly',
  url: SITE_URL,
  logo: `${SITE_URL}/cairnly-logo.png`,
  description: DEFAULT_DESCRIPTION,
};

/**
 * WebSite schema — ties the domain to the brand name (helps Google render the
 * site name correctly in results).
 */
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Cairnly',
  url: SITE_URL,
};
