// Career-only fit traits (docs/jev-cairnly-ontwerp-2026-09-23.md, 1.4 block B and 1.11): does Jev
// add anything over plain code for the questions that describe only the career?
//
// Step 1 of the measurement (see 1.11) found five of the six fields to be free text, so five
// questions go to Jev: interaction_load, hours_band, schedule_type, team_scale, pace_pressure.
// structure_level is a lookup on company_size_type (22 fixed values) and is computed here in code,
// only to show its distribution.
//
// Read-only against production: SELECTs on enriched_jobs, reports, profiles with the service-role
// key. Nothing is written to Supabase or n8n.
//
// What goes to TypeSafe: per career only career_title, overview, company_size_type, typical_tasks,
// work_schedule, autonomy_vs_collaboration, client_interaction, colleague_interaction,
// leadership_challenges, pace_of_work. No profile, CV or chat data. A row is skipped, never sent,
// when the candidate's first name (profiles) appears in one of those fields.
//
// Batch mode (default): one request per report with all its careers in `careers[]`, the questions
// indexed per career (`interaction_load_3` asks about `careers[3]`). Split mode (--split <report_id>
// or --split auto): the same report as one request per career, state `career`, questions verbatim,
// to check whether the large state changes the answers.
//
// Cost ceiling $0.25: a call that would cross it is never started. Raw answers are appended to
// <out>/jev-career-traits-raw.jsonl; a rerun skips what is already answered.
//
// Run:   node scripts/jev-career-traits.mjs --out <dir> [--dry-run] [--limit N] [--concurrency 4]
//        node scripts/jev-career-traits.mjs --out <dir> --split auto
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
const CONCURRENCY = Number(args.concurrency ?? 4);
const SPLIT = args.split ?? null;
const CAP_USD = 0.25;
const SINCE = '2026-05-16';
const MAX_CAREERS = 16; // a report holds 15 careers plus sometimes a dream job; reruns are deduped
const RAW_FILE = path.join(OUT, 'jev-career-traits-raw.jsonl');

loadEnvLocal();
const sb = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------------------------
// The questions, verbatim from 1.4 block B. In batch mode code rewrites `career.x` to
// `careers[i].x` and names the career; nothing else changes.
const QUESTIONS = {
  interaction_load: {
    type: 'choice',
    instructions: 'How much daily interaction with colleagues and clients does this career involve, based on `career.colleague_interaction`, `career.client_interaction` and `career.typical_tasks`?',
    criteria: {
      low: 'Mostly solo work; interaction is occasional.',
      moderate: 'Regular but bounded interaction, such as scheduled meetings and a small team.',
      high: 'Interaction most of the day: leading people, frequent client contact, cross-team coordination.',
      very_high: 'Constant interaction is the core of the job, such as daily executive-level collaboration, sales, or front-line care.',
    },
  },
  hours_band: {
    type: 'choice',
    instructions: 'What weekly workload does `career.work_schedule` and `career.overview` describe as normal for this career?',
    criteria: {
      part_time_common: 'Commonly done part-time, at or below 24 hours a week.',
      reduced_possible: 'Normally 32 to 40 hours; reduced hours or job-sharing are plausible.',
      full_time: 'A normal full-time load of 36 to 45 hours.',
      heavy: 'Regularly 45 to 55 hours, with peaks.',
      extreme_or_on_call: 'Regularly more than 55 hours, or on-call and irregular by nature.',
      not_stated: 'The state does not say.',
    },
  },
  schedule_type: {
    type: 'choice',
    instructions: 'Which pattern best describes the working hours of this career according to `career.work_schedule`?',
    criteria: {
      standard_office: 'Regular office hours on weekdays.',
      flexible: 'Flexible hours, largely self-set.',
      project_deadline: 'Driven by project deadlines with intense periods and quiet periods.',
      irregular_or_on_call: 'Evenings, weekends, shifts, travel, or on-call.',
      not_stated: 'The state does not say.',
    },
  },
  team_scale: {
    type: 'choice',
    instructions: 'What team setting does this career normally involve, based on `career.typical_tasks`, `career.leadership_challenges` and `career.autonomy_vs_collaboration`?',
    criteria: {
      solo: 'Works largely alone.',
      small_team: 'Works in or leads a small team of up to about five people.',
      large_team: 'Works in a large team or manages ten or more people, or coordinates across departments.',
    },
  },
  pace_pressure: {
    type: 'choice',
    instructions: 'What pace and pressure does this career normally involve, based on `career.overview`, `career.typical_tasks` and `career.work_schedule`?',
    criteria: {
      steady: 'Predictable pace, few hard deadlines.',
      deadline_driven: 'Periods of pressure around deadlines, otherwise steady.',
      constant_urgency: 'Constant urgency, strict deadlines, unpredictable workload.',
    },
  },
};
const QIDS = Object.keys(QUESTIONS);
// Which state fields each question names: shown next to Jev's answer in the samples.
const SOURCE_FIELDS = Object.fromEntries(QIDS.map((q) => [q, [...QUESTIONS[q].instructions.matchAll(/`career\.(\w+)`/g)].map((m) => m[1])]));

