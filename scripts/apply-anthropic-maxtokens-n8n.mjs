#!/usr/bin/env node
// Raise the output budget of claude-sonnet-5 model nodes that still run at n8n's
// default max_tokens (4096).
//
//   node scripts/apply-anthropic-maxtokens-n8n.mjs --wf=WF3 --dry-run
//   node scripts/apply-anthropic-maxtokens-n8n.mjs --wf=WF3
//   node scripts/apply-anthropic-maxtokens-n8n.mjs --wf=WF3,WF5,WF7,WF9,WF10
//
// Why: sonnet-5 runs adaptive thinking by default and the thinking shares
// max_tokens with the visible text (see supabase/functions/intake-chat). A node
// with `options: {}` sits at 4096; when the model thinks for the whole budget
// the chain returns an EMPTY string with no error, and everything downstream
// runs on nothing. WF1 (2026-09-16, exec 11014) and WF3 (2026-09-16, exec
// 11022, "Outside Of Box Analysis") both failed that way. 16000 mirrors WF8
// (2026-09-03) and WF1.
//
// One workflow at a time, each needing its own approval. Same guarantees as
// the other apply scripts: fetches LIVE state, asserts only the listed nodes
// change, backs up to n8n_wfs_cairnly/, PUTs, re-fetches and verifies, then
// refreshes the canonical export. Nodes already at the target are skipped.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_DIR = resolve(ROOT, 'n8n_wfs_cairnly');
const BASE_URL = 'https://falkoratlas.app.n8n.cloud/api/v1';
// --max=N overrides the target budget (default 16000). WF4 generates three long
// career narratives in one call and hit an 8000 cap on 2026-09-17 (exec 11111),
// so it gets 32000; thinking length swings 2x between identical inputs.
const MAX_TOKENS = Number(process.argv.find((a) => a.startsWith('--max='))?.slice(6) ?? 16000);
if (!Number.isInteger(MAX_TOKENS) || MAX_TOKENS < 4096 || MAX_TOKENS > 64000) { console.error(`--max must be an integer between 4096 and 64000, got ${MAX_TOKENS}`); process.exit(1); }
const DRY_RUN = process.argv.includes('--dry-run');

// Every claude-sonnet-5 node per workflow, and the canonical export file name.
const TARGETS = {
  WF1: { id: '0Z8WxV5tVFMJqIZt', file: 'WF1 - Profile Insert EN_NL.json', nodes: ['Anthropic Chat Model1'] },
  WF3: { id: 'zhgJuiDp60PS5ZKJ', file: 'WF3 - scoring careers NL_EN.json', nodes: ['Anthropic Chat Model'] },
  WF4: { id: 'seWmQPFQqIe60TkU', file: 'WF4 - Career selection NL_EN.json', nodes: ['Anthropic Chat Model', 'Anthropic Chat Model1', 'Anthropic Chat Model2'] },
  WF5: { id: 'h7ie9zN080IM2g7N', file: 'WF5 - Cairnly Coach.json', nodes: ['Anthropic Chat Model1'] },
  WF7: { id: 'ohNbCw7pVqvjCZHT', file: 'WF7 - ExecSummary NL_EN.json', nodes: ['Anthropic Chat Model'] },
  WF9: { id: 'IFhL4Lno0hyMJ1Jc', file: 'WF9 - Custom Resume.json', nodes: ['Anthropic Sonnet (Content)', 'Anthropic Sonnet (ATS)'] },
  WF10: { id: 'bL82tYqEne0gKNIa', file: 'WF10 - Resume Strengthen.json', nodes: ['Anthropic Sonnet (Analyze)', 'Anthropic Sonnet (Compose)'] },
};

const wfArg = process.argv.find((a) => a.startsWith('--wf='))?.slice(5);
if (!wfArg) { console.error(`usage: --wf=${Object.keys(TARGETS).join('|')}[,...] [--dry-run]`); process.exit(1); }
const selected = wfArg.split(',').map((s) => s.trim().toUpperCase());
for (const k of selected) if (!TARGETS[k]) { console.error(`unknown workflow key: ${k}`); process.exit(1); }

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
let anyFailed = false;

for (const key of selected) {
  const t = TARGETS[key];
  try {
    const live = await api(`/workflows/${t.id}`);
    assert(live.active === true, `${key} is not active (active=${live.active}); refusing to touch an unexpected state`);
    const pre = JSON.parse(JSON.stringify(live));

    const intended = [];
    for (const name of t.nodes) {
      const node = live.nodes.find((n) => n.name === name);
      assert(node, `${key}: node not found: ${name}`);
      assert(/lmChatAnthropic/.test(node.type), `${key}: ${name} is not an Anthropic model node (${node.type})`);
      const model = node.parameters.model?.value ?? node.parameters.model;
      assert(String(model).includes('sonnet-5'), `${key}: ${name} runs ${model}, not sonnet-5; refusing`);
      const before = JSON.stringify(node.parameters.options ?? {});
      if ((node.parameters.options ?? {}).maxTokensToSample === MAX_TOKENS) { console.log(`${key} ${name}: already ${MAX_TOKENS} - skipped`); continue; }
      node.parameters.options = { ...(node.parameters.options ?? {}), maxTokensToSample: MAX_TOKENS };
      console.log(`--- ${key} ${name} (v${node.typeVersion}, ${model})\n- options: ${before}\n+ options: ${JSON.stringify(node.parameters.options)}`);
      intended.push(name);
    }

    const changed = pre.nodes
      .filter((a) => JSON.stringify(a) !== JSON.stringify(live.nodes.find((b) => b.name === a.name)))
      .map((a) => a.name);
    assert(changed.every((n) => intended.includes(n)) && intended.every((n) => changed.includes(n)),
      `${key}: diff mismatch: changed [${changed.join(', ')}] vs intended [${intended.join(', ')}]`);
    assert(JSON.stringify(pre.connections) === JSON.stringify(live.connections), `${key}: connections changed`);

    if (intended.length === 0) { console.log(`${key}: nothing to do.`); continue; }
    if (DRY_RUN) { console.log(`${key}: would change [${intended.join(', ')}] (dry run)`); continue; }

    writeFileSync(resolve(EXPORT_DIR, `${t.file.replace(/\.json$/, '')}_LIVE_BACKUP_pre_maxtokens_${stamp}.json`), JSON.stringify(pre, null, 2));
    const settings = Object.fromEntries(Object.entries(pre.settings ?? {}).filter(([k]) => SETTINGS_WHITELIST.includes(k)));
    await api(`/workflows/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: live.name, nodes: live.nodes, connections: live.connections, settings }),
    });

    const after = await api(`/workflows/${t.id}`);
    for (const n of live.nodes) {
      const b = after.nodes.find((x) => x.name === n.name);
      assert(b, `${key} verify: node missing after PUT: ${n.name}`);
      assert(JSON.stringify(n.parameters) === JSON.stringify(b.parameters), `${key} verify: parameters drifted on ${n.name}`);
    }
    assert(after.active === pre.active, `${key} verify: active flag changed`);
    writeFileSync(resolve(EXPORT_DIR, t.file), JSON.stringify(after, null, 2));
    console.log(`${key}: APPLIED and verified (active=${after.active}). Canonical export refreshed.`);
  } catch (e) {
    anyFailed = true;
    console.error(`${key}: FAILED - ${e.message}`);
  }
}

console.log(DRY_RUN ? '\nDry run complete - nothing written.' : anyFailed ? '\nDONE WITH FAILURES - see above.' : '\nDone.');
process.exit(anyFailed ? 1 : 0);
