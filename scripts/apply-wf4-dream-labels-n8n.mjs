#!/usr/bin/env node
// Remove the survey question labels from the dream-job prompt's output template.
//
//   node scripts/apply-wf4-dream-labels-n8n.mjs --dry-run
//   node scripts/apply-wf4-dream-labels-n8n.mjs
//
// Why: the "Dream Job Feasibility" prompt bans question labels in its output
// (line ~29) and then hands the model a bullet template that literally contains
// "(2a)", "(2i)", "(2g)", "(5f)". The model copies them into the prose, the
// Dutch translation drops those meaningless tokens, and the translation gate
// (digit-run comparison) fails the section, which then falls back to English.
// Both fresh nl reports of 2026-09-17 lost their dream_jobs translation this way.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_DIR = resolve(ROOT, 'n8n_wfs_cairnly');
const BASE_URL = 'https://falkoratlas.app.n8n.cloud/api/v1';
const WF4_ID = 'seWmQPFQqIe60TkU';
const EXPORT_FILE = 'WF4 - Career selection NL_EN.json';
const NODE = 'Dream Job Feasibility';
const DRY_RUN = process.argv.includes('--dry-run');

const EDITS = [
  ['- [Bullet 1: Alignment with Social Energy (2a) and Stress Response (2i)]', '- [Bullet 1: Alignment with their social energy and stress response]'],
  ['- [Bullet 2: Alignment with Work Style (2g) and Deadline Approach (5f)]', '- [Bullet 2: Alignment with their work style and deadline approach]'],
];

const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8');
const API_KEY =
  process.env.N8N_API_KEY ??
  envFile.match(/^N8N_API_KEY=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!API_KEY) throw new Error('N8N_API_KEY not found in .env.local');

const die = (msg) => { throw new Error(msg); };
const assert = (cond, msg) => { if (!cond) die(`ASSERT FAILED: ${msg}`); };

async function api(path, opts = {}) {
  const r = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
  });
  if (!r.ok) die(`n8n API ${opts.method ?? 'GET'} ${path} -> ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

const SETTINGS_WHITELIST = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const live = await api(`/workflows/${WF4_ID}`);
assert(live.active === true, `WF4 is not active (active=${live.active}); refusing to touch an unexpected state`);
const pre = JSON.parse(JSON.stringify(live));
const node = live.nodes.find((n) => n.name === NODE);
assert(node && node.type === '@n8n/n8n-nodes-langchain.chainLlm', `${NODE} not found or not a chain node`);

let text = String(node.parameters.text);
const applied = [];
for (const [from, to] of EDITS) {
  if (text.includes(to)) { console.log(`already applied: ${to}`); continue; }
  assert(text.split(from).length === 2, `expected exactly one occurrence of: ${from}`);
  text = text.replace(from, to); applied.push(`- ${from}\n+ ${to}`);
}
assert(!/\(\d[a-n]\)/.test(text), 'a (Na) label is still present in the prompt after the edit');
if (applied.length === 0) { console.log(`${NODE}: nothing to do.`); process.exit(0); }
node.parameters.text = text;
console.log(`--- ${NODE}\n${applied.join('\n')}`);

const changed = pre.nodes.filter((a) => JSON.stringify(a) !== JSON.stringify(live.nodes.find((b) => b.name === a.name))).map((a) => a.name);
assert(changed.length === 1 && changed[0] === NODE, `diff mismatch: changed [${changed.join(', ')}]`);
assert(JSON.stringify(pre.connections) === JSON.stringify(live.connections), 'connections changed');
if (DRY_RUN) { console.log('\nDry run complete - nothing written.'); process.exit(0); }

writeFileSync(resolve(EXPORT_DIR, `${EXPORT_FILE.replace(/\.json$/, '')}_LIVE_BACKUP_pre_dreamlabels_${stamp}.json`), JSON.stringify(pre, null, 2));
const settings = Object.fromEntries(Object.entries(pre.settings ?? {}).filter(([k]) => SETTINGS_WHITELIST.includes(k)));
await api(`/workflows/${WF4_ID}`, { method: 'PUT', body: JSON.stringify({ name: live.name, nodes: live.nodes, connections: live.connections, settings }) });
const after = await api(`/workflows/${WF4_ID}`);
for (const n of live.nodes) { const b = after.nodes.find((x) => x.name === n.name); assert(b && JSON.stringify(n.parameters) === JSON.stringify(b.parameters), `verify: drift on ${n.name}`); }
assert(after.active === pre.active, 'verify: active flag changed');
writeFileSync(resolve(EXPORT_DIR, EXPORT_FILE), JSON.stringify(after, null, 2));
console.log(`\nWF4: APPLIED and verified (active=${after.active}). Canonical export refreshed.`);
