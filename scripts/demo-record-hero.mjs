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
// Frames come from Chrome's screencast stream (a frame whenever the screen
// changes, up to 60 fps, at device pixels), each stamped on arrival, and are
// stitched by ffmpeg's concat demuxer with real durations. Puppeteer's own
// screenshot loop managed ~5 fps and Playwright's recorder does not scale on 2x.
// Demo scaffolding is hidden via [data-demo-chrome]; the pages read
// window.__CAIRNLY_DEMO_CAPTURE__ (src/demo/capture.ts) to skip dialogs, the
// jobs redirect and the margin-note column, to start the survey's rider
// question empty, and to reveal the transcript on command. The cursor, the
// fades and the "analysing" interstitial are drawn by this script; nothing
// here is product code.
//
// Clicks are DOM clicks on the located element after the drawn cursor has
// travelled there (and the real pointer moved, for hover states): synthetic
// mouse clicks were lost under the screenshot loop (2026-09-14).
//
// ⚠️ Run from a normal Terminal, never from a Claude session inside the
// desktop app: a Chrome child of that app makes macOS revoke Documents access.
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// CONNECT_PORT=9222: attach to a Chrome started separately (e.g. via macOS
// `open -na "Google Chrome" --args --headless=new --remote-debugging-port=9222
// --user-data-dir=/tmp/x`) instead of launching one. From a Claude desktop
// session that is the only safe way: a Chrome child of the app makes macOS
// revoke Documents access.
const CONNECT_PORT = process.env.CONNECT_PORT ? Number(process.env.CONNECT_PORT) : null;
const BASE = (process.env.BASE ?? 'http://localhost:8081').replace(/\/$/, '');
const DRAFT = process.env.DRAFT === '1';
const SLOW = Number(process.env.SLOW ?? '1');
const W = 1440;
const H = 900;
const SCALE = DRAFT ? 1 : 2;
const FPS = DRAFT ? 10 : 30;

