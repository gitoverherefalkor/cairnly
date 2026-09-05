// Captures the candidate landing page (/p/:slug) of the specimen partner, for
// the "this is where your candidate starts" block on /partners. One file per
// language. Re-run after a redesign of PartnerLanding or a new specimen logo.
//
//   node scripts/partner-capture-still.mjs                      # live site, nl + en
//   node scripts/partner-capture-still.mjs --base=http://localhost:8081 nl
//
// Needs Google Chrome and ffmpeg (brew). The specimen partner is `voorbeeld`
// ("Loopbaanbureau Voorbeeld"), the same bureau whose logo is on the sample
// PDF, so the two proofs on /partners show one and the same partner.
//
// ⚠️ Deliberately NOT puppeteer. Launching Chrome as a child of the Claude
// desktop app made macOS revoke the app's access to ~/Documents, twice, on
// 2026-09-05 (demo-capture-stills.mjs has the same hazard when run from
// there; from a normal Terminal both are fine). Chrome is started through
// `open` instead, so LaunchServices owns the process, and the shot lands in
// a temp dir before being cropped into the repo.
//
// The cookie banner is fixed to the bottom of the viewport and cannot be
// dismissed without a profile; the window is shot taller than the still and
// the top 1200x1000 (CSS px) is kept, which is everything above the banner.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = 'public/images/live/partners';
const SLUG = 'voorbeeld';
// The code never renders on the page (only the URL carries it) but its
// presence flips the hint to "your code is already filled in", which is the
// state a real candidate sees.
const CODE = 'VBLD-DEMO-CODE-2026';
const SCALE = 1.5; // 1200x1000 CSS px -> 1800x1500 file
const STILL = { width: 1200, height: 1000 };
const WINDOW = { width: 1200, height: 1180 }; // extra rows hold the cookie banner

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith('--base='))?.slice(7) || 'https://www.cairnly.io').replace(/\/$/, '');
const langs = args.filter((a) => !a.startsWith('--'));
const wanted = langs.length ? langs : ['nl', 'en'];

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'partner-still-'));

for (const lang of wanted) {
  const raw = join(tmp, `raw-${lang}.png`);
  const url = `${base}/p/${SLUG}?code=${CODE}&lang=${lang}`;
  spawnSync('open', [
    '-na', 'Google Chrome', '--args',
    '--headless=new', '--no-first-run', '--hide-scrollbars',
    `--user-data-dir=${join(tmp, `profile-${lang}`)}`,
    `--window-size=${WINDOW.width},${WINDOW.height}`,
    `--force-device-scale-factor=${SCALE}`,
    '--virtual-time-budget=12000',
    `--screenshot=${raw}`,
    url,
  ], { stdio: 'inherit' });
  // `open` returns immediately; wait for Chrome to write the file.
  const deadline = Date.now() + 60_000;
  while (!(existsSync(raw) && statSync(raw).size > 0) && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (!existsSync(raw)) throw new Error(`Chrome wrote no screenshot for ${lang}`);
  // Chrome keeps writing for a moment after the file appears.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);

  const file = `${OUT}/candidate-start-${lang}.jpg`;
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', raw,
    '-vf', `crop=${STILL.width * SCALE}:${STILL.height * SCALE}:0:0`,
    '-q:v', '3', file,
  ]);
  console.log('wrote', file);
}
