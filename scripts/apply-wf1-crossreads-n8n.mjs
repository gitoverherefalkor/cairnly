#!/usr/bin/env node
// Add the "CROSS-READS" section to WF1's personality-narrative prompt.
//
//   node scripts/apply-wf1-crossreads-n8n.mjs --dry-run   # fetch + transform + assert + print, no writes
//   node scripts/apply-wf1-crossreads-n8n.mjs             # the same, then backup + PUT + verify + refresh export
//
// Why: the narrative prompt asks for "connections between answers" but names
// none, so the model reliably finds the same three (happiness x history, values
// x riders, conflict style) and misses others that hold up. This block lists the
// reads that survived a "would the candidate nod, or say 'that is not me'" pass,
// as hypotheses with mandatory doubt language and a per-report cap. The failure
// mode being designed against is a forced paragraph the reader rejects.
//
// Inserted before "# Content Requirements" in prompt_perso_prof1. Idempotent;
// same backup/assert/verify pattern as the other apply scripts.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_DIR = resolve(ROOT, 'n8n_wfs_cairnly');
const BASE_URL = 'https://falkoratlas.app.n8n.cloud/api/v1';
const WF1_ID = '0Z8WxV5tVFMJqIZt';
const NODE = 'prompt_perso_prof1';
const ANCHOR = '# Content Requirements';
const DRY_RUN = process.argv.includes('--dry-run');

const BLOCK = `# CROSS-READS: WHERE INSIGHT USUALLY HIDES

Two answers read together sometimes say what neither says alone. The reads below are the ones that tend to hold up. They are hypotheses to test against THIS candidate's data, not a checklist: use one only when both sides are explicit in their answers and the tension is real. Most reports will carry one or two; carrying none is fine. Never walk through the list and never name a question. At most two reads may lean on the feedback answer, and a report's Key Insights must not all trace back to one answer.

Around the feedback they keep hearing (and whether they agree with it):
- against the tendencies they flagged themselves: what both name is owned; what only others name may be a blind spot, or simply not top of mind; what only they name suggests they judge themselves harder than the people around them do. Say which, tentatively.
- against their own skills list: praise for a capability they never listed is often the real differentiator. Ignore praise about manner (calm, friendly, pleasant).
- against what they want to avoid in a next role: walking away from something others say they are good at can be a healthy choice. Name it so the choice is a conscious one.
- against "personal doubts or lack of confidence" as a barrier: consistent praise sitting next to that barrier deserves a gentle question, never a verdict.

Between answers they already gave:
- the reasons behind their lowest happiness scores, against a goal of escaping burnout or lack of fulfilment: if those reasons describe emptiness or lack of stretch rather than overload, ask whether the problem is exhaustion or boredom. The two need different next roles. Ask; never diagnose.
- "drained by interaction" next to "take charge in a team": someone who leads without being fuelled by people. Usually a case for small teams and recovery time, not for a "people person" role.
- wanting a manager who "delegates autonomy" while ticking "difficulty delegating", in someone who manages others: wanting for themselves what they find hard to give. Common, and concrete.
- "offers support and listens" next to "internalize stress without specific coping strategies": gives support, does not take it. Worth watching, said lightly.
- the fields they want to explore next, against the fields they know most about and have worked in: expertise they are leaving behind, or interest without a track record. Either way it shapes what a next step must include.

Any self-description contradicted by their own data (calls themselves decisive and ticks "being indecisive"; says they avoid conflict and argues with the feedback they were given) is a candidate regardless of this list.

VOICE FOR EVERY CROSS-READ: these are reads, not findings. Write each one so the candidate can reject it without losing trust in the rest of the report: "could it be that...", "one reading is...", "worth testing:", "if that is right, then...". Before keeping one, ask yourself: would they nod, or would they say "that is not me"? If the second is plausible, turn it into a question or cut it. A read that survives can carry a Key Insight; anything weaker is at most a clause inside another paragraph.
`;

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
const a = node.parameters.assignments.assignments[0];
if (a.value.includes('# CROSS-READS')) { console.log(`${NODE}: cross-reads block already present - nothing to do.`); process.exit(0); }
assert(a.value.split(ANCHOR).length === 2, `${NODE}: anchor "${ANCHOR}" must occur exactly once`);
a.value = a.value.replace(ANCHOR, `${BLOCK}\n${ANCHOR}`);
console.log(`--- ${NODE}: inserting ${BLOCK.split('\n').length} lines before "${ANCHOR}"\n${BLOCK}`);

const changed = pre.nodes
  .filter((x) => JSON.stringify(x) !== JSON.stringify(live.nodes.find((b) => b.name === x.name)))
  .map((x) => x.name);
assert(changed.length === 1 && changed[0] === NODE, `diff mismatch: changed [${changed.join(', ')}]`);
assert(JSON.stringify(pre.connections) === JSON.stringify(live.connections), 'connections changed');

if (DRY_RUN) { console.log('\nDry run complete - nothing written.'); process.exit(0); }

writeFileSync(resolve(EXPORT_DIR, `WF1 - Profile Insert EN_NL_LIVE_BACKUP_pre_crossreads_${stamp}.json`), JSON.stringify(pre, null, 2));
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