const CLIPS = [
  { persona: 'marcel', lang: 'nl' },
  { persona: 'emma', lang: 'en' },
];
// Per-language anchors, copied from public/locales/<lang>/{survey,chat,dashboard,demo}.json
// and the survey fixture's schedule choices. Every string is matched
// case-insensitively against element text, so a copy tweak fails loudly here
// instead of silently recording the wrong thing.
const COPY = {
  en: {
    resumeContinue: 'Continue to Assessment', // preSurveyUpload.cta.continue
    rankAdd: 'Creativity', // a "tap to add" career value
    scheduleChoice: 'Flexible hours',
    nonNegotiable: 'This is non-negotiable for me',
    processing: ['Reading your responses', 'Building your personality profile', 'Preparing your AI career coach'],
    strengthsNav: 'Your Strengths',
    explore: "I'd like to explore this more", // quickReplies.explore.label (the pill; it sends a longer message)
    runnerUpHeading: 'runner-up',
    moveSuffix: 'explore why', // careerPills.move
    welcomeEyebrow: 'YOUR CAREER PROFILE', // v4.welcome.eyebrow
    reportEyebrow: 'YOUR FULL REPORT', // v4.reportHeader.eyebrow
    aboutEyebrow: 'ABOUT YOU', // v4.report.aboutEyebrow
    runnersTitle: 'Runner-up Careers', // v4.fallbackTitle.runners
    pathsEyebrow: 'MORE PATHS WORTH CONSIDERING', // v4.paths.eyebrow
    jobsCta: 'Open the job search', // dashboardDemo.jobsNudge.cta
    titles: [
      ['Step 1 of 3', 'A survey built for career change'],
      ['Step 2 of 3', 'Your analysis, delivered in a live AI coaching session'],
      ['Step 3 of 3', 'Outcomes and your chat feedback, on one dashboard'],
    ],
  },
  nl: {
    resumeContinue: 'Doorgaan naar het assessment',
    rankAdd: 'Creativiteit',
    scheduleChoice: 'Flexibele werktijden',
    nonNegotiable: 'Dit is voor mij niet onderhandelbaar',
    processing: ['Je antwoorden worden gelezen', 'Je persoonlijkheidsprofiel wordt opgebouwd', 'Je AI-carrièrecoach wordt voorbereid'],
    strengthsNav: 'Sterke punten',
    explore: 'Hier wil ik dieper op ingaan',
    runnerUpHeading: 'runner-up',
    moveSuffix: 'ontdek waarom',
    welcomeEyebrow: 'JOUW CARRIÈREPROFIEL',
    reportEyebrow: 'JE VOLLEDIGE RAPPORT',
    aboutEyebrow: 'OVER JOU',
    runnersTitle: 'Runner-up carrières',
    pathsEyebrow: 'MEER PADEN OM TE OVERWEGEN',
    jobsCta: 'Open de vacaturezoeker',
    titles: [
      ['Stap 1 van 3', 'Een vragenlijst gebouwd voor carrièreswitches'],
      ['Stap 2 van 3', 'Je analyse, in een live AI-coachingsessie'],
      ['Stap 3 van 3', 'Uitkomsten en je chatfeedback, op één dashboard'],
    ],
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
// Finders run INSIDE the page and return one element (or null). They are
// passed as source text so the same finder can be re-run right before the
// click, after the cursor's travel, when the page may have moved.
const finders = {
  // Smallest visible element containing `needle` (case-insensitive), among
  // `tags`; `last` takes the last match in DOM order instead (the real
  // quick-reply row sits under the cut message, after any copies above).
  text: ({ needle, tags, last, nth }) => {
    const n = needle.toLowerCase();
    let hits = [...document.querySelectorAll(tags || 'button, a, label, span, p, h1, h2, h3, h4, strong, div')]
      .filter((el) => (el.textContent || '').toLowerCase().includes(n))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    if (nth !== undefined) return hits[nth] ?? null; // DOM order
    if (!last) hits = hits.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    return last ? hits[hits.length - 1] ?? null : hits[0] ?? null;
  },
  // The résumé step: the first section of the survey page.
  resumeStep: () => document.querySelector('main section'),
  // The n-th drag handle of the ranking question (0-based).
  grip: ({ index }) => document.querySelectorAll('button.cursor-grab')[index] ?? null,
  // The survey card that holds the given choice text.
  questionCard: ({ needle }) => {
    const n = needle.toLowerCase();
    const el = [...document.querySelectorAll('label, button, div, span')]
      .filter((e) => (e.textContent || '').toLowerCase().includes(n))
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    return el ? el.closest('section') : null;
  },
  // Option 1 of the coach's follow-up card: the numbered "1" row inside the
  // newest message (the sidebar's "1 Primary Career Match" is a button too).
  option1: () => {
    const wraps = document.querySelectorAll('[id^="demo-msg-"]');
    const last = wraps[wraps.length - 1];
    if (!last) return null;
    return [...last.querySelectorAll('button')].find((b) => /^\s*1\s/.test(b.innerText) && b.innerText.length > 20) ?? null;
  },
  // The first collapsed runner-up card header.
  collapsedCard: () => document.querySelector('[data-card-collapsed]'),
  // The last message of the transcript.
  lastMessage: () => {
    const all = document.querySelectorAll('[id^="demo-msg-"]');
    return all[all.length - 1] ?? null;
  },
  // The first big chart in view: the compare radar on the top career card.
  radar: () =>
    [...document.querySelectorAll('svg')].find((s) => {
      const r = s.getBoundingClientRect();
      return r.width > 180 && r.height > 180 && r.top > 0 && r.top < window.innerHeight;
    }) ?? null,
  // The n-th accordion row header after the "ABOUT YOU" eyebrow (0-based).
  aboutRow: ({ needle, index }) => {
    const n = needle.toLowerCase();
    const eyebrow = [...document.querySelectorAll('div, span, p')]
      .filter((e) => (e.textContent || '').toLowerCase().includes(n))
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    if (!eyebrow) return null;
    const after = [...document.querySelectorAll('button')].filter(
      (b) => eyebrow.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING && b.innerText.trim().length > 3,
    );
    return after[index] ?? null;
  },
};

async function rectOf(page, finder, arg) {
  return page.evaluate(
    ({ src, arg }) => {
      const el = new Function('return ' + src)()(arg);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + Math.min(r.width / 2, 260), y: r.top + Math.min(r.height / 2, 28), top: r.top, bottom: r.bottom };
    },
    { src: finder.toString(), arg },
  );
}
async function mustRect(page, finder, arg, label) {
  const r = await rectOf(page, finder, arg);
  if (!r) throw new Error(`not found on page: ${label}`);
  return r;
}

// Overlays drawn into the page: cursor, fades, processing interstitial.
// All live under one fixed root with pointer-events:none.
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
  await page.mouse.move(x, y);
};
const cursorPress = (page) =>
  page.evaluate(() => {
    const cur = document.getElementById('__cur');
    cur.style.transform = 'scale(.82)';
    setTimeout(() => (cur.style.transform = ''), 120);
  });
