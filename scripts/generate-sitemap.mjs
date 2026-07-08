/**
 * Generates public/sitemap.xml from the shared route registry
 * (scripts/seo-routes.mjs). Runs automatically before `vite build`
 * (see package.json), or on demand with `npm run sitemap`.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITE_URL, publicRoutes } from './seo-routes.mjs';

function urlEntry({ path, changefreq, priority, lastmod }) {
  return [
    '  <url>',
    `    <loc>${SITE_URL}${path === '/' ? '/' : path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

const routes = publicRoutes();
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map(urlEntry),
  '</urlset>',
  '',
].join('\n');

writeFileSync(join(ROOT, 'public/sitemap.xml'), xml);
console.log(`✓ sitemap.xml written with ${routes.length} URLs`);
