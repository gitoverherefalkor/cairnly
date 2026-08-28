#!/usr/bin/env node
// Apply the language-contract edits to the five live n8n workflows.
// See docs/LANGUAGE_CONTRACT_PLAN.md.
//
//   node scripts/apply-language-contract-n8n.mjs --dry-run   # fetch + transform + assert, no writes
//   node scripts/apply-language-contract-n8n.mjs             # the same, then PUT + verify
//
// Self-contained and idempotent: it fetches each workflow's LIVE state, derives
// the new state from transformation rules (never from a stale snapshot), asserts
// that ONLY the intended nodes change, uploads, re-fetches and verifies. If a
// workflow was already migrated (no language machinery found), it is skipped.
// Reads N8N_API_KEY from .env.local. Every pre-state is saved to
// n8n_wfs_cairnly/ before any PUT.
//
// What it changes (per workflow):
//   WF1  prompt_perso_prof1: ternary language block -> static English directive;
//        Dutch header table removed. extract_report_sections_code1: stamp 'en'.
//   WF3  Set Outside Box Prompt: LANGUAGE LOCK + conditional tail -> static
//        English directive. Parse OOB: stamp 'en'.
//   WF4  T3 Careers Prompt / Set Runner Up Prompt / Dream Job Feasibility:
//        LANGUAGE LOCK + conditional tail -> static English directive.
//        Split Top3 / Parse runner up / Parse Dream: stamp 'en'.
//   WF6  five Build * Prompt tails -> static English directive; NEW node
//        "Translate Updated Section" wired after the three Update nodes.
//   WF7  Combine Sections language vote -> 'en'; Prepare for Insert -> 'en';
//        Basic LLM Chain conditional -> static English directive; NEW node
//        "Translate Exec Summary" wired after Insert Exec Summary.

import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = resolve(ROOT, 'n8n_wfs_cairnly');
const BASE_URL = 'https://falkoratlas.app.n8n.cloud/api/v1';
const DRY_RUN = process.argv.includes('--dry-run');

