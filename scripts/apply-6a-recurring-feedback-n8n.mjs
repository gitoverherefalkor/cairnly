#!/usr/bin/env node
// Apply the "6a -> recurring feedback" edit to the live WF1 (Profile Insert).
// Pairs with supabase/migrations/20260916160000_replace_6a_with_recurring_feedback.sql;
// the two must land together (see the sequencing note in that file).
//
//   node scripts/apply-6a-recurring-feedback-n8n.mjs --dry-run        # fetch + transform + assert + print diff, no writes
//   node scripts/apply-6a-recurring-feedback-n8n.mjs                  # the same, then backup + PUT + verify + refresh export
//   node scripts/apply-6a-recurring-feedback-n8n.mjs --also-fix-4g    # additionally repair the stale "Avoided industries (4g)"
//                                                                    # line in the fact-sheet prompt (4g is the help/advice
//                                                                    # question since July 2026, not an industry list)
//
// Self-contained and idempotent: fetches WF1's LIVE state, derives the new state
// from exact-anchor substitutions (never from a snapshot), asserts that ONLY the
// three intended nodes change, uploads, re-fetches and verifies. Reads
// N8N_API_KEY from .env.local. The pre-state is saved to n8n_wfs_cairnly/ before
// the PUT, and the canonical export is refreshed afterwards.
//
// What it changes:
//   Process Survey Data1   the "6a" schema entry: multiple_choice -> long_text, options: []
//   prompt_init_summary1   "Handling Feedback (6a)" -> recurring feedback, verbatim
//   prompt_perso_prof1     one bullet in the PRIME DIRECTIVE list + one in Content Requirements
//                          telling the coach to use the answer as its contrast source

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT_DIR = resolve(ROOT, 'n8n_wfs_cairnly');
const BASE_URL = 'https://falkoratlas.app.n8n.cloud/api/v1';
const WF1_ID = '0Z8WxV5tVFMJqIZt';
const DRY_RUN = process.argv.includes('--dry-run');
const FIX_4G = process.argv.includes('--also-fix-4g');

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

// ── the edits ──

const UUID_6A = '66666666-6666-6666-6666-666666666661';
const NEW_6A_ENTRY =
  `"6a": { uuid: "${UUID_6A}", question: "What feedback have you heard more than once in your career, from managers, colleagues or clients?", type: "long_text", options: [], description: "Recurring feedback from managers, colleagues or clients, including critical points, and whether the candidate agrees with it." },`;

const OLD_EI_LINE =
  '- **EI & Feedback:** [Handling Feedback (6a), Providing Feedback (6b), Support style (6c), Emotional regulation (6d), Stress coping (6e), EI Challenges (6g)]';
const NEW_EI_LINE =
  '- **EI & Feedback:** [Recurring feedback from others and whether the candidate agrees with it (6a, verbatim), Providing Feedback (6b), Support style (6c), Emotional regulation (6d), Stress coping (6e), EI Challenges (6g)]';

const OLD_AVOID_LINE = '- **Avoidance List (Hard Constraints):** [Avoided work aspects (3h), Avoided industries (4g)]';
const NEW_AVOID_LINES =
  '- **What others come to them for:** [4g, verbatim]\n' +
  '- **Avoidance List (Hard Constraints):** [Avoided work aspects (3h)]';

const ANCHOR_DIRECTIVE = '- what their combination of traits implies that no single answer says';
const NEW_DIRECTIVE_BULLET =
  '- gaps between how they describe themselves and the feedback other people keep giving them, and whether they accept that feedback';

const ANCHOR_CONTENT =
  '- Ground every trait or tendency you mention in this candidate\'s actual data. Do not infer or import tendencies that are not supported (for example, do not assume perfectionism from procrastination).';
const NEW_CONTENT_BULLET =
  '- The recurring-feedback answer (what managers, colleagues or clients keep telling them, and whether they agree) is your primary contrast source. Read every self-described trait against it: where the two diverge, that divergence is a Key Insight candidate; where they match, treat the trait as corroborated and spend fewer words on it. Never list the feedback back to them.';

const assignmentValue = (node) => node.parameters.assignments.assignments[0];

