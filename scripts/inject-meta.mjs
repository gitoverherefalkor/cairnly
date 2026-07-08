/**
 * Post-build static meta injection ("poor man's prerender", no browser needed).
 *
 * Problem: Cairnly is a client-rendered SPA. Social scrapers (LinkedIn, Slack,
 * WhatsApp, Facebook) and some crawlers do NOT execute JavaScript, so they
 * never see the per-page tags that react-helmet-async renders — every URL
 * would preview as a bare shell.
 *
 * Fix: after `vite build`, write a copy of dist/index.html for each public
 * route (e.g. dist/journal/<slug>/index.html) with that route's title,
 * description, canonical, Open Graph/Twitter tags, and JSON-LD baked into the
 * <head>. Vercel serves files from the filesystem BEFORE applying the SPA
 * rewrite in vercel.json, so scrapers hitting those URLs get correct static
 * tags, while the React app still boots and takes over normally.
 *
 * Every injected tag carries `data-static-seo`; src/main.tsx removes them all
 * before React mounts, so react-helmet-async remains the single owner of the
 * live document head (no duplicate/conflicting tags — see index.html).
 *
 * Runs from package.json: build = sitemap && vite build && inject-meta.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { ROOT, SITE_URL, DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, publicRoutes } from './seo-routes.mjs';

const DIST = join(ROOT, 'dist');

const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function headBlock(route) {
  const title = route.title || DEFAULT_TITLE;
  const description = route.description || DEFAULT_DESCRIPTION;
  const url = `${SITE_URL}${route.path === '/' ? '/' : route.path}`;
  const image = `${SITE_URL}${route.image || DEFAULT_OG_IMAGE}`;
  const type = route.type || 'website';
  const A = 'data-static-seo';
  const lines = [
    `    <meta ${A} name="description" content="${esc(description)}" />`,
    `    <link ${A} rel="canonical" href="${url}" />`,
    `    <meta ${A} property="og:title" content="${esc(title)}" />`,
    `    <meta ${A} property="og:description" content="${esc(description)}" />`,
    `    <meta ${A} property="og:type" content="${type}" />`,
    `    <meta ${A} property="og:url" content="${url}" />`,
    `    <meta ${A} property="og:site_name" content="Cairnly" />`,
    `    <meta ${A} property="og:image" content="${image}" />`,
    `    <meta ${A} name="twitter:card" content="summary_large_image" />`,
    `    <meta ${A} name="twitter:title" content="${esc(title)}" />`,
    `    <meta ${A} name="twitter:description" content="${esc(description)}" />`,
    `    <meta ${A} name="twitter:image" content="${image}" />`,
  ];
  for (const schema of route.jsonLd || []) {
    // JSON-LD contains no `</script>` sequences (all values are plain data),
    // so embedding the serialized object directly is safe.
    lines.push(`    <script ${A} type="application/ld+json">${JSON.stringify(schema)}</script>`);
  }
  return lines.join('\n');
}

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
let count = 0;

for (const route of publicRoutes()) {
  const html = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(route.title || DEFAULT_TITLE)}</title>`)
    .replace('</head>', `${headBlock(route)}\n  </head>`);
  const outFile =
    route.path === '/' ? join(DIST, 'index.html') : join(DIST, route.path.slice(1), 'index.html');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
  count++;
}

console.log(`✓ static meta injected for ${count} routes`);
