// Captures the homepage hero's deck of demo screens: chat, dashboard and job
// search, for every persona in every language the site is published in.
// Re-run after a demo re-freeze or a dashboard/jobs redesign.
//
//   node scripts/demo-capture-stills.mjs                 # all 4 combos
//   node scripts/demo-capture-stills.mjs marcel-nl emma-en
//   node scripts/demo-capture-stills.mjs --only=chat --base=http://localhost:8081
//
// Needs a running dev server (or the live site via --base) and Google Chrome.
//
// Two things the hero depends on and this script guarantees:
//  1. ONE aspect ratio for every file. DemoStage sizes its frame FROM the
//     image, so a still of a different shape would change the deck's height
//     as the visitor pages through it.
//  2. Persona AND language in the filename. `?persona=` decouples the two, so
//     an English page can show Marcel — and must not then show Dutch screens.
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'public/images/live/landing/demo';

/** Every published (persona, language) pair. Marcel's session was held in
 *  Dutch and Emma's in English; the demo translates either one on request. */
const COMBOS = [
  { persona: 'emma', lang: 'en' },
  { persona: 'emma', lang: 'nl' },
  { persona: 'marcel', lang: 'nl' },
  { persona: 'marcel', lang: 'en' },
];

// The demo page's sticky nav, once the trust banner has scrolled away. The
// still starts right under it so the deck shows product, not demo chrome.
const CHROME_PX = 98;
// Every still is 1200x800 (3:2) — the contract DemoStage's STILL_W/STILL_H
// mirror. Screens whose layout is wider than the shot are captured in a wider
// viewport and clipped back to 1200 (see `vw` below).
const SHOT = { width: 1200, height: 800 };

// `anchorText` picks the smallest element containing any of these strings
// (case-insensitive) and scrolls it to the top; `nudge` then scrolls back up
// so the anchor sits just below the demo chrome instead of flush against it.
const SCREENS = [
  {
    slug: 'chat',
    path: '/demo',
    // Demo.tsx keeps the report sidebar EXPANDED and the margin notes out of
    // the flow at >= 1360 (its WIDE), but then gives the transcript 320px
    // side margins. Shooting at 1520 and clipping to the left 1200 keeps the
    // named sidebar and the full transcript while dropping the empty right
    // margin the (removed) notes would have filled.
    vw: 1520,
    // The runner-up delivery: the coach's intro plus the career cards with
    // their match / AI-impact / step pills. The radar comparison used to be
    // here, but the dashboard still already shows that chart (Sjoerd,
    // 2026-09-05), so the chat still shows something the dashboard does not.
    anchorText: ['runner-up career matches', 'runner-up carrièrematches', 'runner-up matches'],
    pad: 120,
    settle: 4000, // the replay renders its turns lazily
  },
  // pad 76 clears the "YOUR CAREER PROFILE / JOUW CARRIEREPROFIEL" eyebrow
  // that sits just above the h1, in both languages.
  { slug: 'dashboard', path: '/demo/dashboard', anchor: 'h1', pad: 76 },
  {
    slug: 'jobs',
    path: '/demo/jobs',
    // The first career section, whichever tier it is: Emma's frozen search ran
    // on her #1 and Marcel's on his #2, so "#1" alone finds nothing. Anchored
    // on the badge's data attribute rather than its text, which is localized.
    // Anchoring here also keeps the referral/lock banner above the frame.
    anchor: '[data-career-tier]',
    pad: 60,
  },
];

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith('--base='))?.slice(7) || 'http://localhost:8081').replace(/\/$/, '');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const wanted = args.filter((a) => !a.startsWith('--'));
const combos = wanted.length ? COMBOS.filter((c) => wanted.includes(`${c.persona}-${c.lang}`)) : COMBOS;
if (!combos.length) {
  console.error(`no combo matched. known: ${COMBOS.map((c) => `${c.persona}-${c.lang}`).join(', ')}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem(
      'cairnly-cookie-consent',
      JSON.stringify({ choice: 'essential', timestamp: new Date().toISOString() }),
    );
  });
  for (const { persona, lang } of combos) {
    for (const screen of SCREENS) {
      if (only && !only.includes(screen.slug)) continue;
      const url = `${base}${screen.path}?persona=${persona}&lang=${lang}`;
      // Set before navigating: the demo reads innerWidth at mount to decide
      // whether the sidebar starts collapsed.
      await page.setViewport({
        width: screen.vw ?? SHOT.width,
        height: SHOT.height + CHROME_PX,
        // 1.5x -> 1800x1200 files. The deck renders the still at ~640px CSS
        // (~850 on a wide desktop), so 1800 stays above retina density there
        // while costing roughly half of what a 2x capture does.
        deviceScaleFactor: 1.5,
      });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector(screen.anchor ?? 'h1', { timeout: 30000 });
      // The margin notes explain the demo to a visitor who is reading it; in a
      // 640px-wide hero window they are unreadable clutter that reads as part
      // of the product. Drop them before measuring so nothing reserves space.
      await page.evaluate(() => {
        document.querySelectorAll('[data-demo-annotation]').forEach((el) => el.remove());
      });
      if (screen.settle) await new Promise((r) => setTimeout(r, screen.settle));
      const info = await page.evaluate(
        ({ anchor, anchorText, pad, chrome }) => {
          let target = anchor ? document.querySelector(anchor) : null;
          if (anchorText) {
            // The chat renders headings as styled blocks, so look at every
            // small leaf-ish element rather than h1-h4 only.
            const all = [...document.querySelectorAll('h1, h2, h3, h4, h5, strong, p, span, div')];
            for (const needle of anchorText) {
              const hits = all
                .filter((el) => (el.textContent || '').toLowerCase().includes(needle))
                .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
              target = hits[0] ?? null;
              if (target) break;
            }
          }
          // Land the anchor exactly `pad` below the top of the shot: scroll
          // it to where the still's first row will be, plus the sticky nav
          // that has to stay above the clip.
          target?.scrollIntoView({ block: 'start' });
          if (target) window.scrollBy(0, target.getBoundingClientRect().top - (chrome + pad));
          return { found: !!target, text: (target?.textContent || '').slice(0, 60), scrollY: window.scrollY };
        },
        { ...screen, chrome: CHROME_PX },
      );
      if (!info.found) console.warn(`  ! anchor not found for ${persona}-${lang}-${screen.slug}`);
      // Let the reveal animations and lazy images settle.
      await new Promise((r) => setTimeout(r, 2500));
      const file = `${OUT}/${persona}-${lang}-${screen.slug}.jpg`;
      await page.screenshot({
        path: file,
        type: 'jpeg',
        quality: 82,
        // clip is page-absolute in Puppeteer, so offset by the scroll position.
        clip: { x: 0, y: info.scrollY + CHROME_PX, width: SHOT.width, height: SHOT.height },
      });
      console.log('wrote', file);
    }
  }
} finally {
  await browser.close();
}
