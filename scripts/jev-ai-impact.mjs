// Measurement (b) part 1 from docs/jev-cairnly-ontwerp-2026-09-23.md (4.2): Jev's AI-impact level
// for every enriched_jobs row, compared with the label Cairnly stores today.
//
// Read-only against production: SELECTs on enriched_jobs, ai_research, reports, profiles with the
// service-role key. Nothing is written to Supabase or n8n.
//
// What goes to TypeSafe, per row: career_title, overview, typical_tasks, company_size_type,
// path_type, plus the current ai_research.key_findings (the same text WF2 feeds its AI-impact
// prompt). A row is skipped, never sent, when the candidate's first or last name appears in those
// fields; rows without a report (early test runs) are checked against every first name in profiles.
//
// The questions are the three from 2.3 of the design doc, verbatim. The stored label is normalised
// with the alias table and LABEL_GROUP read straight out of src/components/chat/CareerScoreCard.tsx,
// plus that file's "range → highest tier" rule.
//
// Cost ceiling $0.25: a call that would cross it is never started. Raw answers are appended to
// <out>/jev-ai-impact-raw.jsonl; a rerun skips rows already answered, so re-analysis is free.
//
// Run:   node scripts/jev-ai-impact.mjs --out <dir> [--dry-run] [--limit N] [--concurrency 8]
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  JEV_MODEL, USD_PER_INPUT_TOKEN, CostGuard, callJev, loadEnvLocal, parseArgs, quantile, requireEnv, writeJson,
} from './jev-shared.mjs';

const args = parseArgs();
const OUT = args.out ?? 'scratchpad';
const DRY = Boolean(args['dry-run']);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const CONCURRENCY = Number(args.concurrency ?? 8);
const CAP_USD = 0.25;
const RAW_FILE = path.join(OUT, 'jev-ai-impact-raw.jsonl');

loadEnvLocal();
const sb = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------------------------
// The questions, verbatim from 2.3.
const QUESTIONS = {
  physical_role: {
    type: 'noul',
    instructions: 'Does this role require physical presence or manual dexterity as its core, such as construction, trades, landscaping, or hands-on healthcare, judged on `title`, `overview` and `typical_tasks`?',
  },
  orchestrator_role: {
    type: 'noul',
    instructions: 'Does this role carry strategic accountability and final human judgment at the top of an organization or practice, such as Head of, VP, Director, C-suite, Owner or Partner, where high-stakes decisions, organizational politics and legal accountability cannot be delegated to AI?',
  },
  ai_impact: {
    type: 'score',
    instructions: {
      context: 'Project forward 18 to 24 months, assuming agentic AI that executes multi-step workflows end to end, keeps project and client context over months, and operates business software at professional level. Use `research` to calibrate.',
      question: "How much will AI change this role's core deliverables in `overview` and `typical_tasks`?",
    },
    criteria: [
      'The rare exception. The role leans on physical presence, hands-on skill, or human accountability AI cannot take over. Few office roles qualify. Think: skilled trades, emergency response, hands-on care.',
      'Healthy augmentation. AI absorbs routine research, drafting, and analysis; the human shifts to judgment, editing, and decisions and stays essential. Think: product management, senior consulting, UX strategy, people leadership.',
      'The role reshapes. A large part of the day-to-day moves to AI; the human adapts to directing and quality-checking AI rather than doing the work by hand. Think: mid-level analysis, marketing execution, project coordination.',
      'Teams shrink. Most of the role automates and the work concentrates into fewer, AI-leveraged people. Remaining human involvement is supervisory. Think: standard reporting, routine QA, first-line content.',
      'Pivot needed. The core deliverables are fully automatable by agentic AI today, at higher speed and lower cost. The role as it exists is endangered. Think: data entry, basic customer support, routine translation.',
    ],
  },
};

const LEVELS = ['Minimal', 'Moderate', 'High', 'Severe', 'Critical'];