const fade = async (page, to) => {
  await page.evaluate((o) => (document.getElementById('__fade').style.opacity = String(o)), to);
  await sleep(300);
};

// Waits until the page has stopped scrolling.
async function settleScroll(page, max = 6000) {
  const t0 = Date.now();
  let last = -1;
  let stable = 0;
  while (Date.now() - t0 < max) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === last) {
      if (++stable >= 3) return;
    } else {
      stable = 0;
      last = y;
    }
    await sleep(100);
  }
}
// Bottom edge of any sticky/fixed nav at the top: the frame's usable top.
const navBottom = (page) =>
  page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll('nav')]
        .filter((n) => ['sticky', 'fixed'].includes(getComputedStyle(n).position) && n.getBoundingClientRect().top <= 1)
        .map((n) => n.getBoundingClientRect().bottom),
    ),
  );
// In-page eased scroll to an absolute Y over `ms` (Chrome's own smooth
// scroll is too short for a long "run through the chat").
async function glideTo(page, y, ms) {
  await page.evaluate(
    async ({ y, ms }) => {
      const from = window.scrollY;
      const t0 = performance.now();
      await new Promise((done) => {
        const step = () => {
          const p = Math.min(1, (performance.now() - t0) / ms);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          window.scrollTo(0, from + (y - from) * e);
          if (p < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    },
    { y, ms: ms * SLOW },
  );
}
// Scrolls so the element's top sits `pad` px under the nav. `ms` = glide
// time; 0 = instant (used before a scene is on film).
async function alignTop(page, finder, arg, pad, label, ms = 700) {
  await settleScroll(page);
  const r = await mustRect(page, finder, arg, label);
  const top = await navBottom(page);
  const y = await page.evaluate(() => window.scrollY);
  const target = Math.max(0, y + r.top - top - pad);
  if (ms === 0) await page.evaluate((t) => window.scrollTo(0, t), target);
  else await glideTo(page, target, ms);
  await settleScroll(page);
}

// Cursor travels to the element, presses, and the element is clicked
// (DOM click). Re-tries while the expected state stays away.
async function click(page, finder, arg, label, { reached = null, tries = 3 } = {}) {
  let last = { x: 0, y: 0 };
  for (let i = 0; i < tries; i++) {
    await settleScroll(page);
    const aim = await mustRect(page, finder, arg, label);
    await cursorTo(page, aim.x, aim.y);
    const box = await mustRect(page, finder, arg, label);
    last = box;
    if (Math.abs(box.y - aim.y) > 2) await cursorTo(page, box.x, box.y, 120);
    await cursorPress(page);
    await page.evaluate(
      ({ src, arg }) => {
        const el = new Function('return ' + src)()(arg);
        el.click();
      },
      { src: finder.toString(), arg },
    );
    if (!reached) return;
    for (let t = 0; t < 12; t++) {
      await sleep(250);
      if (await reached()) return;
    }
  }
  throw new Error(`state not reached: ${await explainMiss(page, label, last.x, last.y)}`);
}
async function explainMiss(page, label, x, y) {
  const under = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${(el.textContent || '').trim().slice(0, 40)}"` : 'nothing';
    },
    { x, y },
  );
  const shot = resolve(root, '.demo-capture', 'last-miss.jpg');
  await page.screenshot({ path: shot, type: 'jpeg', quality: 80, captureBeyondViewport: false });
  return `clicked ${label} at (${Math.round(x)}, ${Math.round(y)}); under the pointer: ${under}; screenshot: ${shot}`;
}
// Hover: cursor travels there, the real pointer follows, and a mouseover is
// dispatched too (React's onMouseEnter listens to mouseover).
async function hover(page, finder, arg, label) {
  await settleScroll(page);
  const r = await mustRect(page, finder, arg, label);
  await cursorTo(page, r.x, r.y, 600);
  await page.evaluate(
    ({ src, arg }) => {
      const el = new Function('return ' + src)()(arg);
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    },
    { src: finder.toString(), arg },
  );
}
// DOM click with no cursor travel: for set-up off screen (open a row before scrolling to it).
const tap = (page, finder, arg) =>
  page.evaluate(
    ({ src, arg }) => {
      const el = new Function('return ' + src)()(arg);
      if (!el) throw new Error('tap target missing');
      el.click();
    },
    { src: finder.toString(), arg },
  );
// Drag one element onto another with the real pointer (dnd-kit's
// PointerSensor needs a 6 px move before it picks the item up).
async function drag(page, fromFinder, fromArg, toFinder, toArg, label) {
  await settleScroll(page);
  const a = await mustRect(page, fromFinder, fromArg, label);
  const b = await mustRect(page, toFinder, toArg, label);
  await cursorTo(page, a.x, a.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await cursorPress(page);
  const steps = 18;
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    const e = 1 - Math.pow(1 - p, 2);
    const x = a.x + (b.x - a.x) * e;
    const y = a.y + (b.y - a.y) * e;
    await page.mouse.move(x, y);
    await page.evaluate(({ x, y }) => { const c = document.getElementById('__cur'); c.style.left = x + 'px'; c.style.top = y + 'px'; window.__recCursor = { x, y }; }, { x, y });
    await sleep(45 * SLOW);
  }
  await sleep(150);
  await page.mouse.up();
}
const rankingOrder = (page) =>
  page.evaluate(() => [...document.querySelectorAll('button.cursor-grab')].map((g) => (g.parentElement?.innerText || '').split('\n')[1] || '').filter(Boolean));
const messageCount = (page) => page.evaluate(() => document.querySelectorAll('[id^="demo-msg-"]').length);

// Survey beats are shown one per "page": every other section is hidden
// while the beat plays, so the frame reads as a single question.
const showOnly = (page, finder, arg) =>
  page.evaluate(
    ({ src, arg }) => {
      const keep = new Function('return ' + src)()(arg);
      document.querySelectorAll('main section').forEach((s) => {
        s.style.display = s === keep || (keep && keep.contains(s)) || (keep && s.contains(keep)) ? '' : 'none';
      });
    },
    { src: finder.toString(), arg },
  );
// A title card over a darkened frame at the start of each stage.
async function titleCard(page, [eyebrow, title]) {
  await page.evaluate(
    ({ eyebrow, title }) => {
      const el = document.createElement('div');
      el.id = '__title';
      el.style.cssText =
        'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
        'background:rgba(15,37,48,.86);color:#fff;text-align:center;padding:0 12%;opacity:0;transition:opacity 280ms ease';
      el.innerHTML =
        `<div style="font-size:13px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#D4A024">${eyebrow}</div>` +
        `<div style="font-size:44px;font-weight:700;line-height:1.15;letter-spacing:-.01em;max-width:22ch">${title}</div>`;
      document.getElementById('__rec').appendChild(el);
      requestAnimationFrame(() => (el.style.opacity = '1'));
    },
    { eyebrow, title },
  );
  await pause(1700);
  await page.evaluate(() => {
    const el = document.getElementById('__title');
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  });
  await sleep(340);
}
// Fade to black, change something, fade back: a cut without leaving the page.
async function cutWithin(page, change) {
  await fade(page, 1);
  await change();
  await sleep(150);
  await fade(page, 0);
}

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
    await pause(420);
  }
  await pause(200);
}

