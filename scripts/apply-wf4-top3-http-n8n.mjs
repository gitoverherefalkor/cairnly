#!/usr/bin/env node
// Replace WF4's "Top 3 Careers Generator" LangChain chain (+ its Anthropic
// sub-node) with a direct HTTP call to the Messages API, so the request can
// carry `output_config.effort` and a max_tokens guard.
//
//   node scripts/apply-wf4-top3-http-n8n.mjs --dry-run [--effort=medium]
//   node scripts/apply-wf4-top3-http-n8n.mjs [--effort=medium]
//
// Why: claude-sonnet-5 thinks adaptively inside max_tokens and the Top-3 call
// (three career narratives from a ~28k-token prompt) used the ENTIRE budget on
// every run of 2026-09-17: 8000 (exec 11111), then 20000 three times (11137,
// 11146, 11147). Two of those "succeeded" only because the cut fell after the
// third separator; Marcel's report b15e861d has a 1,057-character career 3
// with no fit scores. 21,333 is the most a non-streaming call may request, so
// the budget cannot be raised further; the LangChain node cannot set effort;
// an HTTP Request node can. Effort medium/low cuts thinking 2-4x (measured
// with the exact prompt of exec 11146 before this script was run).
//
// Wiring after: T3 Careers Prompt -> Top 3 Careers HTTP -> Top 3 Careers Text
// -> Split Top3. The Text node throws on stop_reason "max_tokens" so a
// truncated answer fails the run instead of silently shipping two and a half
// careers. Same guarantees as the other apply scripts: live fetch, exact
// node/connection diff assert, backup, PUT, verify, refreshed export.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_DIR = resolve(ROOT, 'n8n_wfs_cairnly');
const BASE_URL = 'https://falkoratlas.app.n8n.cloud/api/v1';
const WF4_ID = 'seWmQPFQqIe60TkU';
const EXPORT_FILE = 'WF4 - Career selection NL_EN.json';
const DRY_RUN = process.argv.includes('--dry-run');
const EFFORT = process.argv.find((a) => a.startsWith('--effort='))?.slice(9) ?? 'medium';
if (!['low', 'medium', 'high'].includes(EFFORT)) { console.error(`--effort must be low|medium|high, got ${EFFORT}`); process.exit(1); }

const PROMPT_NODE = 'T3 Careers Prompt';
const CHAIN_NODE = 'Top 3 Careers Generator';
const MODEL_NODE = 'Anthropic Chat Model';
const SPLIT_NODE = 'Split Top3';
const HTTP_NODE = 'Top 3 Careers HTTP';
const TEXT_NODE = 'Top 3 Careers Text';
const MAX_TOKENS = 20000;

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
const byName = (name) => live.nodes.find((n) => n.name === name);

if (byName(HTTP_NODE)) {
  const existing = byName(HTTP_NODE);
  const already = String(existing.parameters.jsonBody ?? '').includes(`effort: "${EFFORT}"`);
  console.log(`${HTTP_NODE} already present${already ? ` at effort ${EFFORT}` : ''} - nothing to do.`);
  process.exit(0);
}

const chain = byName(CHAIN_NODE); const model = byName(MODEL_NODE); const prompt = byName(PROMPT_NODE); const split = byName(SPLIT_NODE);
assert(chain && model && prompt && split, 'expected WF4 nodes not found');
assert(chain.type === '@n8n/n8n-nodes-langchain.chainLlm', `${CHAIN_NODE} is ${chain.type}`);
assert(/lmChatAnthropic/.test(model.type), `${MODEL_NODE} is ${model.type}`);
assert(chain.parameters.text === '={{ $json.top_3_careers_prompt }}', `${CHAIN_NODE} prompt expression changed: ${chain.parameters.text}`);
const cred = model.credentials?.anthropicApi;
assert(cred?.id, `${MODEL_NODE} has no anthropicApi credential to reuse`);
const c = live.connections;
assert(JSON.stringify(c[PROMPT_NODE]?.main) === JSON.stringify([[{ node: CHAIN_NODE, type: 'main', index: 0 }]]), `${PROMPT_NODE} must feed only ${CHAIN_NODE}`);
assert(JSON.stringify(c[CHAIN_NODE]?.main) === JSON.stringify([[{ node: SPLIT_NODE, type: 'main', index: 0 }]]), `${CHAIN_NODE} must feed only ${SPLIT_NODE}`);
assert(JSON.stringify(c[MODEL_NODE]?.ai_languageModel) === JSON.stringify([[{ node: CHAIN_NODE, type: 'ai_languageModel', index: 0 }]]), `${MODEL_NODE} must feed only ${CHAIN_NODE}`);

