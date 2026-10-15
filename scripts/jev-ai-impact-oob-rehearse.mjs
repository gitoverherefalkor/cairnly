// Offline rehearsal: Jev AI-impact labels for outside-the-box and dream-job cards
// (docs/ai-impact-oob-dream-proposal-2026-10-15.md).
//
// These careers are not in enriched_jobs: WF3 / WF4 write them as card text and the LLM picks the
// AI word itself. This script reads the cards of the given user's reports (report_sections
// outside_box / dream_jobs), takes the word the frontend would show today, and asks Jev the same
// three questions with the same production rules (supabase/functions/_shared/aiImpactRules.ts).
//
// Two input variants per card, so we can see what the card text adds:
//   T = title + company type + path type only (what the card's title line says)
//   O = T + the card's own "Overview" paragraph (outside-the-box only; the dream overview is about the
//       person, not the job, so dream cards only get T)
// Then a title pin is simulated: the first label per normalised title + ownership, in report order.
//
// Read-only against production. Only the job title / company type / path type / overview go to
// TypeSafe. Run:
//   node --experimental-strip-types scripts/jev-ai-impact-oob-rehearse.mjs \
//     --env-root "<main checkout with .env.local>" --out <dir> --user <uuid> [--since 2026-10-13]
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { CostGuard, USD_PER_INPUT_TOKEN, callJev, loadEnvLocal, parseArgs, requireEnv, writeJson } from './jev-shared.mjs';
import { AI_IMPACT_QUESTIONS, designLabel, ownershipOf } from '../supabase/functions/_shared/aiImpactRules.ts';

const args = parseArgs();
const OUT = args.out ?? 'scratchpad';
const USER = args.user;
const SINCE = args.since ?? '2026-10-13';
if (!USER) throw new Error('--user <uuid> required');
const RAW = path.join(OUT, 'oob-rehearse-raw.jsonl');
loadEnvLocal(args['env-root'] ?? process.cwd());
const sb = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// Frontend alias table (CareerScoreCard.tsx), so "today" is what the pill shows.
const cardSrc = fs.readFileSync('src/components/chat/CareerScoreCard.tsx', 'utf8');
const aliasBlock = cardSrc.match(/const AI_IMPACT_ALIASES[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1];
const ALIASES = {};
for (const m of aliasBlock.matchAll(/^\s*(?:'([^']+)'|([a-z_]+))\s*:\s*'(\w+)'/gm)) ALIASES[m[1] ?? m[2]] = m[3];
const alias = (w) => ALIASES[String(w ?? '').toLowerCase().replace(/\s+/g, ' ').trim()] ?? null;
const WORD = '(minimal|moderate|high|severe|critical|safe|augmented|transforming|at\\s*risk|low|medium|substantial)';

const strip = (h) => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim();
const normTitle = (t) => strip(t).toLowerCase().replace(/\s+/g, ' ').trim();
const subsection = (content, heading) => {
  const m = String(content).match(new RegExp(`<h5>${heading}</h5>([\\s\\S]*?)(?=<h5>|$)`, 'i'));
  return m ? strip(m[1]) : null;
};
// Today's word: OOB "AI Impact on this role" section, dream "AI Impact (Rating: X)" bullet.
function todayWord(type, content) {
  const t = strip(content);
  const re = type === 'outside_box'
    ? new RegExp(`AI Impact on this role\\s*(?:Rating\\s*:\\s*)?\\*{0,2}${WORD}\\b`, 'i')
    : new RegExp(`AI Impact[\\s:(]*(?:Rating(?:\\s*Scale)?\\s*:\\s*)?\\*{0,2}${WORD}\\b`, 'i');
  const m = t.match(re);
  return m ? alias(m[1]) : null;
}
// path_type for OOB from the "Path Type & Reality" section's first word.
function pathTypeOf(content) {
  const p = (subsection(content, 'Path Type &(?:amp;)? Reality') ?? '').toLowerCase();
  if (/^\s*founder/.test(p)) return 'founder';
  if (/^\s*(freelance|independent|fractional)/.test(p)) return 'freelance_fractional';
  if (/^\s*employee/.test(p)) return 'employee';
  return null;
}

const { data: reports, error: rErr } = await sb.from('reports').select('id, created_at').eq('user_id', USER).gte('created_at', SINCE).order('created_at');
if (rErr) throw new Error(rErr.message);
const { data: sections, error: sErr } = await sb.from('report_sections')
  .select('id, report_id, section_type, order_number, title, company_size_type, content')
  .in('report_id', reports.map((r) => r.id)).in('section_type', ['outside_box', 'dream_jobs']);
if (sErr) throw new Error(sErr.message);
const { data: research } = await sb.from('ai_research').select('key_findings').eq('is_active', true).order('published_date', { ascending: false }).limit(1);
const keyFindings = research?.[0]?.key_findings ?? null;
const reportOrder = new Map(reports.map((r, i) => [r.id, i]));
sections.sort((a, b) => reportOrder.get(a.report_id) - reportOrder.get(b.report_id) || a.section_type.localeCompare(b.section_type) || a.order_number - b.order_number);

const cards = sections.map((s) => {
  const path_type = s.section_type === 'outside_box' ? pathTypeOf(s.content) : null;
  const base = { title: strip(s.title), company_size_type: s.company_size_type ?? null, path_type, research: keyFindings };
  const overview = s.section_type === 'outside_box' ? subsection(s.content, 'Overview') : null;
  return {
    id: s.id, report_id: s.report_id, type: s.section_type, title: base.title, title_key: normTitle(s.title),
    company_size_type: base.company_size_type, path_type, ownership: ownershipOf(base),
    today: todayWord(s.section_type, s.content),
    states: { T: { ...base, overview: null, typical_tasks: null }, ...(overview ? { O: { ...base, overview, typical_tasks: null } } : {}) },
  };
});

fs.mkdirSync(OUT, { recursive: true });
const done = new Map();
if (fs.existsSync(RAW)) for (const l of fs.readFileSync(RAW, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); done.set(r.key, r); }
const jobs = cards.flatMap((c) => Object.entries(c.states).map(([v, state]) => ({ key: `${c.id}|${v}`, state }))).filter((j) => !done.has(j.key));
const key = requireEnv('TYPESAFE_API_KEY');
const guard = new CostGuard(0.05);
console.log(`cards ${cards.length} | calls to make ${jobs.length} (cached ${done.size})`);
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < jobs.length) {
    const j = jobs[next++];
    const reserve = Math.ceil(JSON.stringify(j.state).length / 4) + 600;
    if (!guard.reserve(reserve)) return;
    try {
      const { body, ms } = await callJev(key, { state: j.state, questions: AI_IMPACT_QUESTIONS });
      guard.settle(reserve, body.usage?.input_tokens ?? 0);
      const rec = { key: j.key, ms: Math.round(ms), tokens: body.usage?.input_tokens ?? 0, answers: body.answers };
      fs.appendFileSync(RAW, JSON.stringify(rec) + '\n');
      done.set(j.key, rec);
    } catch (e) { guard.settle(reserve, 0); console.error(`${j.key}: ${e.message}`); }
  }
}));
console.log(`spent this run $${guard.spentUsd.toFixed(5)}`);

