// Captures the homepage hero's "screens behind the chat": one still of the
// demo dashboard and one of the demo job search per persona, in the
// session's own language, at the deck's proportions. Re-run after a demo
// re-freeze or a dashboard/jobs redesign.
//
//   node scripts/demo-capture-stills.mjs marcel [emma] [--only=chat,jobs] [--base=http://localhost:8081]
//
// Needs a running dev server (or the live site via --base) and Google Chrome.
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'public/images/live/landing/demo';
const LANG = { marcel: 'nl', emma: 'en' };

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith('--base='))?.slice(7) || 'http://localhost:8081').replace(/\/$/, '');
const personas = args.filter((a) => !a.startsWith('--'));
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
if (personas.length === 0) {
  console.error('usage: node scripts/demo-capture-stills.mjs <persona> [persona] [--base=url]');
  process.exit(1);
}

// `nudge` scrolls back up past the sticky demo nav + trust banner so the
// anchor sits just under them.
// `anchorText` picks the first h1-h4 containing that text (case-insensitive)
// instead of a selector: the chat still should open on the radar comparison.
const SCREENS = [
  { slug: 'chat', path: '/demo', anchorText: ['verschilt van je andere', 'differs from your other', 'verhoudt', 'differs'], nudge: -136 },
  { slug: 'dashboard', path: '/demo/dashboard', anchor: 'h1', nudge: -140 },
  { slug: 'jobs', path: '/demo/jobs', anchor: 'main section, section', nudge: -230 },
];
// The demo nav + trust banner occupy the top of every demo page; the still
// starts right under them so the deck shows product, not demo chrome.
const CHROME_PX = 96;
const VIEWPORT = { width: 1400, height: 875 };

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });
  for (const persona of personas) {
    const lang = LANG[persona] ?? 'en';
    for (const screen of SCREENS) {
      if (only && !only.includes(screen.slug)) continue;
      const url = `${base}${screen.path}?persona=${persona}&lang=${lang}`;
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('cairnly-cookie-consent', JSON.stringify({ choice: 'essential', timestamp: new Date().toISOString() }));
      });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector(screen.anchor ?? 'h1', { timeout: 30000 });
      if (screen.anchorText) await new Promise((r) => setTimeout(r, 4000)); // the replay renders its turns lazily
      const info = await page.evaluate(
        ({ anchor, anchorText, nudge }) => {
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
          target?.scrollIntoView({ block: 'start' });
          window.scrollBy(0, nudge);
          return { found: !!target, tag: target?.tagName, text: (target?.textContent || '').slice(0, 60), scrollY: window.scrollY, bodyH: document.body.scrollHeight };
        },
        screen,
      );
      if (process.env.DEBUG) console.log(info);
      // Let the reveal animations and lazy images settle.
      await new Promise((r) => setTimeout(r, 2500));
      const file = `${OUT}/${persona}-${screen.slug}.jpg`;
      await page.screenshot({
        path: file,
        type: 'jpeg',
        quality: 80,
        // clip is page-absolute in Puppeteer, so offset by the scroll position.
        clip: { x: 0, y: info.scrollY + CHROME_PX, width: VIEWPORT.width, height: VIEWPORT.height - CHROME_PX },
      });
      console.log('wrote', file, url);
    }
  }
} finally {
  await browser.close();
}