function indexedQuestions(careers) {
  const out = {};
  careers.forEach((c, i) => {
    for (const q of QIDS) {
      const base = QUESTIONS[q];
      out[`${q}_${i}`] = {
        ...base,
        instructions: `About the career in \`careers[${i}]\` ("${c.career_title}"): `
          + base.instructions.replace(/`career\./g, `\`careers[${i}].`).replace(/this career/g, 'that career'),
      };
    }
  });
  return out;
}

// structure_level in code: a lookup on WF2's fixed company_size_type vocabulary
// ("<size> / <type>"). Unknown values fall back to `established`.
export function structureLevel(companySizeType) {
  const s = (companySizeType ?? '').toLowerCase();
  if (/scale-up/.test(s)) return 'dynamic_scale_up';
  if (/startup/.test(s)) return 'early_stage_chaos';
  if (/^own company/.test(s)) return 'early_stage_chaos';
  if (/public sector|^enterprise/.test(s)) return 'highly_bureaucratic';
  return 'established';
}

// ---------------------------------------------------------------------------------------------
const CAREER_FIELDS = [
  'career_title', 'overview', 'company_size_type', 'typical_tasks', 'work_schedule',
  'autonomy_vs_collaboration', 'client_interaction', 'colleague_interaction', 'leadership_challenges', 'pace_of_work',
];