// ── env ──
// Prefer the ambient env (run via: set -a; source .env.local; set +a; node …),
// fall back to parsing .env.local directly.
const envFile = readFileSync(resolve(ROOT, '.env.local'), 'utf-8');
const API_KEY =
  process.env.N8N_API_KEY ??
  envFile
    .match(/^N8N_API_KEY=(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '');
if (!API_KEY) throw new Error('N8N_API_KEY not found in .env.local');

const STATIC_TAIL = `# OUTPUT LANGUAGE
Write ALL prose in English. Always. The candidate's name, nationality, employers or survey answers in another language never change your output language. The platform translates the finished document afterwards (language contract); your output is the canonical English version.`;

const WF6_STATIC = `# OUTPUT LANGUAGE
Produce the regenerated content in English. Always. The existing section content above is the canonical English version; match its structure (<h5>/<h3>/<h4>/<strong> subheaders, rating labels, any JSON structure) exactly. The user's feedback may be in another language — understand it, but write English. The platform re-translates the section afterwards (language contract).`;

const LOCK_RE = /!!! ABSOLUTE LANGUAGE LOCK[\s\S]*?!!! END LANGUAGE LOCK !!!\n*/;
const LANG_PIN = "const __lang = 'en'; // language contract: canonical content is always English; translate-section adds translations";

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

const getAssignment = (node, pred) => node.parameters.assignments.assignments.find(pred);

function pinLangInCode(node, oldDerivation) {
  const code = node.parameters.jsCode;
  if (code.includes(LANG_PIN)) return false; // already migrated
  assert(code.includes(oldDerivation), `${node.name}: expected __lang derivation not found`);
  node.parameters.jsCode = code.replace(oldDerivation, LANG_PIN);
  return true;
}

function replaceTerminalTail(text, name) {
  const k = text.indexOf('# OUTPUT LANGUAGE');
  assert(k >= 0, `${name}: no OUTPUT LANGUAGE tail`);
  if (!text.slice(k).includes("'nl'")) return null; // already the static tail
  return text.slice(0, k) + STATIC_TAIL;
}

function stripLock(text) {
  return LOCK_RE.test(text) ? text.replace(LOCK_RE, '') : text;
}

// httpRequest node template for the two new translate calls. The credential is
// the same "Supabase Edge Functions — Shared Secret" header credential the
// analysis-completed call in WF4 uses.
function translateNode(name, jsonBody, position, notes, tmpl) {
  return {
    parameters: {
      method: 'POST',
      url: 'https://pcoyafgsirrznhmdaiji.functions.supabase.co/translate-section',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody,
      options: { timeout: 120000 },
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: tmpl.typeVersion,
    position,
    id: randomUUID(),
    name,
    onError: 'continueRegularOutput',
    notes,
    credentials: tmpl.credentials,
  };
}

// ── per-workflow transformations. Each returns the set of intended node names
//    (changed or added), or null when the workflow is already migrated. ──

function transformWF1(wf) {
  const intended = new Set();
  for (const n of wf.nodes) {
    if (n.name === 'prompt_perso_prof1') {
      const a = getAssignment(n, (x) => typeof x.value === 'string' && x.value.includes('ABSOLUTE OUTPUT LANGUAGE'));
      if (!a) continue; // migrated
      let v = a.value;
      const j = v.indexOf('# MANDATORY: SECOND PERSON VOICE');
      assert(j > 0, 'WF1: SECOND PERSON marker missing');
      v = '=' + STATIC_TAIL + '\n\n' + v.slice(j);
      const k = v.indexOf('# OUTPUT LANGUAGE (CRITICAL');
      assert(k > 0, 'WF1: conditional tail missing');
      v = v.slice(0, k) +
        '# STRUCTURED BLOCK\nKeep the <personality_scores>...</personality_scores> block EXACTLY as specified (English keys, structured JSON) — the dashboard parses it.\n';
      assert(!v.includes('DUTCH') && !v.includes("IS 'nl'") && !v.includes('Jouw aanpak'), 'WF1: dutch remnants');
      assert(!v.includes('preferred_language'), 'WF1: preferred_language remnants');
      a.value = v;
      intended.add(n.name);
    }
    if (n.name === 'extract_report_sections_code1') {
      if (pinLangInCode(n, "const __lang = ($('Process Survey Data1').first().json.preferred_language === 'nl') ? 'nl' : 'en';")) intended.add(n.name);
    }
  }
  return intended.size ? intended : null;
}

function transformWF3(wf) {
  const intended = new Set();
  for (const n of wf.nodes) {
    if (n.name === 'Set Outside Box Prompt') {
      const a = getAssignment(n, (x) => typeof x.value === 'string' && x.value.includes('# ROLE'));
      assert(a, 'WF3: outside_box_prompt assignment missing');
      let v = stripLock(a.value);
      const k = v.indexOf('# OUTPUT LANGUAGE');
      const m = v.indexOf('# INPUTS');
      if (k >= 0 && k < m && v.slice(k, m).includes("'nl'")) {
        v = v.slice(0, k) + STATIC_TAIL + '\n\n' + v.slice(m);
      }
      if (v !== a.value) {
        assert(!v.includes('ABSOLUTE LANGUAGE LOCK') && !v.includes("IS 'nl'") && !v.includes('Overzicht'), 'WF3: remnants');
        a.value = v;
        intended.add(n.name);
      }
    }
    if (n.name === 'Parse OOB') {
      if (pinLangInCode(n, "const __lang = ($('Pull Profile Sections').first().json.language === 'nl') ? 'nl' : 'en';")) intended.add(n.name);
    }
  }
  return intended.size ? intended : null;
}

function transformWF4(wf) {
  const intended = new Set();
  const prompts = [
    ['T3 Careers Prompt', (n) => getAssignment(n, (x) => x.name === 'top_3_careers_prompt')],
    ['Set Runner Up Prompt', (n) => getAssignment(n, (x) => x.name === '=runner_up_prompt')],
  ];
  for (const n of wf.nodes) {
    const p = prompts.find(([name]) => name === n.name);
    if (p) {
      const a = p[1](n);
      assert(a, `WF4 ${n.name}: assignment missing`);
      let v = stripLock(a.value);
      const tail = replaceTerminalTail(v, n.name);
      if (tail) v = tail;
      if (v !== a.value) { a.value = v; intended.add(n.name); }
    }
    if (n.name === 'Dream Job Feasibility') {
      let v = stripLock(n.parameters.text);
      const tail = replaceTerminalTail(v, n.name);
      if (tail) v = tail;
      if (v !== n.parameters.text) { n.parameters.text = v; intended.add(n.name); }
    }
    if (n.name === 'Split Top3') {
      if (pinLangInCode(n, "const __lr = $('Get Report Language').first().json; const __lang = ((__lr && __lr.language) === 'nl') ? 'nl' : 'en';")) intended.add(n.name);
    }
    if (n.name === 'Parse runner up') {
      if (pinLangInCode(n, "const __lr = $('Get Report Language').first().json; const __lang = ((__lr && __lr.language) === 'nl') ? 'nl' : 'en';")) intended.add(n.name);
    }
    if (n.name === 'Parse Dream') {
      const old = n.parameters.jsCode.match(/const __lang = \(\(__lr && __lr\.language\) === 'nl'\) \? 'nl' : 'en';/);
      if (old) {
        // Parse Dream keeps its __lr line on a separate statement; replace only the derivation.
        n.parameters.jsCode = n.parameters.jsCode.replace(old[0], "const __lang = 'en'; // language contract: canonical content is always English; translate-section adds translations".replace('const __lang = ', 'const __lang = ').trim());
        intended.add(n.name);
      } else if (!n.parameters.jsCode.includes("const __lang = 'en'")) {
        die('WF4 Parse Dream: __lang derivation not found');
      }
    }
  }
  // sanity: no prompt still references the language node or a decision
  for (const n of wf.nodes) {
    if (['T3 Careers Prompt', 'Set Runner Up Prompt', 'Dream Job Feasibility'].includes(n.name)) {
      const blob = JSON.stringify(n.parameters);
      assert(!blob.includes('ABSOLUTE LANGUAGE LOCK') && !blob.includes("IS 'nl'"), `WF4 ${n.name}: remnants`);
    }
  }
  return intended.size ? intended : null;
}

function transformWF6(wf, tmpl) {
  const intended = new Set();
  const promptNodes = ['Build Personality Prompt', 'Build Outside Box Prompt', 'Build Dream Prompt', 'Build Runner-ups Prompt1', 'Build Top Career Prompt'];
  for (const n of wf.nodes) {
    if (!promptNodes.includes(n.name)) continue;
    const a = getAssignment(n, (x) => typeof x.value === 'string' && x.value.includes('# OUTPUT LANGUAGE'));
    if (!a) continue;
    const k = a.value.indexOf('# OUTPUT LANGUAGE');
    if (!a.value.slice(k).includes("'nl'")) continue; // migrated
    a.value = a.value.slice(0, k) + WF6_STATIC;
    intended.add(n.name);
  }
  if (!wf.nodes.some((n) => n.name === 'Translate Updated Section')) {
    const upds = wf.nodes.filter((n) => n.name.startsWith('Update Section in DB'));
    assert(upds.length === 3, `WF6: expected 3 update nodes, found ${upds.length}`);
    const px = Math.max(...upds.map((n) => n.position[0])) + 260;
    const py = Math.round(upds.reduce((s, n) => s + n.position[1], 0) / upds.length);
    wf.nodes.push(translateNode(
      'Translate Updated Section',
      `={"report_id": "{{ $('Parse Query').first().json.report_id }}"}`,
      [px, py],
      'Language contract: re-translate the section(s) WF6 just rewrote (the DB trigger wiped their stored translations). Batch mode: translates whatever is missing for this report. Failure falls back to English display + alert email — never fails the feedback flow.',
      tmpl,
    ));
    for (const upd of upds) {
      wf.connections[upd.name] ??= { main: [] };
      wf.connections[upd.name].main[0] ??= [];
      wf.connections[upd.name].main[0].push({ node: 'Translate Updated Section', type: 'main', index: 0 });
    }
    intended.add('Translate Updated Section');
  }
  return intended.size ? intended : null;
}

function transformWF7(wf, tmpl) {
  const intended = new Set();
  for (const n of wf.nodes) {
    if (n.name === 'Combine Sections') {
      const old = 'const lang = (sections.find(s => s.language) || {}).language || \'en\';';
      if (n.parameters.jsCode.includes(old)) {
        n.parameters.jsCode = n.parameters.jsCode.replace(old, "const lang = 'en'; // language contract: canonical content is always English");
        intended.add(n.name);
      }
    }
    if (n.name === 'Prepare for Insert') {
      const old = "const lang = $('Combine Sections').item.json.preferred_language || 'en';";
      if (n.parameters.jsCode.includes(old)) {
        n.parameters.jsCode = n.parameters.jsCode.replace(old, "const lang = 'en'; // language contract: canonical content is always English");
        intended.add(n.name);
      }
    }
    if (n.name === 'Basic LLM Chain') {
      const text = n.parameters.text;
      const k = text.indexOf('preferred_language = {{');
      if (k >= 0) {
        const head = text.lastIndexOf('\n', k);
        n.parameters.text = text.slice(0, head + 1) + STATIC_TAIL.replace('# OUTPUT LANGUAGE\n', '');
        assert(!n.parameters.text.includes('preferred_language'), 'WF7: prompt remnants');
        intended.add(n.name);
      }
    }
  }
  if (!wf.nodes.some((n) => n.name === 'Translate Exec Summary')) {
    const ins = wf.nodes.find((n) => n.name === 'Insert Exec Summary');
    assert(ins, 'WF7: Insert Exec Summary missing');
    wf.nodes.push(translateNode(
      'Translate Exec Summary',
      `={"report_id": "{{ $('Extract report_id').item.json.report_id }}"}`,
      [ins.position[0] + 260, ins.position[1]],
      'Language contract: translate the freshly inserted exec_summary for non-English users. Failure falls back to English display + alert email.',
      tmpl,
    ));
    wf.connections['Insert Exec Summary'] ??= { main: [] };
    wf.connections['Insert Exec Summary'].main[0] ??= [];
    wf.connections['Insert Exec Summary'].main[0].push({ node: 'Translate Exec Summary', type: 'main', index: 0 });
    intended.add('Translate Exec Summary');
  }
  return intended.size ? intended : null;
}

// ── driver ──

const TARGETS = [
  { key: 'WF1', id: '0Z8WxV5tVFMJqIZt', transform: transformWF1 },
  { key: 'WF3', id: 'zhgJuiDp60PS5ZKJ', transform: transformWF3 },
  { key: 'WF4', id: 'seWmQPFQqIe60TkU', transform: transformWF4 },
  { key: 'WF6', id: 'CyyjL7D51NbVZNtL', transform: transformWF6 },
  { key: 'WF7', id: 'ohNbCw7pVqvjCZHT', transform: transformWF7 },
];
const SETTINGS_WHITELIST = ['saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow', 'timezone', 'executionOrder'];

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
let anyFailed = false;

// template for the new translate nodes: WF4's proven analysis-completed call
const wf4Live = await api('/workflows/seWmQPFQqIe60TkU');
const tmpl = wf4Live.nodes.find((n) => n.type === 'n8n-nodes-base.httpRequest' && String(n.parameters.url ?? '').includes('analysis-completed'));
if (!tmpl) die('template node not found in WF4');

for (const t of TARGETS) {
  try {
    const live = await api(`/workflows/${t.id}`);
    const pre = JSON.parse(JSON.stringify(live));
    const intended = t.transform(live, tmpl);
    if (!intended) { console.log(`${t.key}: already migrated — skipped`); continue; }

    // exact-diff assert: only intended nodes changed/added, connections only grew for the wiring nodes
    const changed = [];
    for (const a of pre.nodes) {
      const b = live.nodes.find((x) => x.name === a.name);
      assert(b, `${t.key}: node vanished: ${a.name}`);
      if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(a.name);
    }
    const added = live.nodes.filter((n) => !pre.nodes.some((x) => x.name === n.name)).map((n) => n.name);
    const all = new Set([...changed, ...added]);
    assert([...all].every((n) => intended.has(n)) && [...intended].every((n) => all.has(n)),
      `${t.key}: diff mismatch: ${[...all].join(',')} vs intended ${[...intended].join(',')}`);

    console.log(`${t.key}: will change [${[...intended].join(', ')}]`);
    if (DRY_RUN) continue;

    writeFileSync(resolve(BACKUP_DIR, `${t.key}_LIVE_BACKUP_pre_langcontract_apply_${stamp}.json`), JSON.stringify(pre));
    const settings = Object.fromEntries(Object.entries(pre.settings ?? {}).filter(([k]) => SETTINGS_WHITELIST.includes(k)));
    await api(`/workflows/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: live.name, nodes: live.nodes, connections: live.connections, settings }),
    });

    // verify: re-fetch and compare every node parameterisation
    const after = await api(`/workflows/${t.id}`);
    for (const n of live.nodes) {
      const b = after.nodes.find((x) => x.name === n.name);
      assert(b, `${t.key} verify: node missing after PUT: ${n.name}`);
      assert(JSON.stringify(n.parameters) === JSON.stringify(b.parameters), `${t.key} verify: parameters drifted on ${n.name}`);
    }
    assert(after.active === pre.active, `${t.key} verify: active flag changed`);
    writeFileSync(resolve(BACKUP_DIR, `${t.key}_langcontract_APPLIED_${stamp}.json`), JSON.stringify(after));
    console.log(`${t.key}: APPLIED and verified (active=${after.active})`);
  } catch (e) {
    anyFailed = true;
    console.error(`${t.key}: FAILED — ${e.message}`);
  }
}

console.log(DRY_RUN ? '\nDry run complete — nothing written.' : anyFailed ? '\nDONE WITH FAILURES — see above.' : '\nAll workflows applied and verified.');
process.exit(anyFailed ? 1 : 0);
