// Records the demo for the homepage hero: survey → coach chat → dashboard,
// one clip per (persona, language) the site is published in.
//
//   npm run demo:record                        # marcel-nl + emma-en, full quality
//   node scripts/demo-record-hero.mjs emma-en  # one clip
//   DRAFT=1 node scripts/demo-record-hero.mjs  # 1x, 10 fps, mp4 only: a quick timing check
//   SLOW=1.5 BASE=https://cairnly.io node scripts/demo-record-hero.mjs
//
// Writes public/videos/demo-hero-<persona>-<lang>.{mp4,webm}, the poster and
// one still per scene under public/images/live/landing/demo/, and
// src/lib/demoHero.generated.ts (cache-busting version). Repeatable: after a
// redesign or a demo re-freeze, run it again and picture and product match.
//
// Frames are screenshots with timestamps, stitched by ffmpeg's concat
// demuxer with real durations (Chrome's own recorder does not scale on 2x).
// Demo scaffolding is hidden via [data-demo-chrome]; the pages read
// window.__CAIRNLY_DEMO_CAPTURE__ (src/demo/capture.ts) to skip dialogs, the
// jobs redirect and the margin-note column, and to reveal the transcript on
// command. The cursor, the fades and the "analysing" interstitial are drawn
// by this script; nothing here is product code.
//
// ⚠️ Run from a normal Terminal, never from a Claude session inside the
// desktop app: a Chrome child of that app makes macOS revoke Documents access.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = (process.env.BASE ?? 'http://localhost:8081').replace(/\/$/, '');
const DRAFT = process.env.DRAFT === '1';
const SLOW = Number(process.env.SLOW ?? '2');
const W = 1440;
const H = 900;
const SCALE = DRAFT ? 1 : 2;
const FPS = DRAFT ? 10 : 30;
const MIN_FRAME_MS = DRAFT ? 90 : 0; // draft: don't burn CPU on 30 fps

const CLIPS = [
  { persona: 'marcel', lang: 'nl' },
  { persona: 'emma', lang: 'en' },
];
// Per-language anchors, copied from public/locales/<lang>/{survey,chat,dashboard}.json
// (reportProcessing.steps, quickReplies.explore.label, careerPills.move,
// v4.hero.why, v4.hero.findRole) and the survey fixture's schedule choices.
// Every string is matched case-insensitively against element text, so a
// copy tweak fails loudly here instead of silently recording the wrong thing.
const COPY = {
  en: {
    scheduleChoice: 'Flexible hours',
    nonNegotiable: 'This is non-negotiable for me',
    processing: ['Reading your responses', 'Building your personality profile', 'Preparing your AI career coach'],
    strengthsNav: 'Your Strengths',
    explore: "I'd like to explore this more", // the pill LABEL (it sends a longer message)
    runnerUpHeading: 'runner-up',
    moveSuffix: 'explore why',
    whyFits: 'Why this fits',
    findRole: 'Find this role',
  },
  nl: {
    scheduleChoice: 'Flexibele werktijden',
    nonNegotiable: 'Dit is voor mij niet onderhandelbaar',
    processing: ['Je antwoorden worden gelezen', 'Je persoonlijkheidsprofiel wordt opgebouwd', 'Je AI-carrièrecoach wordt voorbereid'],
    strengthsNav: 'Sterke punten',
    explore: 'Hier wil ik dieper op ingaan',
    runnerUpHeading: 'runner-up',
    moveSuffix: 'ontdek waarom',
    whyFits: 'Waarom dit past',
    findRole: 'Zoek deze rol',
  },
};
// Index of the coach's Strengths delivery + 1 = how many messages are
// visible when the chat scene opens (both fixtures: 0 ready, 1 approach,
// 2 user, 3 coach, 4 continue, 5 strengths).
const STRENGTHS_REVEAL = 6;

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const clips = wanted.length ? CLIPS.filter((c) => wanted.includes(`${c.persona}-${c.lang}`)) : CLIPS;
if (!clips.length) {
  console.error(`no clip matched. known: ${CLIPS.map((c) => `${c.persona}-${c.lang}`).join(', ')}`);
  process.exit(1);
}