// ---------------------------------------------------------------------------
async function record({ persona, lang }) {
  const copy = COPY[lang];
  const name = `${persona}-${lang}`;
  const tmp = resolve(root, '.demo-capture', name);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  console.log(`\n▶ ${name}${DRAFT ? ' (draft)' : ''}`);

  const browser = CONNECT_PORT
    ? await puppeteer.connect({ browserURL: `http://127.0.0.1:${CONNECT_PORT}` })
    : await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
  await page.evaluateOnNewDocument((lang) => {
    window.__CAIRNLY_DEMO_CAPTURE__ = true;
    localStorage.setItem('cairnly_language', lang);
    localStorage.setItem('cairnly-cookie-consent', JSON.stringify({ choice: 'essential', timestamp: new Date().toISOString() }));
    localStorage.setItem('cairnly_language_suggestion_dismissed', new Date().toISOString());
    const style = document.createElement('style');
    // Hidden scaffolding leaves the pages short; the padding lets any anchor reach the top.
    style.textContent = '[data-demo-chrome]{display:none!important} body{padding-bottom:100vh!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  }, lang);

  // --- frames: Chrome's screencast, on while `recording` is true --------------
  const frames = [];
  const gaps = []; // wall-clock moments the film was paused (page swaps)
  let recording = false;
  let n = 0;
  const cdp = await page.createCDPSession();
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (!recording) return;
    const p = resolve(tmp, `f${String(n++).padStart(5, '0')}.jpg`);
    writeFileSync(p, Buffer.from(data, 'base64'));
    frames.push({ p, t: performance.now() });
  });
  const startFilm = async () => {
    recording = true;
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: DRAFT ? 70 : 90,
      maxWidth: W * SCALE,
      maxHeight: H * SCALE,
      everyNthFrame: DRAFT ? 3 : 1,
    });
  };
  const stopFilm = async () => {
    recording = false;
    gaps.push(performance.now());
    await cdp.send('Page.stopScreencast').catch(() => {});
  };
  const stills = [];
  const still = async (label) => {
    const p = resolve(tmp, `still-${label}.jpg`);
    await page.screenshot({ path: p, type: 'jpeg', quality: 90, captureBeyondViewport: false });
    stills.push({ p, label });
  };
  const goto = async (path) => {
    await page.goto(`${BASE}${path}?persona=${persona}&lang=${lang}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await installOverlay(page);
  };
  // Black on, cut, black off: page swaps are never on film.
  const cutTo = async (path, prepare) => {
    await fade(page, 1);
    await stopFilm();
    await goto(path);
    await prepare();
    await page.evaluate(() => (document.getElementById('__fade').style.opacity = '1'));
    await startFilm();
    await fade(page, 0);
  };

  // 1. Survey: résumé step → ranking (tap one, drag it up) → schedule + rider --
  await goto('/demo/survey');
  await sleep(1200); // fonts and the résumé step settle before we measure
  await showOnly(page, finders.resumeStep, null);
  await alignTop(page, finders.resumeStep, null, 40, 'résumé step', 0);
  await sleep(600);
  await alignTop(page, finders.resumeStep, null, 40, 'résumé step', 0);
  await startFilm();
  await titleCard(page, copy.titles[0]);
  await pause(1200);
  await still('01-resume');
  await click(page, finders.text, { needle: copy.resumeContinue, tags: 'button' }, 'continue to assessment');
  await pause(500);
  await cutWithin(page, async () => {
    await showOnly(page, finders.questionCard, { needle: copy.rankAdd });
    await alignTop(page, finders.questionCard, { needle: copy.rankAdd }, 40, 'ranking question', 0);
  });
  await pause(600);
  const before1 = (await rankingOrder(page)).length;
  await click(page, finders.text, { needle: copy.rankAdd, tags: 'button' }, 'tap to add', {
    reached: async () => (await rankingOrder(page)).length > before1,
  });
  await pause(900);
  // The item just added is last; drag it up into second place.
  const ranked = (await rankingOrder(page)).length;
  await drag(page, finders.grip, { index: ranked - 1 }, finders.grip, { index: 1 }, 'ranking drag');
  await pause(1100);
  await still('02-ranking');
  await cutWithin(page, async () => {
    await showOnly(page, finders.questionCard, { needle: copy.scheduleChoice });
    await alignTop(page, finders.questionCard, { needle: copy.scheduleChoice }, 40, 'schedule question', 0);
  });
  await pause(500);
  await click(page, finders.text, { needle: copy.scheduleChoice, tags: 'label, button, div, span' }, 'schedule choice');
  await pause(600);
  await click(page, finders.text, { needle: copy.nonNegotiable, tags: 'label' }, 'non-negotiable rider');
  await pause(1000);
  await still('03-survey');

  // 1b. "Analysing your answers", then the chat -------------------------------
  await processingInterstitial(page, copy.processing);
  await cutTo('/demo', async () => {
    await page.evaluate((n) => window.__cairnlyDemoReveal?.(n), STRENGTHS_REVEAL);
    await sleep(1200);
    if ((await messageCount(page)) !== STRENGTHS_REVEAL) throw new Error('replay did not cut at the Strengths delivery');
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  // 2. Chat: strengths → explore pill → option 1 → the answer -------------------
  await titleCard(page, copy.titles[1]);
  await click(page, finders.text, { needle: copy.strengthsNav, tags: 'button' }, 'sidebar: strengths');
  await pause(1100);
  await alignTop(page, finders.text, { needle: copy.explore, tags: 'button', last: true }, H - 280, 'explore pill');
  let before = await messageCount(page);
  await click(page, finders.text, { needle: copy.explore, tags: 'button', last: true }, 'explore pill', {
    reached: async () => (await messageCount(page)) > before,
  });
  await pause(900);
  // The option card is the newest message: bring it into frame, then straight to option 1.
  await alignTop(page, finders.option1, null, H - 420, 'option 1');
  await still('04-explore');
  before = await messageCount(page);
  await click(page, finders.option1, null, 'option 1', { reached: async () => (await messageCount(page)) > before });
  await pause(700);
  await alignTop(page, finders.lastMessage, null, 160, 'the answer', 800);
  await pause(1800);

  // 3. Straight to career 2's Move pill (the second visible one in the transcript)
  await page.evaluate(() => window.__cairnlyDemoReveal?.(10000)); // everything
  await sleep(1500);
  await alignTop(page, finders.text, { needle: copy.moveSuffix, tags: 'button', nth: 1 }, H - 340, 'career 2 move pill', 1100);
  await pause(500);
  await click(page, finders.text, { needle: copy.moveSuffix, tags: 'button', nth: 1 }, 'career 2 move pill');
  await pause(1000); // the replay scrolls to the feasibility question and rings it
  await still('05-move');

  // 4. A quick run through the rest of the chat, resting on its end -------------
  const end = await page.evaluate(() => {
    const all = document.querySelectorAll('[id^="demo-msg-"]');
    const r = all[all.length - 1].getBoundingClientRect();
    return window.scrollY + r.bottom - window.innerHeight + 24;
  });
  await glideTo(page, end, 4400);
  await pause(1500);
  await still('06-chat-end');

  // 5. Dashboard, four frames ------------------------------------------------------
  await cutTo('/demo/dashboard', async () => {
    await sleep(1200);
    await alignTop(page, finders.text, { needle: copy.welcomeEyebrow }, 50, 'welcome eyebrow', 0);
  });
  await titleCard(page, copy.titles[2]);
  await pause(500);
  // 5.1 the top card flips when the pointer reaches its radar
  await hover(page, finders.radar, null, 'compare radar');
  await pause(1700); // flip + one second of reading
  await still('07-flip');
  // 5.2 the full report, with the values section already open when it comes into frame
  await tap(page, finders.aboutRow, { needle: copy.aboutEyebrow, index: 4 });
  await sleep(400);
  await alignTop(page, finders.text, { needle: copy.reportEyebrow }, 30, 'report eyebrow', 1100);
  await pause(2000);
  await still('08-values');
  // 5.3 runner-up careers, opened
  // Shortest button match = the accordion row header (title + subtitle).
  await click(page, finders.text, { needle: copy.runnersTitle, tags: 'button' }, 'runner-up row');
  await pause(600);
  await alignTop(page, finders.text, { needle: copy.runnersTitle, tags: 'button' }, 30, 'runner-up row', 1100);
  await pause(2000);
  await still('09-runner-ups');
  // 5.4 back up to the paths and the toolkit, then the job search press
  await alignTop(page, finders.text, { needle: copy.pathsEyebrow }, 40, 'paths eyebrow', 1100);
  await pause(2000);
  await still('10-paths');
  await click(page, finders.text, { needle: copy.jobsCta, tags: 'a, button' }, 'open the job search');
  // 6. One second of the jobs page, then out --------------------------------------
  await stopFilm();
  for (let t = 0; t < 40; t++) {
    await sleep(250);
    if (await page.evaluate(() => location.pathname.includes('/demo/jobs') && !!document.querySelector('[data-career-tier]'))) break;
  }
  await sleep(800);
  await installOverlay(page);
  await alignTop(page, () => document.querySelector('[data-career-tier]'), null, 60, 'jobs: first career', 0);
  await page.evaluate(() => (document.getElementById('__fade').style.opacity = '1'));
  await startFilm();
  await fade(page, 0);
  await pause(1000);
  await still('11-jobs');
  await fade(page, 1);
  await pause(300);
  await stopFilm();
  await cdp.detach().catch(() => {});
  if (CONNECT_PORT) {
    await page.close();
    await browser.disconnect();
  } else await browser.close();

  // --- ffmpeg ---------------------------------------------------------------------
  if (frames.length < 10) throw new Error('too few frames');
  const t0 = frames[0].t;
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const start = (frames[i].t - t0) / 1000;
    const next = i + 1 < frames.length ? (frames[i + 1].t - t0) / 1000 : start + 0.4;
    // A hold produces no new frames, so a frame legitimately lasts seconds;
    // but the frame before a page swap would hold for the whole load, so it
    // is capped at 0.35 s.
    const hasGap = gaps.some((g) => g >= frames[i].t && (i + 1 >= frames.length || g <= frames[i + 1].t));
    const dur = Math.max(next - start, 0.01);
    lines.push(`file '${frames[i].p}'`, `duration ${(hasGap ? Math.min(0.35, dur) : dur).toFixed(4)}`);
  }
  lines.push(`file '${frames[frames.length - 1].p}'`);
  const list = resolve(tmp, 'frames.txt');
  writeFileSync(list, lines.join('\n') + '\n');

  const mp4 = resolve(videosDir, `demo-hero-${name}.mp4`);
  const webm = resolve(videosDir, `demo-hero-${name}.webm`);
  // crf 28 / 40: screen content compresses well and a hero video must stay a few MB.
  const common = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-an', '-fps_mode', 'cfr', '-r', String(FPS), // JPEG frames are full-range; browsers' VP9 decoders reject full-range video, so convert to limited range.
    '-vf', `scale=${W}:${H}:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p`, '-color_range', 'tv'];
  execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-crf', DRAFT ? '30' : '28', '-preset', DRAFT ? 'veryfast' : 'slow', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (!DRAFT) execFileSync('ffmpeg', [...common, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', webm], { stdio: 'inherit' });
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