async function selectAll(table, columns, build = (q) => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const [jobs, reports, profiles] = await Promise.all([
  selectAll('enriched_jobs', `id, created_at, report_id, ${CAREER_FIELDS.join(', ')}`,
    (q) => q.gte('created_at', SINCE).not('report_id', 'is', null).order('created_at')),
  selectAll('reports', 'id, user_id'),
  selectAll('profiles', 'id, first_name'),
]);

const titleKey = (t) => (t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const escapeRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// First name, never printed. Whole word, as stored, capitalised and upper case.
function firstNameRegex(name) {
  const s = (name ?? '').trim();
  if (s.length < 2) return null;
  const vs = [...new Set([s, s[0].toUpperCase() + s.slice(1), s.toUpperCase()])].map(escapeRe);
  return new RegExp(`(?<!\\p{L})(?:${vs.join('|')})(?!\\p{L})`, 'u');
}
const userOfReport = new Map(reports.map((r) => [r.id, r.user_id]));
const profileById = new Map(profiles.map((p) => [p.id, p]));

const skipped = { report_deleted: 0, first_name_in_fields: 0, duplicate_title_in_report: 0, over_max_careers: 0 };
const byReport = new Map();
for (const j of jobs) {
  const p = profileById.get(userOfReport.get(j.report_id));
  if (!p) { skipped.report_deleted++; continue; }
  const re = firstNameRegex(p.first_name);
  const text = CAREER_FIELDS.map((f) => (typeof j[f] === 'string' ? j[f] : JSON.stringify(j[f] ?? ''))).join('\n');
  if (re && re.test(text)) { skipped.first_name_in_fields++; continue; }
  if (!byReport.has(j.report_id)) byReport.set(j.report_id, new Map());
  // Reruns of WF2 write the same titles again: keep the latest row per title.
  const m = byReport.get(j.report_id);
  if (m.has(titleKey(j.career_title))) skipped.duplicate_title_in_report++;
  m.set(titleKey(j.career_title), j);
}

const careerState = (j) => Object.fromEntries(CAREER_FIELDS.map((f) => [f, j[f]]));
const prepared = [...byReport.entries()].map(([reportId, m]) => {
  let rows = [...m.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (rows.length > MAX_CAREERS) { skipped.over_max_careers += rows.length - MAX_CAREERS; rows = rows.slice(-MAX_CAREERS); }
  return { report_id: reportId, rows, state: { careers: rows.map(careerState) } };
}).sort((a, b) => a.report_id.localeCompare(b.report_id));

const tok = (x) => Math.ceil(JSON.stringify(x).length / 4);
const projectedBatch = (p) => tok(p.state) + tok(indexedQuestions(p.state.careers)) + 100;
const projectedSplitOne = (j) => tok({ career: careerState(j) }) + tok(QUESTIONS) + 50;
const projectedTotal = prepared.reduce((s, p) => s + projectedBatch(p), 0);
const maxState = Math.max(...prepared.map((p) => tok(p.state)));

console.log(`enriched_jobs rows since ${SINCE}: ${jobs.length} | reports: ${prepared.length} | careers to send: ${prepared.reduce((s, p) => s + p.rows.length, 0)}`);
console.log(`skipped: ${JSON.stringify(skipped)}`);
console.log(`careers per report: ${JSON.stringify(prepared.reduce((a, p) => ((a[p.rows.length] = (a[p.rows.length] ?? 0) + 1), a), {}))}`);
console.log(`batch: projected ~${projectedTotal} input tokens (~$${(projectedTotal * USD_PER_INPUT_TOKEN).toFixed(4)}), largest state ~${maxState} tokens; cap $${CAP_USD}`);

// ---------------------------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
const raw = [];
if (fs.existsSync(RAW_FILE)) {
  for (const line of fs.readFileSync(RAW_FILE, 'utf8').split('\n')) if (line.trim()) raw.push(JSON.parse(line));
}
const batchDone = new Map(raw.filter((r) => r.mode === 'batch').map((r) => [r.report_id, r]));
const splitDone = new Map(raw.filter((r) => r.mode === 'split').map((r) => [r.enriched_job_id, r]));

const append = (rec) => fs.appendFileSync(RAW_FILE, JSON.stringify(rec) + '\n');
let stoppedByCap = false;

async function runPool(tasks, worker) {
  let next = 0, fatal = null;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (!fatal && !stoppedByCap && next < tasks.length) {
      const t = tasks[next++];
      try { await worker(t); } catch (e) {
        console.error(`${t.report_id ?? t.id}: ${e.message}`);
        if (e.status === 401 || e.status === 422) fatal = e;
      }
    }
  }));
  if (fatal) { console.error('STOP: request rejected, see above'); process.exit(1); }
}