// The code rule from 2.3: physical > 0.8 → Minimal; else orchestrator > 0.8 → Moderate;
// else round(score) with a floor of 1 (Moderate), because Minimal is the exception.
function designLabel(a) {
  if (a.physical_role.noul > 0.8) return { label: 'Minimal', rule: 'physical' };
  if (a.orchestrator_role.noul > 0.8) return { label: 'Moderate', rule: 'orchestrator' };
  const lvl = Math.round(a.ai_impact.score);
  if (lvl < 1) return { label: 'Moderate', rule: 'floor' };
  return { label: LEVELS[lvl], rule: 'score' };
}

// ---------------------------------------------------------------------------------------------
// Today's label, normalised exactly like the frontend does.
const cardSrc = fs.readFileSync('src/components/chat/CareerScoreCard.tsx', 'utf8');
const aliasBlock = cardSrc.match(/const AI_IMPACT_ALIASES[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1];
const labelGroupSrc = cardSrc.match(/const LABEL_GROUP =\s*'([^']+)'/)?.[1];
if (!aliasBlock || !labelGroupSrc) throw new Error('could not read the alias table from CareerScoreCard.tsx');
const ALIASES = {};
for (const m of aliasBlock.matchAll(/^\s*(?:'([^']+)'|([a-z_]+))\s*:\s*'(\w+)'/gm)) ALIASES[m[1] ?? m[2]] = m[3];
const LABEL_GROUP = labelGroupSrc.replace(/\\\\/g, '\\');
const TIER = Object.fromEntries(LEVELS.map((l, i) => [l, i]));
const aliasFor = (raw) => ALIASES[raw.toLowerCase().replace(/\s+/g, ' ').trim()] ?? null;

function storedRating(raw) {
  if (raw == null) return null;
  if (/^\s*\{/.test(raw)) {
    try { return String(JSON.parse(raw).rating ?? ''); } catch { return raw; }
  }
  return String(raw);
}

function normaliseStored(rating) {
  if (!rating) return null;
  const direct = aliasFor(rating);
  if (direct) return direct;
  // Same as extractAIImpact's fallback: every label word in the string, highest tier wins
  // ("Low to Moderate" → Moderate, "Augmented - (21-50%)" → Moderate).
  let best = null;
  for (const m of rating.matchAll(new RegExp(`\\b${LABEL_GROUP}\\b`, 'gi'))) {
    const lvl = aliasFor(m[1]);
    if (lvl && (!best || TIER[lvl] > TIER[best])) best = lvl;
  }
  return best;
}

// Prompt eras, read off the vocabulary in the column (see the doc for the counts).
function eraOf(createdAt) {
  const d = createdAt.slice(0, 10);
  if (d < '2025-12-01') return 'E1 aug-nov 2025 (Supporting/Substantial)';
  if (d < '2026-03-01') return 'E2 dec 2025-jan 2026 (Safe/Augmented/Transforming)';
  if (d < '2026-05-16') return 'E3 mrt-mei 2026 (Low/Medium/High)';
  return 'E4 vanaf 16 mei 2026 (Minimal/Moderate/Substantial)';
}

const titleKey = (t) => (t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------
async function selectAll(table, columns, build = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const [jobs, research, reports, profiles] = await Promise.all([
  selectAll('enriched_jobs', 'id, created_at, report_id, career_title, overview, typical_tasks, company_size_type, path_type, ai_impact_rating', (q) => q.order('id')),
  sb.from('ai_research').select('key_findings, published_date').eq('is_active', true).order('published_date', { ascending: false }).limit(1),
  selectAll('reports', 'id, user_id'),
  selectAll('profiles', 'id, first_name, last_name'),
]);
if (research.error || !research.data?.length) throw new Error(`ai_research: ${research.error?.message ?? 'no active row'}`);
const keyFindings = research.data[0].key_findings;

// Names, never printed. Matched as whole words, as stored and capitalised.
const nameVariants = (n) => {
  const s = (n ?? '').trim();
  if (s.length < 2) return [];
  const cap = s[0].toUpperCase() + s.slice(1);
  return [...new Set([s, cap, s.toUpperCase()])];
};
const nameRegex = (names) => {
  const vs = [...new Set(names.flatMap(nameVariants))].map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return vs.length ? new RegExp(`(?<!\\p{L})(?:${vs.join('|')})(?!\\p{L})`, 'u') : null;
};
const userOfReport = new Map(reports.map((r) => [r.id, r.user_id]));
const profileById = new Map(profiles.map((p) => [p.id, p]));
const allFirstNames = nameRegex(profiles.map((p) => p.first_name));

const stateOf = (j) => ({
  title: j.career_title,
  overview: j.overview,
  typical_tasks: j.typical_tasks,
  company_size_type: j.company_size_type,
  path_type: j.path_type,
  research: keyFindings,
});

const prepared = [];
const skipped = { own_name: 0, any_first_name_unlinked: 0, report_deleted: 0 };
for (const j of jobs) {
  const fieldsText = [j.career_title, j.overview, JSON.stringify(j.typical_tasks ?? []), j.company_size_type, j.path_type].join('\n');
  if (j.report_id) {
    const p = profileById.get(userOfReport.get(j.report_id));
    if (!p) { skipped.report_deleted++; continue; }
    const re = nameRegex([p.first_name, p.last_name]);
    if (re && re.test(fieldsText)) { skipped.own_name++; continue; }
  } else if (allFirstNames && allFirstNames.test(fieldsText)) {
    skipped.any_first_name_unlinked++; continue;
  }
  const rating = storedRating(j.ai_impact_rating);
  prepared.push({
    id: j.id,
    run: j.report_id ?? `unlinked:${j.created_at.slice(0, 16)}`,
    linked: Boolean(j.report_id),
    era: eraOf(j.created_at),
    title: j.career_title,
    title_key: titleKey(j.career_title),
    stored_rating: rating,
    stored_level: normaliseStored(rating),
    state: stateOf(j),
  });
}

const questionsTokens = Math.ceil(JSON.stringify(QUESTIONS).length / 4);
const projected = (p) => Math.ceil(JSON.stringify(p.state).length / 4) + questionsTokens + 50;
const projectedTotal = prepared.reduce((s, p) => s + projected(p), 0);

console.log(`enriched_jobs rows: ${jobs.length} | to send: ${prepared.length} | skipped: ${JSON.stringify(skipped)}`);
console.log(`stored label recognised by the alias table: ${prepared.filter((p) => p.stored_level).length} of ${prepared.length}`);
console.log(`projected input tokens: ~${projectedTotal} (~$${(projectedTotal * USD_PER_INPUT_TOKEN).toFixed(4)}), cap $${CAP_USD}`);

// ---------------------------------------------------------------------------------------------
// Calls (skipped in --dry-run). Resumable: rows already in RAW_FILE are not sent again.
fs.mkdirSync(OUT, { recursive: true });
const done = new Map();
if (fs.existsSync(RAW_FILE)) {
  for (const line of fs.readFileSync(RAW_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.answers) done.set(r.id, r);
  }
}

let stoppedByCap = false;
if (!DRY) {
  const key = requireEnv('TYPESAFE_API_KEY');
  const guard = new CostGuard(CAP_USD);
  const todo = prepared.filter((p) => !done.has(p.id)).slice(0, LIMIT);
  console.log(`already answered: ${done.size} | sending now: ${todo.length} | concurrency ${CONCURRENCY}`);
  let next = 0, maxSeen = 0, fatal = null;
  const worker = async () => {
    while (!fatal && next < todo.length) {
      const p = todo[next++];
      const reserve = Math.max(projected(p), Math.ceil(maxSeen * 1.1));
      if (!guard.reserve(reserve)) { stoppedByCap = true; return; }
      try {
        const { body, ms } = await callJev(key, { state: p.state, questions: QUESTIONS });
        const used = body.usage?.input_tokens ?? 0;
        maxSeen = Math.max(maxSeen, used);
        guard.settle(reserve, used);
        const rec = { id: p.id, model: body.model, ms: Math.round(ms), input_tokens: used, answers: body.answers };
        fs.appendFileSync(RAW_FILE, JSON.stringify(rec) + '\n');
        done.set(p.id, rec);
        if (done.size % 50 === 0) console.log(`  ${done.size} answered, spent $${guard.spentUsd.toFixed(5)}`);
      } catch (e) {
        guard.settle(reserve, 0);
        console.error(`row ${p.id}: ${e.message}`);
        if (e.status === 401 || e.status === 422) fatal = e;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (fatal) { console.error('STOP: request rejected, see above'); process.exit(1); }
  if (stoppedByCap) console.error(`STOP: next call would cross the $${CAP_USD} ceiling. Spent $${guard.spentUsd.toFixed(5)}.`);
  console.log(`this run: ${guard.spentTokens} input tokens, $${guard.spentUsd.toFixed(5)}`);
}

// ---------------------------------------------------------------------------------------------
// Analysis.
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const results = prepared.map((p) => {
  const r = done.get(p.id);
  if (!r) return { ...p, jev: null };
  const d = designLabel(r.answers);
  return {
    ...p,
    model: r.model,
    jev: d.label,
    jev_rule: d.rule,
    jev_score: r.answers.ai_impact.score,
    jev_argmax: LEVELS[Number(Object.entries(r.answers.ai_impact.probabilities).sort((a, b) => b[1] - a[1])[0][0])],
    confidence: r.answers.ai_impact.confidence,
    physical: r.answers.physical_role.noul,
    orchestrator: r.answers.orchestrator_role.noul,
  };
});

const storedDist = Object.fromEntries(LEVELS.map((l) => [l, results.filter((r) => r.stored_level === l).length]));
storedDist.unrecognised = results.filter((r) => !r.stored_level).length;

// Consistency of one label field per title across runs (reports, or unlinked test runs).
function titleConsistency(rows, field) {
  const byTitle = new Map();
  for (const r of rows) {
    if (!r[field]) continue;
    if (!byTitle.has(r.title_key)) byTitle.set(r.title_key, new Map());
    byTitle.get(r.title_key).set(r.run, r[field]); // one label per run
  }
  const multi = [...byTitle.entries()].filter(([, runs]) => runs.size >= 2);
  const consistent = multi.filter(([, runs]) => new Set(runs.values()).size === 1);
  let pairs = 0, same = 0;
  for (const [, runs] of multi) {
    const v = [...runs.values()];
    for (let i = 0; i < v.length; i++) for (let k = i + 1; k < v.length; k++) { pairs++; if (v[i] === v[k]) same++; }
  }
  return {
    titles_in_2plus_runs: multi.length,
    all_runs_same_label_pct: pct(consistent.length, multi.length),
    pairwise_same_label_pct: pct(same, pairs),
    examples_inconsistent: multi.filter(([, runs]) => new Set(runs.values()).size > 1).slice(0, 12)
      .map(([t, runs]) => ({ title: t, labels: [...runs.values()] })),
  };
}

const summary = {
  generated_at: new Date().toISOString(),
  model_pinned: JEV_MODEL,
  rows_total: jobs.length,
  rows_sendable: prepared.length,
  skipped,
  stored_label_distribution: storedDist,
  stored_label_era_counts: Object.fromEntries(
    [...new Set(results.map((r) => r.era))].sort().map((e) => [e, results.filter((r) => r.era === e).length]),
  ),
  stored_title_consistency_all_eras: titleConsistency(results, 'stored_level'),
  stored_title_consistency_e4_only: titleConsistency(results.filter((r) => r.era.startsWith('E4')), 'stored_level'),
};

const answered = results.filter((r) => r.jev);
if (answered.length) {
  const cmp = answered.filter((r) => r.stored_level);
  const matrix = Object.fromEntries(LEVELS.map((s) => [s, Object.fromEntries(LEVELS.map((j) => [j, 0]))]));
  for (const r of cmp) matrix[r.stored_level][r.jev]++;
  const agree = (rows) => ({
    n: rows.length,
    exact_pct: pct(rows.filter((r) => r.stored_level === r.jev).length, rows.length),
    within_one_pct: pct(rows.filter((r) => Math.abs(TIER[r.stored_level] - TIER[r.jev]) <= 1).length, rows.length),
  });
  const conf = cmp.map((r) => r.confidence);
  const dis = cmp.filter((r) => r.stored_level !== r.jev);
  const agr = cmp.filter((r) => r.stored_level === r.jev);
  const q = (xs) => { const s = [...xs].sort((a, b) => a - b); return { p25: +quantile(s, 0.25).toFixed(3), p50: +quantile(s, 0.5).toFixed(3), p75: +quantile(s, 0.75).toFixed(3) }; };
  const buckets = (rows) => ({
    '<0.5': rows.filter((r) => r.confidence < 0.5).length,
    '0.5-0.7': rows.filter((r) => r.confidence >= 0.5 && r.confidence < 0.7).length,
    '0.7-0.9': rows.filter((r) => r.confidence >= 0.7 && r.confidence < 0.9).length,
    '>=0.9': rows.filter((r) => r.confidence >= 0.9).length,
  });
  Object.assign(summary, {
    answered: answered.length,
    models_seen: [...new Set(answered.map((r) => r.model))],
    jev_label_distribution: Object.fromEntries(LEVELS.map((l) => [l, answered.filter((r) => r.jev === l).length])),
    jev_rule_fired: Object.fromEntries(['physical', 'orchestrator', 'floor', 'score'].map((k) => [k, answered.filter((r) => r.jev_rule === k).length])),
    confusion_matrix_rows_stored_cols_jev: matrix,
    agreement_total: agree(cmp),
    agreement_per_era: Object.fromEntries(
      [...new Set(cmp.map((r) => r.era))].sort().map((e) => [e, agree(cmp.filter((r) => r.era === e))]),
    ),
    disagreement_direction: {
      jev_higher: dis.filter((r) => TIER[r.jev] > TIER[r.stored_level]).length,
      jev_lower: dis.filter((r) => TIER[r.jev] < TIER[r.stored_level]).length,
    },
    confidence: {
      all: q(conf),
      agreeing: q(agr.map((r) => r.confidence)),
      disagreeing: q(dis.map((r) => r.confidence)),
      disagreeing_buckets: buckets(dis),
      agreeing_buckets: buckets(agr),
      agreement_above_threshold: Object.fromEntries([0.5, 0.7, 0.9].map((t) => {
        const rows = cmp.filter((r) => r.confidence >= t);
        return [`>=${t}`, { coverage_pct: pct(rows.length, cmp.length), ...agree(rows) }];
      })),
    },
    jev_title_consistency_all: titleConsistency(answered, 'jev'),
    jev_title_consistency_e4_only: titleConsistency(answered.filter((r) => r.era.startsWith('E4')), 'jev'),
    disagreements_high_confidence: dis.filter((r) => r.confidence >= 0.7)
      .sort((a, b) => b.confidence - a.confidence).slice(0, 25)
      .map((r) => ({ id: r.id, title: r.title, era: r.era.slice(0, 2), stored: r.stored_rating, stored_level: r.stored_level, jev: r.jev, rule: r.jev_rule, score: +r.jev_score.toFixed(2), confidence: +r.confidence.toFixed(2) })),
  });
}

const file = writeJson(OUT, `jev-ai-impact-summary${DRY ? '-dry' : ''}.json`, summary);
writeJson(OUT, 'jev-ai-impact-rows.json', results.map(({ state, ...r }) => r));
console.log(JSON.stringify(summary, null, 2));
console.log(`summary: ${file}`);