function transform(wf) {
  const intended = new Set();

  // 1. Process Survey Data1: rewrite the 6a schema line
  const code = wf.nodes.find((n) => n.name === 'Process Survey Data1');
  assert(code, 'Process Survey Data1 not found');
  const lines = code.parameters.jsCode.split('\n');
  const i = lines.findIndex((l) => /^\s*"6a":\s*\{/.test(l));
  assert(i >= 0, '6a schema line not found');
  assert(lines[i].includes(UUID_6A), '6a schema line has an unexpected uuid');
  if (lines[i].includes('type: "long_text"')) {
    console.log('Process Survey Data1: 6a already long_text - skipped');
  } else {
    assert(lines[i].includes('type: "multiple_choice"'), '6a schema line is neither multiple_choice nor long_text');
    const indent = lines[i].match(/^\s*/)[0];
    console.log(`\n--- Process Survey Data1 (jsCode line ${i + 1})\n- ${lines[i].trim()}\n+ ${NEW_6A_ENTRY}`);
    lines[i] = indent + NEW_6A_ENTRY;
    code.parameters.jsCode = lines.join('\n');
    intended.add(code.name);
  }

  // 2. prompt_init_summary1: fact-sheet line for 6a (+ optional 4g repair)
  const init = wf.nodes.find((n) => n.name === 'prompt_init_summary1');
  assert(init, 'prompt_init_summary1 not found');
  const initA = assignmentValue(init);
  if (initA.value.includes(NEW_EI_LINE)) {
    console.log('prompt_init_summary1: 6a line already updated - skipped');
  } else {
    assert(initA.value.includes(OLD_EI_LINE), 'prompt_init_summary1: expected EI & Feedback line not found');
    console.log(`\n--- prompt_init_summary1\n- ${OLD_EI_LINE}\n+ ${NEW_EI_LINE}`);
    initA.value = initA.value.replace(OLD_EI_LINE, NEW_EI_LINE);
    intended.add(init.name);
  }
  if (FIX_4G) {
    if (initA.value.includes(NEW_AVOID_LINES)) {
      console.log('prompt_init_summary1: 4g line already repaired - skipped');
    } else {
      assert(initA.value.includes(OLD_AVOID_LINE), 'prompt_init_summary1: expected Avoidance List line not found');
      console.log(`\n--- prompt_init_summary1 (--also-fix-4g)\n- ${OLD_AVOID_LINE}\n+ ${NEW_AVOID_LINES.replace('\n', '\n+ ')}`);
      initA.value = initA.value.replace(OLD_AVOID_LINE, NEW_AVOID_LINES);
      intended.add(init.name);
    }
  }

  // 3. prompt_perso_prof1: two inserted bullets
  const perso = wf.nodes.find((n) => n.name === 'prompt_perso_prof1');
  assert(perso, 'prompt_perso_prof1 not found');
  const persoA = assignmentValue(perso);
  if (persoA.value.includes(NEW_CONTENT_BULLET)) {
    console.log('prompt_perso_prof1: bullets already present - skipped');
  } else {
    assert(persoA.value.includes(ANCHOR_DIRECTIVE), 'prompt_perso_prof1: PRIME DIRECTIVE anchor not found');
    assert(persoA.value.includes(ANCHOR_CONTENT), 'prompt_perso_prof1: Content Requirements anchor not found');
    console.log(`\n--- prompt_perso_prof1 (after "${ANCHOR_DIRECTIVE}")\n+ ${NEW_DIRECTIVE_BULLET}`);
    console.log(`\n--- prompt_perso_prof1 (after "${ANCHOR_CONTENT.slice(0, 60)}...")\n+ ${NEW_CONTENT_BULLET}`);
    persoA.value = persoA.value
      .replace(ANCHOR_DIRECTIVE, `${ANCHOR_DIRECTIVE}\n${NEW_DIRECTIVE_BULLET}`)
      .replace(ANCHOR_CONTENT, `${ANCHOR_CONTENT}\n${NEW_CONTENT_BULLET}`);
    intended.add(perso.name);
  }

  return intended;
}

// ── driver ──

const SETTINGS_WHITELIST = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const live = await api(`/workflows/${WF1_ID}`);
assert(live.active === true, `WF1 is not active (active=${live.active}); refusing to touch an unexpected state`);
const pre = JSON.parse(JSON.stringify(live));
const intended = transform(live);

const changed = pre.nodes
  .filter((a) => JSON.stringify(a) !== JSON.stringify(live.nodes.find((b) => b.name === a.name)))
  .map((a) => a.name);
assert(live.nodes.length === pre.nodes.length, 'node count changed');
assert(changed.every((n) => intended.has(n)) && [...intended].every((n) => changed.includes(n)),
  `diff mismatch: changed [${changed.join(', ')}] vs intended [${[...intended].join(', ')}]`);
assert(JSON.stringify(pre.connections) === JSON.stringify(live.connections), 'connections changed');

if (intended.size === 0) { console.log('\nNothing to do - WF1 already migrated.'); process.exit(0); }
console.log(`\nWF1: will change [${changed.join(', ')}]`);
if (DRY_RUN) { console.log('\nDry run complete - nothing written.'); process.exit(0); }

writeFileSync(resolve(EXPORT_DIR, `WF1 - Profile Insert EN_NL_LIVE_BACKUP_pre_6a_recurring_feedback_${stamp}.json`), JSON.stringify(pre, null, 2));
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
writeFileSync(resolve(EXPORT_DIR, `WF1_6a_recurring_feedback_APPLIED_${stamp}.json`), JSON.stringify(after, null, 2));
writeFileSync(resolve(EXPORT_DIR, 'WF1 - Profile Insert EN_NL.json'), JSON.stringify(after, null, 2));
console.log(`\nWF1: APPLIED and verified (active=${after.active}). Canonical export refreshed.`);
