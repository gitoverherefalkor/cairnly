#!/usr/bin/env node
// Raise the output budget of WF1's personality-narrative model.
//
//   node scripts/apply-wf1-maxtokens-n8n.mjs --dry-run
//   node scripts/apply-wf1-maxtokens-n8n.mjs
//
// Why: claude-sonnet-5 runs adaptive thinking by default, and the thinking
// shares max_tokens with the visible text (see supabase/functions/intake-chat).
// "Anthropic Chat Model1" had no options set, so n8n's default of 4096 applied;
// on 2026-09-16 a run spent all 4096 tokens thinking and returned an empty
// narrative, which left the report without personality sections and crashed
// WF3 downstream. 16000 mirrors the value WF8 was raised to on 2026-09-03.
//
// Same guarantees as the other apply scripts: fetches LIVE state, asserts only
// the one intended node changes, backs up to n8n_wfs_cairnly/, PUTs, re-fetches
// and verifies, then refreshes the canonical export.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_DIR = resolve(ROOT, 'n8n_wfs_cairnly');
const BASE_URL = 'https://falkoratlas.app.n8n.cloud/api/v1';
const WF1_ID = '0Z8WxV5tVFMJqIZt';
const NODE = 'Anthropic Chat Model1';
const MAX_TOKENS = 16000;
const DRY_RUN = process.argv.includes('--dry-run');

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

const live = await api(`/workflows/${WF1_ID}`);
assert(live.active === true, `WF1 is not active (active=${live.active}); refusing to touch an unexpected state`);
const pre = JSON.parse(JSON.stringify(live));

const node = live.nodes.find((n) => n.name === NODE);
assert(node, `${NODE} not found`);
assert(/lmChatAnthropic/.test(node.type), `${NODE} is not an Anthropic model node (${node.type})`);
const before = JSON.stringify(node.parameters.options ?? {});
if ((node.parameters.options ?? {}).maxTokensToSample === MAX_TOKENS) {
  console.log(`${NODE}: already at maxTokensToSample=${MAX_TOKENS} - nothing to do.`);
  process.exit(0);
}
node.parameters.options = { ...(node.parameters.options ?? {}), maxTokensToSample: MAX_TOKENS };
console.log(`--- ${NODE} (model ${node.parameters.model?.value ?? node.parameters.model})\n- options: ${before}\n+ options: ${JSON.stringify(node.parameters.options)}`);

const changed = pre.nodes
  .filter((a) => JSON.stringify(a) !== JSON.stringify(live.nodes.find((b) => b.name === a.name)))
  .map((a) => a.name);
assert(changed.length === 1 && changed[0] === NODE, `diff mismatch: changed [${changed.join(', ')}]`);
assert(JSON.stringify(pre.connections) === JSON.stringify(live.connections), 'connections changed');

if (DRY_RUN) { console.log('\nDry run complete - nothing written.'); process.exit(0); }

writeFileSync(resolve(EXPORT_DIR, `WF1 - Profile Insert EN_NL_LIVE_BACKUP_pre_maxtokens_${stamp}.json`), JSON.stringify(pre, null, 2));
const settings = Object.fromEntries(Object.entries(pre.settings ?? {}).filter(([k]) => SETTINGS_WHITELIST.includes(k)));
await api(`/workflows/${WF1_ID}`, {
  method: 'PUT',
  body: JSON.stringify({ name: live.name, nodes: live.nodes, connections: live.connections, settings }),
});

const after = await api(`/workflows/${WF1_ID}`);
for (const n of live.nodes) {
  const b = after.nodes.find((x) => x.name === n.name);
  assert(b, `verify: node missing after PUT: ${n.name}`);
  assert(JSON.stringify(n.parameters) === JSON.stringify(b.parameters), `verify: parameters drifted on ${n.name}`);
}
assert(after.active === pre.active, 'verify: active flag changed');
writeFileSync(resolve(EXPORT_DIR, 'WF1 - Profile Insert EN_NL.json'), JSON.stringify(after, null, 2));
console.log(`\nWF1: APPLIED and verified (active=${after.active}). Canonical export refreshed.`);