const [x, y] = chain.position;
const httpNode = {
  parameters: {
    method: 'POST',
    url: 'https://api.anthropic.com/v1/messages',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'anthropicApi',
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ model: "claude-sonnet-5", max_tokens: ${MAX_TOKENS}, thinking: { type: "adaptive" }, output_config: { effort: "${EFFORT}" }, messages: [{ role: "user", content: $json.top_3_careers_prompt }] }) }}`,
    options: { timeout: 600000 },
  },
  id: crypto.randomUUID(),
  name: HTTP_NODE,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [x, y],
  credentials: { anthropicApi: { id: cred.id, name: cred.name } },
};
const textNode = {
  parameters: {
    jsCode: [
      '// Hand the Messages API answer to Split Top3 in the shape the LangChain chain produced ({ text }).',
      '// A truncated answer (stop_reason max_tokens) fails the run here instead of shipping a partial career.',
      'const r = $input.first().json;',
      "if (r.stop_reason === 'max_tokens') throw new Error(`Top 3 generation hit max_tokens (${r.usage?.output_tokens} output tokens); raise effort or split the call`);",
      "const text = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');",
      "if (!text.trim()) throw new Error(`Top 3 generation returned no text (stop_reason ${r.stop_reason})`);",
      'return [{ json: { text, stop_reason: r.stop_reason, usage: r.usage } }];',
    ].join('\n'),
  },
  id: crypto.randomUUID(),
  name: TEXT_NODE,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [x + 260, y],
};

live.nodes = live.nodes.filter((n) => n.name !== CHAIN_NODE && n.name !== MODEL_NODE).concat([httpNode, textNode]);
delete c[CHAIN_NODE]; delete c[MODEL_NODE];
c[PROMPT_NODE] = { main: [[{ node: HTTP_NODE, type: 'main', index: 0 }]] };
c[HTTP_NODE] = { main: [[{ node: TEXT_NODE, type: 'main', index: 0 }]] };
c[TEXT_NODE] = { main: [[{ node: SPLIT_NODE, type: 'main', index: 0 }]] };

// exact-diff assert: two nodes removed, two added, nothing else touched
const preNames = new Set(pre.nodes.map((n) => n.name)), postNames = new Set(live.nodes.map((n) => n.name));
const removed = [...preNames].filter((n) => !postNames.has(n)), added = [...postNames].filter((n) => !preNames.has(n));
assert(removed.sort().join() === [CHAIN_NODE, MODEL_NODE].sort().join(), `removed ${removed}`);
assert(added.sort().join() === [HTTP_NODE, TEXT_NODE].sort().join(), `added ${added}`);
for (const n of pre.nodes) if (postNames.has(n.name)) assert(JSON.stringify(n) === JSON.stringify(byName(n.name)), `untouched node changed: ${n.name}`);
const connDiff = Object.keys({ ...pre.connections, ...c }).filter((k) => JSON.stringify(pre.connections[k]) !== JSON.stringify(c[k]));
assert(connDiff.sort().join() === [PROMPT_NODE, CHAIN_NODE, MODEL_NODE, HTTP_NODE, TEXT_NODE].sort().join(), `connection diff: ${connDiff}`);

console.log(`WF4: remove [${removed.join(', ')}], add [${added.join(', ')}], rewire ${PROMPT_NODE} -> ${HTTP_NODE} -> ${TEXT_NODE} -> ${SPLIT_NODE}`);
console.log(`     effort=${EFFORT}, max_tokens=${MAX_TOKENS}, credential=${cred.name} (${cred.id})`);
if (DRY_RUN) { console.log('\nDry run complete - nothing written.'); process.exit(0); }

writeFileSync(resolve(EXPORT_DIR, `${EXPORT_FILE.replace(/\.json$/, '')}_LIVE_BACKUP_pre_top3http_${stamp}.json`), JSON.stringify(pre, null, 2));
const settings = Object.fromEntries(Object.entries(pre.settings ?? {}).filter(([k]) => SETTINGS_WHITELIST.includes(k)));
await api(`/workflows/${WF4_ID}`, { method: 'PUT', body: JSON.stringify({ name: live.name, nodes: live.nodes, connections: c, settings }) });

const after = await api(`/workflows/${WF4_ID}`);
for (const n of live.nodes) {
  const b = after.nodes.find((x) => x.name === n.name);
  assert(b, `verify: node missing after PUT: ${n.name}`);
  assert(JSON.stringify(n.parameters) === JSON.stringify(b.parameters), `verify: parameters drifted on ${n.name}`);
}
assert(!after.nodes.some((n) => n.name === CHAIN_NODE || n.name === MODEL_NODE), 'verify: old nodes still present');
assert(after.active === pre.active, 'verify: active flag changed');
writeFileSync(resolve(EXPORT_DIR, EXPORT_FILE), JSON.stringify(after, null, 2));
console.log(`\nWF4: APPLIED and verified (active=${after.active}). Canonical export refreshed.`);
