// Captures the homepage hero's "screens behind the chat": one still of the
// demo dashboard and one of the demo job search per persona, in the
// session's own language, at the deck's proportions. Re-run after a demo
// re-freeze or a dashboard/jobs redesign.
//
//   node scripts/demo-capture-stills.mjs marcel [emma] [--base=http://localhost:8081]
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
if (personas.length === 0) {
  console.error('usage: node scripts/demo-capture-stills.mjs <persona> [persona] [--base=url]');
  process.exit(1);
}

// `nudge` scrolls back up past the sticky demo nav + trust banner so the
// anchor sits just under them.
const SCREENS = [
  { slug: 'dashboard', path: '/demo/dashboard', anchor: 'h1', nudge: -112 },
  { slug: 'jobs', path: '/demo/jobs', anchor: 'main section, section', nudge: -176 },
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
      const url = `${base}${screen.path}?persona=${persona}&lang=${lang}`;
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('cairnly-cookie-consent', JSON.stringify({ choice: 'essential', timestamp: new Date().toISOString() }));
      });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector(screen.anchor, { timeout: 30000 });
      await page.evaluate(
        ({ anchor, nudge }) => {
          document.querySelector(anchor)?.scrollIntoView({ block: 'start' });
          window.scrollBy(0, nudge);
        },
        screen,
      );
      // Let the reveal animations and lazy images settle.
      await new Promise((r) => setTimeout(r, 2500));
      const file = `${OUT}/${persona}-${screen.slug}.jpg`;
      await page.screenshot({
        path: file,
        type: 'jpeg',
        quality: 80,
        clip: { x: 0, y: CHROME_PX, width: VIEWPORT.width, height: VIEWPORT.height - CHROME_PX },
      });
      console.log('wrote', file, url);
    }
  }
} finally {
  await browser.close();
}