if (!DRY) {
  const key = requireEnv('TYPESAFE_API_KEY');
  const guard = new CostGuard(CAP_USD);
  const call = async (projected, payload) => {
    if (!guard.reserve(projected)) { stoppedByCap = true; return null; }
    try {
      const res = await callJev(key, payload);
      guard.settle(projected, res.body.usage?.input_tokens ?? 0);
      return res;
    } catch (e) { guard.settle(projected, 0); throw e; }
  };

  if (!SPLIT) {
    const todo = prepared.filter((p) => !batchDone.has(p.report_id)).slice(0, LIMIT);
    console.log(`batch: already answered ${batchDone.size} | sending now ${todo.length}`);
    await runPool(todo, async (p) => {
      const res = await call(projectedBatch(p), { state: p.state, questions: indexedQuestions(p.state.careers) });
      if (!res) return;
      const rec = {
        mode: 'batch', report_id: p.report_id, enriched_job_ids: p.rows.map((r) => r.id),
        model: res.body.model, ms: Math.round(res.ms), input_tokens: res.body.usage?.input_tokens ?? 0, answers: res.body.answers,
      };
      append(rec); batchDone.set(p.report_id, rec);
      console.log(`  report ${p.report_id.slice(0, 8)}: ${p.rows.length} careers, ${rec.input_tokens} tokens, ${rec.ms} ms`);
    });
  } else {
    // The control report: given, or the first report with 15+ careers that has a batch answer.
    const target = SPLIT === 'auto'
      ? prepared.find((p) => p.rows.length >= 15 && batchDone.has(p.report_id))
      : prepared.find((p) => p.report_id === SPLIT);
    if (!target) throw new Error(`--split: no report found (${SPLIT}); run the batch first`);
    const todo = target.rows.filter((j) => !splitDone.has(j.id));
    console.log(`split: report ${target.report_id.slice(0, 8)}, ${target.rows.length} careers, sending ${todo.length}`);
    await runPool(todo, async (j) => {
      const res = await call(projectedSplitOne(j), { state: { career: careerState(j) }, questions: QUESTIONS });
      if (!res) return;
      const rec = {
        mode: 'split', report_id: target.report_id, enriched_job_id: j.id,
        model: res.body.model, ms: Math.round(res.ms), input_tokens: res.body.usage?.input_tokens ?? 0, answers: res.body.answers,
      };
      append(rec); splitDone.set(j.id, rec);
    });
  }
  if (stoppedByCap) console.error(`STOP: next call would cross the $${CAP_USD} ceiling. Spent $${guard.spentUsd.toFixed(5)}.`);
  console.log(`this run: ${guard.spentTokens} input tokens, $${guard.spentUsd.toFixed(5)}`);
}

// ---------------------------------------------------------------------------------------------
// Analysis: one row per (career, question) from the batch answers.
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const q3 = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? { p25: +quantile(s, 0.25).toFixed(2), p50: +quantile(s, 0.5).toFixed(2), p75: +quantile(s, 0.75).toFixed(2) } : null;
};

const answers = []; // {report_id, job, q, choice, confidence, probabilities}
for (const p of prepared) {
  const rec = batchDone.get(p.report_id);
  if (!rec) continue;
  rec.enriched_job_ids.forEach((id, i) => {
    const job = p.rows.find((r) => r.id === id);
    if (!job) return;
    for (const q of QIDS) {
      const a = rec.answers[`${q}_${i}`];
      if (a) answers.push({ report_id: p.report_id, job, q, choice: a.choice, confidence: a.confidence, probabilities: a.probabilities });
    }
  });
}

// Deterministic sample: the same ten careers per question on every rerun.
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;
const sourceOf = (job, q) => Object.fromEntries(SOURCE_FIELDS[q].map((f) => [f, job[f]]));

const perQuestion = {};
for (const q of QIDS) {
  const rows = answers.filter((a) => a.q === q);
  const options = Object.keys(QUESTIONS[q].criteria);
  const dist = Object.fromEntries(options.map((o) => [o, rows.filter((r) => r.choice === o).length]));
  // Title consistency across reports: one answer per report per title.
  const byTitle = new Map();
  for (const r of rows) {
    const k = titleKey(r.job.career_title);
    if (!byTitle.has(k)) byTitle.set(k, new Map());
    byTitle.get(k).set(r.report_id, r.choice);
  }
  const multi = [...byTitle.entries()].filter(([, m]) => m.size >= 2);
  const same = multi.filter(([, m]) => new Set(m.values()).size === 1);
  perQuestion[q] = {
    n: rows.length,
    distribution: dist,
    distribution_pct: Object.fromEntries(options.map((o) => [o, pct(dist[o], rows.length)])),
    never_chosen: options.filter((o) => dist[o] === 0),
    dominant_over_80pct: options.filter((o) => dist[o] / rows.length > 0.8),
    confidence: q3(rows.map((r) => r.confidence)),
    confidence_per_choice: Object.fromEntries(options.filter((o) => dist[o]).map((o) => [o, q3(rows.filter((r) => r.choice === o).map((r) => r.confidence))])),
    low_confidence_below_0_5: rows.filter((r) => r.confidence < 0.5).length,
    title_consistency: {
      titles_in_2plus_reports: multi.length,
      same_band_everywhere: same.length,
      same_band_pct: pct(same.length, multi.length),
      examples: multi.slice(0, 10).map(([t, m]) => ({ title: t, bands: [...m.values()] })),
    },
    samples: [...rows].sort((a, b) => hash(a.job.id + q) - hash(b.job.id + q)).slice(0, 10).map((r) => ({
      title: r.job.career_title, jev: r.choice, confidence: +r.confidence.toFixed(2),
      probabilities: r.probabilities, source: sourceOf(r.job, q),
    })),
  };
}

