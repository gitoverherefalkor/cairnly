/**
 * Single source of truth for every PUBLIC, indexable route and its SEO
 * metadata, consumed by:
 *   - scripts/generate-sitemap.mjs   (sitemap.xml, prebuild)
 *   - scripts/inject-meta.mjs        (per-route static HTML shells, postbuild)
 *
 * ⚠️ Titles/descriptions here must be kept in sync with the <Seo> props in
 * the corresponding page components (src/pages/*). The static values are what
 * non-JS crawlers and social scrapers (LinkedIn, Slack, WhatsApp) see; the
 * <Seo> values are what JS-rendering crawlers (Googlebot) see. They should
 * say the same thing.
 *
 * Keep SITE_URL in sync with src/lib/seo.ts (the primary Vercel domain).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

export const SITE_URL = 'https://www.cairnly.io';

export const DEFAULT_TITLE = 'Cairnly — Career change clarity. Find a career that fits.';
export const DEFAULT_DESCRIPTION =
  "Thinking about a career change? Cairnly's assessment matches your personality, skills, and goals to careers that actually fit — with an AI career coach to talk it through.";
export const DEFAULT_OG_IMAGE = '/og-card.jpg';

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Cairnly',
  url: SITE_URL,
  logo: `${SITE_URL}/logos/cairnly-logo.png`,
  description: DEFAULT_DESCRIPTION,
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Cairnly',
  url: SITE_URL,
};

/** Static marketing/legal routes. Mirrors the <Seo> calls in src/pages. */
const STATIC_ROUTES = [
  {
    path: '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    changefreq: 'weekly',
    priority: '1.0',
    jsonLd: [organizationSchema, websiteSchema],
  },
  {
    path: '/journal',
    title: 'The Cairnly Journal — Research on careers, work & changing paths',
    description:
      'Original research and essays on career change, burnout, disengagement, and what actually makes work fit. From the team behind the Cairnly career assessment.',
    changefreq: 'weekly',
    priority: '0.8',
  },
  {
    path: '/starter',
    title: 'Cairnly Starter — Figure out your first career move',
    description:
      'Just starting out and unsure what to do? Cairnly Starter turns who you are into concrete first- and second-job directions, built with career coaches.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    path: '/encore',
    title: 'Cairnly Encore — Find your next chapter after your main career',
    description:
      'Pre-retirement or newly retired and looking for meaningful work? Cairnly Encore turns a lifetime of experience into concrete next-chapter directions.',
    changefreq: 'monthly',
    priority: '0.8',
  },
  // Legal/support pages keep the site-default title+description (matching
  // their runtime DefaultSeo fallback) so static and rendered heads agree.
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms-conditions', changefreq: 'yearly', priority: '0.3' },
  { path: '/cookie-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/security', changefreq: 'yearly', priority: '0.3' },
  { path: '/support', changefreq: 'yearly', priority: '0.3' },
];

/** Parse the flat YAML frontmatter of a journal Markdown file. */
export function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return data;
}

/** Journal article routes, discovered from Markdown frontmatter. Live only. */
function articleRoutes() {
  const dir = join(ROOT, 'src/content/journal/articles');
  const routes = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const fm = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
    if (!fm.slug) continue;
    if (fm.status !== 'featured' && fm.status !== 'published') continue; // skip coming-soon
    const path = `/journal/${fm.slug}`;
    // Same share-image rule as JournalArticle.tsx: use the report's stat
    // graphic where one exists, otherwise the brand share card.
    const image =
      fm.slug === 'career-uncertainty-report'
        ? '/images/live/career-uncertainty-stats.png'
        : DEFAULT_OG_IMAGE;
    routes.push({
      path,
      title: `${fm.title} — Cairnly Journal`,
      description: fm.excerpt || DEFAULT_DESCRIPTION,
      image,
      type: 'article',
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: fm.publishedAt || undefined,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: fm.title,
          description: fm.excerpt || '',
          image: `${SITE_URL}${image}`,
          datePublished: fm.publishedAt,
          dateModified: fm.publishedAt,
          author: { '@type': 'Organization', name: fm.authorName || 'The Cairnly team', url: SITE_URL },
          publisher: {
            '@type': 'Organization',
            name: 'Cairnly',
            logo: { '@type': 'ImageObject', url: `${SITE_URL}/logos/cairnly-logo.png` },
          },
          mainEntityOfPage: `${SITE_URL}${path}`,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Journal', item: `${SITE_URL}/journal` },
            { '@type': 'ListItem', position: 3, name: fm.title, item: `${SITE_URL}${path}` },
          ],
        },
      ],
    });
  }
  return routes;
}

/** All public routes with full metadata. */
export function publicRoutes() {
  return [...STATIC_ROUTES, ...articleRoutes()];
}
