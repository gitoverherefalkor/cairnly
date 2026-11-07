#!/usr/bin/env node
// Browser driver for the Cairnly live test (cloud mode).
//
// One Chromium stays open for the whole run (so cookies, localStorage AND
// sessionStorage survive between steps, just like a real user's tab). Every
// other command connects to it over CDP, does one thing, prints what it saw
// and exits. The tester agent calls this from Bash, one step at a time.
//
//   node pw.mjs start <runDir>           launch the browser (detached)
//   node pw.mjs goto <url>               open a URL in the current tab
//   node pw.mjs look [name]              screenshot + visible text + clickable elements
//   node pw.mjs click <selector>         click (Playwright selector, see below)
//   node pw.mjs fill <selector> <text>   clear a field and type text
//   node pw.mjs type <text>              type into the focused element
//   node pw.mjs press <key>              e.g. Enter, Tab
//   node pw.mjs upload <selector> <file> set a file input (CV upload)
//   node pw.mjs select <selector> <val>  choose an <option>
//   node pw.mjs scroll [px]              scroll down (negative = up)
//   node pw.mjs wait <seconds>           wait (max 600), then print the URL
//   node pw.mjs waitfor <text> [secs]    wait until text appears on the page
//   node pw.mjs downloads                list files downloaded so far
//   node pw.mjs stop                     close the browser
//
// Selectors are Playwright selectors, e.g.
//   'role=button[name="Next"]'   'text=Sign up'   'input[type=email]'
// `look` lists every clickable element as a ready-to-use role selector.

import { createRequire } from 'node:module';
// require() finds the pre-installed global Playwright; ESM import does not.
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PORT = 9333;
const STATE = '/tmp/cairnly-live-test-pw.json';
const [, , cmd, ...args] = process.argv;

const state = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null);

async function serve(runDir) {
  const ctx = await chromium.launchPersistentContext(join(runDir, 'profile'), {
    headless: true,
    viewport: { width: 1366, height: 900 },
    acceptDownloads: true,
    downloadsPath: join(runDir, 'downloads'),
    args: [`--remote-debugging-port=${PORT}`],
  });
  // Save every download with its real file name so the tester can open it.
  const hook = (page) =>
    page.on('download', async (d) => {
      const out = join(runDir, 'downloads', d.suggestedFilename());
      await d.saveAs(out).catch(() => {});
    });
  ctx.pages().forEach(hook);
  ctx.on('page', hook);
  if (ctx.pages().length === 0) await ctx.newPage();
  await new Promise(() => {}); // stay alive until `stop`
}

async function connect() {
  const s = state();
  if (!s) throw new Error('Browser not started. Run: node pw.mjs start <runDir>');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages().at(-1);
  page.setDefaultTimeout(20_000);
  return { s, page };
}

async function look(page, runDir, name) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const dir = join(runDir, 'screenshots');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${Date.now()}-${(name || 'look').replace(/[^\w-]/g, '_')}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const text = (await page.innerText('body').catch(() => '')).replace(/\n{3,}/g, '\n\n');
  const els = await page.evaluate(() => {
    const out = [];
    const q = 'a,button,input,textarea,select,[role=button],[role=link],[role=checkbox],[role=radio],[role=option],[role=tab],[role=slider],[contenteditable=true]';
    for (const el of document.querySelectorAll(q)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role') ||
        (tag === 'a' ? 'link' : tag === 'button' ? 'button' : tag === 'select' ? 'combobox' :
         tag === 'textarea' ? 'textbox' : tag === 'input' ?
           ({ checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button', file: 'file', range: 'slider' }[el.type] || 'textbox') : tag);
      const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder ||
        el.getAttribute('name') || el.id || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      const extra = tag === 'input' || tag === 'textarea'
        ? ` [${el.type || 'text'}${el.checked ? ', checked' : ''}${el.disabled ? ', disabled' : ''}]`
        : el.disabled || el.getAttribute('aria-disabled') === 'true' ? ' [disabled]' : '';
      out.push(`${role} "${label}"${extra}`);
    }
    return out;
  });
  console.log(`URL: ${page.url()}\nSCREENSHOT: ${file}\n\n--- VISIBLE TEXT ---\n${text.slice(0, 6000)}`);
  console.log(`\n--- CLICKABLE (use as role=<role>[name="<label>"]) ---\n${els.slice(0, 120).join('\n')}`);
}

async function main() {
  if (cmd === 'serve') return serve(args[0]);

  if (cmd === 'start') {
    const runDir = resolve(args[0] || '.');
    mkdirSync(join(runDir, 'downloads'), { recursive: true });
    const child = spawn(process.execPath, [new URL(import.meta.url).pathname, 'serve', runDir], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    writeFileSync(STATE, JSON.stringify({ runDir, pid: child.pid }));
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        await fetch(`http://127.0.0.1:${PORT}/json/version`);
        console.log(`Browser running (pid ${child.pid}), run dir ${runDir}`);
        return;
      } catch {}
    }
    throw new Error('Browser did not start');
  }

  if (cmd === 'stop') {
    const s = state();
    if (s) try { process.kill(s.pid); } catch {}
    console.log('Browser stopped');
    return;
  }

  const { s, page } = await connect();
  switch (cmd) {
    case 'goto':
      await page.goto(args[0], { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      return look(page, s.runDir, 'goto');
    case 'look':
      return look(page, s.runDir, args[0]);
    case 'click':
      await page.locator(args[0]).first().click();
      await page.waitForTimeout(1200);
      return look(page, s.runDir, 'click');
    case 'fill':
      await page.locator(args[0]).first().fill(args.slice(1).join(' '));
      console.log('filled');
      return;
    case 'type':
      await page.keyboard.type(args.join(' '), { delay: 15 });
      console.log('typed');
      return;
    case 'press':
      await page.keyboard.press(args[0]);
      await page.waitForTimeout(1000);
      return look(page, s.runDir, 'press');
    case 'upload':
      await page.locator(args[0]).first().setInputFiles(args[1]);
      await page.waitForTimeout(2000);
      return look(page, s.runDir, 'upload');
    case 'select':
      await page.locator(args[0]).first().selectOption(args[1]);
      console.log('selected');
      return;
    case 'scroll':
      await page.mouse.wheel(0, Number(args[0] || 700));
      await page.waitForTimeout(600);
      return look(page, s.runDir, 'scroll');
    case 'wait':
      await page.waitForTimeout(Math.min(600, Number(args[0] || 5)) * 1000);
      console.log(`URL: ${page.url()}`);
      return;
    case 'waitfor':
      await page.getByText(args[0], { exact: false }).first()
        .waitFor({ timeout: Math.min(600, Number(args[1] || 60)) * 1000 });
      return look(page, s.runDir, 'waitfor');
    case 'downloads':
      console.log(readdirSync(join(s.runDir, 'downloads')).join('\n') || '(none)');
      return;
    default:
      console.log('Unknown command. See the header of pw.mjs.');
  }
}

main()
  .then(() => { if (cmd !== 'serve') process.exit(0); })
  .catch((e) => { console.error(`ERROR: ${e.message.split('\n')[0]}`); process.exit(1); });
