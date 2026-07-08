/**
 * Generates public/sitemap.xml at build time.
 *
 * Combines a hand-maintained list of public marketing/legal routes with the
 * Journal articles discovered from their Markdown frontmatter. Only articles
 * that are actually live (status "featured" or "published") are included —
 * "coming-soon" entries have no real page yet and would 404.
 *
 * Run automatically by `npm run build` (see package.json), or on demand with
 * `npm run sitemap`. Pure Node, no dependencies.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Keep in sync with SITE_URL in src/lib/seo.ts (the primary Vercel domain).
const SITE_URL = 'https://www.cairnly.io';

// Public, indexable routes. App/internal routes (dashboard, chat, ops, etc.)
// are intentionally excluded and also blocked in robots.txt.
const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/journal', changefreq: 'weekly', priority: '0.8' },
  { path: '/starter', changefreq: 'monthly', priority: '0.8' },
  { path: '/encore', changefreq: 'monthly', priority: '0.8' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms-conditions', changefreq: 'yearly', priority: '0.3' },
  { path: '/cookie-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/security', changefreq: 'yearly', priority: '0.3' },
  { path: '/support', changefreq: 'yearly', priority: '0.3' },
];

/** Parse the flat YAML frontmatter of a journal Markdown file. */
function parseFrontmatter(raw) {
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

function collectArticleRoutes() {
  const dir = join(ROOT, 'src/content/journal/articles');
  const routes = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const fm = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
    if (!fm.slug) continue;
    if (fm.status !== 'featured' && fm.status !== 'published') continue; // skip coming-soon
    routes.push({
      path: `/journal/${fm.slug}`,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: fm.publishedAt || undefined,
    });
  }
  return routes;
}

function urlEntry({ path, changefreq, priority, lastmod }) {
  const lines = [
    '  <url>',
    `    <loc>${SITE_URL}${path === '/' ? '/' : path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean);
  return lines.join('\n');
}

const routes = [...STATIC_ROUTES, ...collectArticleRoutes()];
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map(urlEntry),
  '</urlset>',
  '',
].join('\n');

writeFileSync(join(ROOT, 'public/sitemap.xml'), xml);
console.log(`✓ sitemap.xml written with ${routes.length} URLs`);