const rows = cards.map((c) => {
  const out = { report_id: c.report_id, type: c.type, title: c.title, title_key: c.title_key, ownership: c.ownership, path_type: c.path_type, company: c.company_size_type, today: c.today };
  for (const v of ['T', 'O']) {
    const rec = done.get(`${c.id}|${v}`);
    if (!rec) continue;
    const l = designLabel(rec.answers, c.ownership);
    out[`jev_${v}`] = l.label; out[`rule_${v}`] = l.rule;
    out[`score_${v}`] = Math.round(rec.answers.ai_impact.score * 100) / 100;
    out[`phys_${v}`] = Math.round(rec.answers.physical_role.noul * 100) / 100;
    out[`ms_${v}`] = rec.ms; out[`tok_${v}`] = rec.tokens;
  }
  return out;
});
// Title pin simulation: first label per title + ownership in report order.
for (const v of ['T', 'O']) {
  const first = new Map();
  for (const r of rows) {
    if (!r[`jev_${v}`]) continue;
    const k = `${r.title_key}|${r.ownership}`;
    if (!first.has(k)) first.set(k, r[`jev_${v}`]);
    r[`pin_${v}`] = first.get(k);
  }
}

function consistency(field, type) {
  const by = new Map();
  for (const r of rows) if (r.type === type && r[field]) { if (!by.has(r.title_key)) by.set(r.title_key, []); by.get(r.title_key).push(r[field]); }
  const multi = [...by.entries()].filter(([, v]) => v.length >= 2);
  const same = multi.filter(([, v]) => new Set(v).size === 1).length;
  return { titles: multi.length, same, unstable: multi.filter(([, v]) => new Set(v).size > 1).map(([k, v]) => `${k}: ${v.join('/')}`) };
}
const dist = (field, type) => rows.filter((r) => r.type === type).reduce((a, r) => ((a[r[field] ?? 'none'] = (a[r[field] ?? 'none'] ?? 0) + 1), a), {});
const summary = {};
for (const type of ['outside_box', 'dream_jobs']) {
  const fields = type === 'outside_box' ? ['today', 'jev_T', 'jev_O', 'pin_O'] : ['today', 'jev_T', 'pin_T'];
  summary[type] = {
    cards: rows.filter((r) => r.type === type).length,
    distribution: Object.fromEntries(fields.map((f) => [f, dist(f, type)])),
    consistency: Object.fromEntries(fields.map((f) => [f, consistency(f, type)])),
    today_vs_jev: rows.filter((r) => r.type === type).reduce((a, r) => { const j = r.jev_O ?? r.jev_T; const k = `${r.today}->${j}`; a[k] = (a[k] ?? 0) + 1; return a; }, {}),
  };
}
const toks = rows.reduce((a, r) => a + (r.tok_O ?? r.tok_T ?? 0), 0);
summary.usd_per_report_one_variant = +((toks * USD_PER_INPUT_TOKEN) / reports.length).toFixed(5);
summary.reports = reports.length;
writeJson(OUT, 'oob-rehearse-rows.json', rows);
writeJson(OUT, 'oob-rehearse-summary.json', summary);
console.log(JSON.stringify(summary, null, 2));
