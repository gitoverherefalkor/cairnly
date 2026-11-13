/**
 * Generates public/sitemap.xml from the shared route registry
 * (scripts/seo-routes.mjs). Runs automatically before `vite build`
 * (see package.json), or on demand with `npm run sitemap`.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITE_URL, publicRoutes } from './seo-routes.mjs';

const xmlEsc = (s) => String(s).replaceAll('&', '&amp;');

function urlEntry({ path, changefreq, priority, lastmod, alternates = [] }) {
  return [
    '  <url>',
    `    <loc>${xmlEsc(`${SITE_URL}${path === '/' ? '/' : path}`)}</loc>`,
    ...alternates.map(
      (a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${xmlEsc(SITE_URL + a.path)}"/>`,
    ),
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
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...routes.map(urlEntry),
  '</urlset>',
  '',
].join('\n');

writeFileSync(join(ROOT, 'public/sitemap.xml'), xml);
console.log(`✓ sitemap.xml written with ${routes.length} URLs`);