const root = process.cwd();
const videosDir = resolve(root, 'public/videos');
const imagesDir = resolve(root, 'public/images/live/landing/demo');
mkdirSync(videosDir, { recursive: true });
mkdirSync(imagesDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = (ms) => sleep(ms * SLOW);

// ---------------------------------------------------------------------------
// Overlays drawn into the page: cursor, fades, processing interstitial.
// All live under one fixed root with pointer-events:none, so they never
// intercept the clicks the script sends to the page.
async function installOverlay(page) {
  await page.evaluate(() => {
    if (document.getElementById('__rec')) return;
    const root = document.createElement('div');
    root.id = '__rec';
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:Inter,system-ui,sans-serif';
    root.innerHTML =
      '<div id="__fade" style="position:absolute;inset:0;background:#000;opacity:0;transition:opacity 250ms ease"></div>' +
      '<div id="__cur" style="position:absolute;left:-40px;top:-40px;width:26px;height:26px;transition:transform 60ms ease;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">' +
      '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 3l14 9-6.5 1.2L16 20l-3 1.2-3.5-6.8L5 19z" fill="#fff" stroke="#122E3B" stroke-width="1.6" stroke-linejoin="round"/></svg></div>';
    document.body.appendChild(root);
    window.__recCursor = { x: -40, y: -40 };
  });
}
const cursorTo = async (page, x, y, ms = 420) => {
  await page.evaluate(
    async ({ x, y, ms }) => {
      const cur = document.getElementById('__cur');
      const from = { ...window.__recCursor };
      const t0 = performance.now();
      await new Promise((done) => {
        const step = () => {
          const p = Math.min(1, (performance.now() - t0) / ms);
          const e = 1 - Math.pow(1 - p, 3);
          cur.style.left = from.x + (x - from.x) * e + 'px';
          cur.style.top = from.y + (y - from.y) * e + 'px';
          if (p < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
      window.__recCursor = { x, y };
    },
    { x, y, ms: ms * SLOW },
  );
};
const cursorPress = async (page) => {
  await page.evaluate(() => {
    const cur = document.getElementById('__cur');
    cur.style.transform = 'scale(.82)';
    setTimeout(() => (cur.style.transform = ''), 120);
  });
};
const fade = async (page, to) => {
  await page.evaluate((o) => (document.getElementById('__fade').style.opacity = String(o)), to);
  await sleep(300);
};

// Finds the smallest visible element whose text contains `needle`
// (case-insensitive), optionally only among `tags`. Returns its centre.
// `last` picks the last match in DOM order instead (the real quick-reply
// row sits under the cut message, after the coach's own copies of the text).
async function locate(page, needle, { tags = 'button, a, label, span, p, h1, h2, h3, h4, strong, div', last = false } = {}) {
  const box = await page.evaluate(
    ({ needle, tags, last }) => {
      const n = needle.toLowerCase();
      let hits = [...document.querySelectorAll(tags)]
        .filter((el) => (el.textContent || '').toLowerCase().includes(n))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      if (!last) hits = hits.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
      const el = last ? hits[hits.length - 1] : hits[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom };
    },
    { needle, tags, last },
  );
  if (!box) throw new Error(`not found on page: "${needle}"`);
  return box;
}
// Scroll so the element sits `pad` px under the top, smoothly.
async function scrollToText(page, needle, pad = 120, opts = {}) {
  const box = await locate(page, needle, opts);
  await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), box.top - pad);
  await pause(700);
}
// Move the cursor to the text, press, and click it. Re-clicks while the
// expected state stays away (the screenshot loop slows the page; a click
// can land mid-animation and be lost).
async function clickText(page, needle, { reached = null, tries = 3, ...opts } = {}) {
  for (let i = 0; i < tries; i++) {
    const box = await locate(page, needle, opts);
    await cursorTo(page, box.x, box.y);
    await cursorPress(page);
    await page.mouse.click(box.x, box.y);
    if (!reached) return;
    for (let t = 0; t < 12; t++) {
      await sleep(250);
      if (await reached()) return;
    }
  }
  throw new Error(`state not reached after clicking "${needle}"`);
}
const messageCount = (page) => page.evaluate(() => document.querySelectorAll('[id^="demo-msg-"]').length);
const clickPoint = async (page, pt) => {
  await cursorTo(page, pt.x, pt.y);
  await cursorPress(page);
  await page.mouse.click(pt.x, pt.y);
};

// The real /report-processing page needs a live report; this is its look
// for a second and a half: dark canvas, logo, steps ticking through.
async function processingInterstitial(page, steps) {
  await page.evaluate((steps) => {
    const el = document.createElement('div');
    el.id = '__proc';
    el.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
      'background:radial-gradient(circle at 30% 20%, rgba(39,161,161,.18), transparent 55%),#0F2530;color:#fff;opacity:0;transition:opacity 250ms ease';
    el.innerHTML =
      '<img src="/logos/cairnly-logo.png" alt="" style="height:56px;filter:brightness(0) invert(1);opacity:.9">' +
      '<div id="__procstep" style="font-size:20px;font-weight:600;letter-spacing:-.01em;min-height:28px"></div>' +
      '<div style="width:260px;height:4px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden"><div id="__procbar" style="height:100%;width:0;background:#D4A024;transition:width 500ms ease"></div></div>';
    document.getElementById('__rec').appendChild(el);
    requestAnimationFrame(() => (el.style.opacity = '1'));
    window.__procSteps = steps;
  }, steps);
  for (let i = 0; i < steps.length; i++) {
    await page.evaluate(
      ({ i, n }) => {
        document.getElementById('__procstep').textContent = window.__procSteps[i];
        document.getElementById('__procbar').style.width = `${Math.round(((i + 1) / n) * 100)}%`;
      },
      { i, n: steps.length },
    );
    await pause(500);
  }
  await pause(300);
}

// ---------------------------------------------------------------------------
async function record({ persona, lang }) {
  const copy = COPY[lang];
  const name = `${persona}-${lang}`;
  const tmp = resolve(root, '.demo-capture', name);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  console.log(`\n▶ ${name}${DRAFT ? ' (draft)' : ''}`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
  await page.evaluateOnNewDocument((lang) => {
    window.__CAIRNLY_DEMO_CAPTURE__ = true;
    localStorage.setItem('cairnly_language', lang);
    localStorage.setItem('cairnly-cookie-consent', JSON.stringify({ choice: 'essential', timestamp: new Date().toISOString() }));
    localStorage.setItem('cairnly_language_suggestion_dismissed', new Date().toISOString());
    const style = document.createElement('style');
    style.textContent = '[data-demo-chrome]{display:none!important} html{scroll-behavior:smooth}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  }, lang);

  // --- frame loop ------------------------------------------------------------
  const frames = [];
  let recording = false; // true = capture, false = idle, null = stop
  let n = 0;
  const loop = (async () => {
    while (recording !== null) {
      if (!recording) {
        await sleep(20);
        continue;
      }
      const p = resolve(tmp, `f${String(n++).padStart(5, '0')}.jpg`);
      const t = performance.now();
      try {
        await page.screenshot({ path: p, type: 'jpeg', quality: 88 });
        frames.push({ p, t });
      } catch {
        break;
      }
      if (MIN_FRAME_MS) await sleep(MIN_FRAME_MS);
    }
  })();
  const stills = [];
  const still = async (label) => {
    const p = resolve(tmp, `still-${label}.jpg`);
    await page.screenshot({ path: p, type: 'jpeg', quality: 90 });
    stills.push({ p, label });
  };
  const goto = async (path) => {
    await page.goto(`${BASE}${path}?persona=${persona}&lang=${lang}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await installOverlay(page);
  };

  // 1. Survey ------------------------------------------------------------------
  await goto('/demo/survey');
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);
  recording = true;
  await pause(900);
  await scrollToText(page, copy.scheduleChoice, 200, { tags: 'label, button, div, span' });
  await clickText(page, copy.scheduleChoice, { tags: 'label, button, div, span' });
  await pause(700);
  await clickText(page, copy.nonNegotiable, { tags: 'label' });
  await pause(900);
  await still('01-survey');
  await page.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
  await pause(1200);

  // 1b. Processing interstitial, then straight into the chat under it ---------
  await processingInterstitial(page, copy.processing);
  await fade(page, 1);
  recording = false; // the page swap must not be in the film
  await goto('/demo');
  await page.evaluate((n) => window.__cairnlyDemoReveal?.(n), STRENGTHS_REVEAL);
  await sleep(1200);
  if ((await messageCount(page)) !== STRENGTHS_REVEAL) throw new Error('replay did not cut at the Strengths delivery');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => (document.getElementById('__fade').style.opacity = '1'));
  recording = true;
  await fade(page, 0);

  // 2. Chat: strengths + explore pill ----------------------------------------
  await clickText(page, copy.strengthsNav, { tags: 'button' });
  await pause(1600);
  await scrollToText(page, copy.explore, 620, { tags: 'button', last: true });
  await pause(400);
  const before = await messageCount(page);
  await clickText(page, copy.explore, { tags: 'button', last: true, reached: async () => (await messageCount(page)) > before });
  await pause(1400);
  await page.evaluate(() => window.scrollBy({ top: 360, behavior: 'smooth' }));
  await pause(900);
  await still('02-explore');
  // Option 1 of the coach's follow-up card: the last numbered "1" row.
  const opt1 = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('button')].filter((b) => /^\s*1\s/.test(b.innerText) && b.innerText.length > 20);
    const b = rows[rows.length - 1];
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!opt1) throw new Error('follow-up option 1 not found');
  await clickPoint(page, opt1);
  await pause(1500);
  await page.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
  await pause(1600);

  // 3. Chat: runner-ups, open the first, Move pill ------------------------------
  await page.evaluate(() => window.__cairnlyDemoReveal?.(10000)); // everything
  await sleep(1500);
  await scrollToText(page, copy.runnerUpHeading, 110, { tags: 'strong, h3, span, p' });
  await pause(1500);
  await still('03-runner-ups');
  // The first collapsed card header.
  const card = await page.evaluate(() => {
    const el = document.querySelector('[data-card-collapsed]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + Math.min(r.width / 2, 260), y: r.top + Math.min(r.height / 2, 28) };
  });
  if (!card) throw new Error('no collapsed runner-up card');
  await clickPoint(page, card);
  await pause(1400);
  await scrollToText(page, copy.moveSuffix, 560, { tags: 'button' });
  await pause(600);
  await clickText(page, copy.moveSuffix, { tags: 'button' });
  await pause(2200); // the replay scrolls to the feasibility question and rings it
  await still('04-move');
  await pause(1200);

  // 4. wrap: fade -----------------------------------------------------------------
  await fade(page, 1);
  recording = false;

  // 5. Dashboard ---------------------------------------------------------------------
  await goto('/demo/dashboard');
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1500);
  await page.evaluate(() => (document.getElementById('__fade').style.opacity = '1'));
  recording = true;
  await fade(page, 0);
  await pause(800);
  // Hover the compare radar on the top card: the card flips to its back.
  const why = await locate(page, copy.whyFits, { tags: 'button' });
  const flipTarget = await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => {
      const r = s.getBoundingClientRect();
      return r.width > 180 && r.height > 180 && r.top > 0 && r.top < window.innerHeight;
    });
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!flipTarget) throw new Error('compare radar not found on the top card');
  await cursorTo(page, flipTarget.x, flipTarget.y, 600);
  await page.mouse.move(flipTarget.x, flipTarget.y);
  await pause(2600); // flip + read
  await still('05-flip');
  // Leave the card so it flips back, then "Why this fits".
  await cursorTo(page, 40, why.y, 500);
  await page.mouse.move(40, why.y);
  await pause(1100);
  await clickText(page, copy.whyFits, { tags: 'button' });
  await pause(2200);
  await still('06-why');
  await pause(600);

  // 6. Find this role → fade out --------------------------------------------------
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(900);
  await clickText(page, copy.findRole, { tags: 'button' });
  await pause(500);
  await fade(page, 1);
  await pause(400);
  recording = null;
  await loop;
  await browser.close();

  // --- ffmpeg ---------------------------------------------------------------------
  if (frames.length < 10) throw new Error('too few frames');
  const t0 = frames[0].t;
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const start = (frames[i].t - t0) / 1000;
    const next = i + 1 < frames.length ? (frames[i + 1].t - t0) / 1000 : start + 0.4;
    lines.push(`file '${frames[i].p}'`, `duration ${Math.max(next - start, 0.01).toFixed(4)}`);
  }
  lines.push(`file '${frames[frames.length - 1].p}'`);
  const list = resolve(tmp, 'frames.txt');
  writeFileSync(list, lines.join('\n') + '\n');

  const mp4 = resolve(videosDir, `demo-hero-${name}.mp4`);
  const webm = resolve(videosDir, `demo-hero-${name}.webm`);
  const common = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-an', '-fps_mode', 'cfr', '-r', String(FPS), '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`];
  execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-crf', DRAFT ? '30' : '23', '-preset', DRAFT ? 'veryfast' : 'slow', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (!DRAFT) execFileSync('ffmpeg', [...common, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1', webm], { stdio: 'inherit' });
  // Poster = the first frame (the survey), so the page never flashes black.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', frames[0].p, '-vf', `scale=${W}:${H}`, '-q:v', '4', resolve(imagesDir, `hero-poster-${name}.jpg`)], { stdio: 'inherit' });
  for (const { p, label } of stills) copyFileSync(p, resolve(imagesDir, `hero-still-${label}-${name}.jpg`));
  rmSync(tmp, { recursive: true, force: true });

  const duration = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
  const avg = (frames.length / ((frames[frames.length - 1].t - t0) / 1000)).toFixed(1);
  console.log(`  ${mp4}: ${Number(duration).toFixed(1)} s, ${frames.length} frames (~${avg} fps captured)${DRAFT ? '' : `, ${webm}`}`);
}

for (const clip of clips) await record(clip);

if (!DRAFT) {
  const version = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  writeFileSync(
    resolve(root, 'src/lib/demoHero.generated.ts'),
    `// Written by scripts/demo-record-hero.mjs; do not edit by hand. Appended as\n// ?v= to the hero video URLs so Safari fetches the new recording instead of\n// the cached one. "0" = no recording committed yet.\nexport const DEMO_HERO_VERSION = "${version}";\n`,
  );
  console.log(`\nversion ${version} written to src/lib/demoHero.generated.ts`);
}