// structure_level in code, for its distribution only.
const allRows = prepared.flatMap((p) => p.rows);
const structureDist = allRows.reduce((a, j) => ((a[structureLevel(j.company_size_type)] = (a[structureLevel(j.company_size_type)] ?? 0) + 1), a), {});
const structureTable = [...new Set(allRows.map((j) => j.company_size_type))].sort().map((v) => ({ company_size_type: v, structure_level: structureLevel(v) }));

// Split control: same report, one request per career vs one request for all.
let splitCheck = null;
const splitReports = [...new Set([...splitDone.values()].map((r) => r.report_id))];
if (splitReports.length) {
  const rid = splitReports[0];
  const batch = batchDone.get(rid);
  const cmp = [];
  for (const s of [...splitDone.values()].filter((r) => r.report_id === rid)) {
    const i = batch.enriched_job_ids.indexOf(s.enriched_job_id);
    if (i < 0) continue;
    const title = prepared.find((p) => p.report_id === rid).rows.find((r) => r.id === s.enriched_job_id)?.career_title;
    for (const q of QIDS) {
      const b = batch.answers[`${q}_${i}`], o = s.answers[q];
      if (b && o) cmp.push({ title, q, batch: b.choice, split: o.choice, batch_conf: b.confidence, split_conf: o.confidence });
    }
  }
  splitCheck = {
    report: rid.slice(0, 8),
    careers: new Set(cmp.map((c) => c.title)).size,
    per_question: Object.fromEntries(QIDS.map((q) => {
      const c = cmp.filter((x) => x.q === q);
      return [q, {
        n: c.length,
        same_choice_pct: pct(c.filter((x) => x.batch === x.split).length, c.length),
        confidence_batch: q3(c.map((x) => x.batch_conf)),
        confidence_split: q3(c.map((x) => x.split_conf)),
      }];
    })),
    same_choice_total_pct: pct(cmp.filter((x) => x.batch === x.split).length, cmp.length),
    differences: cmp.filter((x) => x.batch !== x.split).map((x) => ({ ...x, batch_conf: +x.batch_conf.toFixed(2), split_conf: +x.split_conf.toFixed(2) })),
    split_tokens_total: [...splitDone.values()].filter((r) => r.report_id === rid).reduce((s, r) => s + r.input_tokens, 0),
    split_ms: q3([...splitDone.values()].filter((r) => r.report_id === rid).map((r) => r.ms)),
  };
}

const batches = [...batchDone.values()];
const summary = {
  generated_at: new Date().toISOString(),
  model_pinned: JEV_MODEL,
  models_seen: [...new Set(raw.map((r) => r.model))],
  reports: prepared.length,
  reports_answered: batches.length,
  careers_answered: answers.length / QIDS.length,
  skipped,
  batch_tokens: { total: batches.reduce((s, r) => s + r.input_tokens, 0), per_request: q3(batches.map((r) => r.input_tokens)) },
  batch_ms: q3(batches.map((r) => r.ms)),
  cost_usd_all_raw: +(raw.reduce((s, r) => s + r.input_tokens, 0) * USD_PER_INPUT_TOKEN).toFixed(5),
  per_question: perQuestion,
  structure_level_in_code: { distribution: structureDist, table: structureTable },
  split_check: splitCheck,
};
const file = writeJson(OUT, `jev-career-traits-summary${DRY ? '-dry' : ''}.json`, summary);
console.log(JSON.stringify({ ...summary, per_question: Object.fromEntries(Object.entries(perQuestion).map(([q, v]) => [q, { ...v, samples: `${v.samples.length} samples` }])) }, null, 2));
console.log(`summary: ${file}`);
