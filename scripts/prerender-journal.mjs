/**
 * Real static prerendering for /journal and /journal/:slug ("poor man's SSG").
 *
 * Problem: scripts/inject-meta.mjs bakes correct <head> tags (title,
 * description, OG, JSON-LD) into each route's static HTML, but the <body> is
 * still just `<div id="root"></div>` until React boots and runs. Googlebot
 * renders JS (with a delay/queue) so classic Search still works, but GPTBot,
 * ClaudeBot, and PerplexityBot do not execute JavaScript at all — to them,
 * every journal article is a title and a meta description. Verified live by
 * fetching a published article with curl: no article text anywhere, just the
 * empty root div.
 *
 * Fix: journal article bodies (src/content/journal/bodies/*.tsx) are pure
 * data, no auth, no i18n, no router, no fetch, unlike the full page shell in
 * src/pages/JournalArticle.tsx (which wraps them in LandingNav/LandingFooter,
 * both of which need real app context). So instead of server-rendering the
 * live page, this renders a minimal, unstyled, purely semantic HTML version
 * of just the substantive content (title, stats, chapters, sources,
 * methodology) using react-dom/server, and injects it into the <div id="root">
 * of the static shell inject-meta.mjs already produced.
 *
 * This is additive only: main.tsx still does `createRoot(...).render(...)`
 * (not hydrateRoot), so JS-capable browsers wipe this and mount the real
 * interactive page exactly as before. Nothing about the live client app
 * changes; this only changes what a non-JS fetch receives.
 *
 * A single article failing to prerender is logged and skipped, not fatal —
 * the build should never fail because one article's content changed shape.
 *
 * Runs from package.json build/build:dev, after vite build && inject-meta.
 */
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './seo-routes.mjs';

const DIST = join(ROOT, 'dist');
const ROOT_DIV = '<div id="root"></div>';
const h = React.createElement;

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderArticle(meta, body) {
  const metaLine = [
    meta.publishedAt ? `Published ${formatDate(meta.publishedAt)}.` : '',
    meta.readingTime ? `${meta.readingTime} min read.` : '',
    meta.authorName ? `By ${meta.authorName}${meta.authorLocation ? `, ${meta.authorLocation}` : ''}.` : '',
    meta.sourceCount ? `${meta.sourceCount} sources cited.` : '',
  ].filter(Boolean).join(' ');

  return h('article', null,
    h('h1', null, meta.title),
    body.description ? h('p', null, body.description) : null,
    metaLine ? h('p', null, metaLine) : null,
    body.statGrid?.length ? h('section', null,
      h('h2', null, 'Key findings'),
      h('ul', null, body.statGrid.map((s, i) =>
        h('li', { key: i }, `${s.number} — ${s.description} (${s.source})`)
      ))
    ) : null,
    body.introContent ? h('section', null, body.introContent) : null,
    ...(body.chapters || []).map((c) =>
      h('section', { key: c.id },
        h('h2', null, c.title),
        c.content
      )
    ),
    body.sources?.length ? h('section', null,
      h('h2', null, 'Sources'),
      h('ol', null, body.sources.map((s) => h('li', { key: s.n }, s.content)))
    ) : null,
    body.methodology ? h('section', null,
      h('h2', null, 'Methodology'),
      h('p', null, body.methodology)
    ) : null,
  );
}

function renderIndex(articles) {
  return h('div', null,
    h('h1', null, 'The Cairnly Journal'),
    h('ul', null, articles.map((a) =>
      h('li', { key: a.slug },
        h('a', { href: `/journal/${a.slug}` }, a.title),
        a.excerpt ? h('p', null, a.excerpt) : null,
      )
    ))
  );
}

function writeIntoShell(outFile, innerHtml) {
  if (!existsSync(outFile)) throw new Error(`static shell missing at ${outFile} — did inject-meta.mjs run first?`);
  const shell = readFileSync(outFile, 'utf8');
  if (!shell.includes(ROOT_DIV)) throw new Error(`${outFile} doesn't contain the expected empty root div`);
  writeFileSync(outFile, shell.replace(ROOT_DIV, `<div id="root">${innerHtml}</div>`));
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('✗ dist/index.html not found — run vite build && inject-meta.mjs first');
    process.exit(1);
  }

  const vite = await createServer({
    root: ROOT,
    mode: 'production', // skip the dev-only componentTagger plugin
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'warn',
  });

  let ok = 0;
  let failed = 0;

  try {
    const { articles } = await vite.ssrLoadModule('/src/content/journal/index.ts');
    const liveArticles = articles.filter((a) => a.status !== 'coming-soon');

    for (const meta of liveArticles) {
      try {
        const body = await vite.ssrLoadModule(`/src/content/journal/bodies/${meta.slug}.tsx`);
        const html = renderToStaticMarkup(renderArticle(meta, body));
        writeIntoShell(join(DIST, 'journal', meta.slug, 'index.html'), html);
        ok++;
      } catch (err) {
        failed++;
        console.warn(`⚠ journal prerender skipped for "${meta.slug}": ${err.message}`);
      }
    }

    try {
      const html = renderToStaticMarkup(renderIndex(liveArticles));
      writeIntoShell(join(DIST, 'journal', 'index.html'), html);
      ok++;
    } catch (err) {
      failed++;
      console.warn(`⚠ journal index prerender skipped: ${err.message}`);
    }
  } finally {
    await vite.close();
  }

  if (ok === 0) {
    console.error('✗ journal prerender produced zero pages — treating as a build failure');
    process.exit(1);
  }

  console.log(`✓ journal prerender: ${ok} route(s) done${failed ? `, ${failed} skipped` : ''}`);
}

main();
