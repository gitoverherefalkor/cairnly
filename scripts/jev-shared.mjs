// Shared bits for the Jev measurement scripts (docs/jev-cairnly-ontwerp-2026-09-23.md, ch. 4).
// - loads .env.local itself, so no secret ever passes through the shell or a log line
// - one TypeSafe client: model pinned, retries on 429/529, hard cost ceiling
// Nothing here writes anywhere except the output directory the caller passes in.
import fs from 'node:fs';
import path from 'node:path';

export const JEV_MODEL = 'jev-1.13.0';
export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
// docs.typesafe.ai/models, read 2026-10-05: $0.042 per million input tokens, output free.
export const USD_PER_INPUT_TOKEN = 0.042 / 1_000_000;

// Parse KEY=VALUE lines from .env.local into process.env (does not override what is set).
export function loadEnvLocal(repoRoot = process.cwd()) {
  const file = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`STOP: ${name} is not set (expected in .env.local). Nothing was sent.`);
    process.exit(2);
  }
  return v;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cost guard. reserve() before a call with a projected token count, settle() after with the
// real count. A call that would push spent + in-flight reservations over the cap is refused,
// so the ceiling holds even with several requests in flight.
export class CostGuard {
  constructor(capUsd) {
    this.capUsd = capUsd;
    this.spentTokens = 0;
    this.reservedTokens = 0;
    this.tripped = false;
  }
  get spentUsd() { return this.spentTokens * USD_PER_INPUT_TOKEN; }
  reserve(tokens) {
    const projected = (this.spentTokens + this.reservedTokens + tokens) * USD_PER_INPUT_TOKEN;
    if (this.tripped || projected > this.capUsd) { this.tripped = true; return false; }
    this.reservedTokens += tokens;
    return true;
  }
  settle(reserved, actual) {
    this.reservedTokens -= reserved;
    this.spentTokens += actual;
    if (this.spentUsd > this.capUsd) this.tripped = true;
  }
}

// One Jev request. Returns { body, ms, status }. Throws on anything but 200 after retries.
export async function callJev(apiKey, { state, questions }, { retries = 4 } = {}) {
  let attempt = 0;
  for (;;) {
    const t0 = performance.now();
    const res = await fetch(JEV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
    });
    const ms = performance.now() - t0;
    const text = await res.text();
    if (res.status === 200) return { body: JSON.parse(text), ms, status: 200 };
    if ((res.status === 429 || res.status === 529) && attempt < retries) {
      attempt++;
      await sleep(500 * 2 ** attempt + Math.random() * 250);
      continue;
    }
    const err = new Error(`TypeSafe ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
}

export function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function writeJson(dir, name, data) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}
