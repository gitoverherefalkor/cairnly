// Offline rehearsal of the AI-impact switch (docs/ai-impact-pill-proposal-2026-10-15.md).
//
// For a handful of reports: the label each career carries today (stored enriched_jobs.ai_impact_rating,
// normalised the way the frontend does, plus the pill actually shown on top-3 / runner-up cards) next to
// the label the `ai-impact` edge function WOULD write. The rules are imported from the production file
// supabase/functions/_shared/aiImpactRules.ts, so this is the same logic as the edge function's dry_run.
//
// Read-only against production (SELECTs with the service-role key). Nothing is written to Supabase or
// n8n. Only job information goes to TypeSafe (title, overview, tasks, size type, path type, research).
//
// Run (Node 22 needs the flag to import the .ts rules file):
//   node --experimental-strip-types scripts/jev-ai-impact-rehearse.mjs \
//     --env-root "<main checkout with .env.local>" --out <dir> --reports id1,id2,...
// A rerun reuses <out>/rehearse-raw.jsonl, so re-analysis is free.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { CostGuard, USD_PER_INPUT_TOKEN, callJev, loadEnvLocal, parseArgs, requireEnv, writeJson } from './jev-shared.mjs';
import {
  AI_IMPACT_QUESTIONS, blockedFromTop3, designLabel, jevState, ownershipOf,
} from '../supabase/functions/_shared/aiImpactRules.ts';

const args = parseArgs();
const OUT = args.out ?? 'scratchpad';
const REPORTS = String(args.reports ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!REPORTS.length) throw new Error('--reports id1,id2 required');
const CAP_USD = 0.05;
const RAW = path.join(OUT, 'rehearse-raw.jsonl');
loadEnvLocal(args['env-root'] ?? process.cwd());
const sb = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// The frontend's alias table, read from CareerScoreCard.tsx (same trick as jev-ai-impact.mjs).
const cardSrc = fs.readFileSync('src/components/chat/CareerScoreCard.tsx', 'utf8');
const aliasBlock = cardSrc.match(/const AI_IMPACT_ALIASES[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1];
const ALIASES = {};
for (const m of aliasBlock.matchAll(/^\s*(?:'([^']+)'|([a-z_]+))\s*:\s*'(\w+)'/gm)) ALIASES[m[1] ?? m[2]] = m[3];
const alias = (w) => ALIASES[String(w ?? '').toLowerCase().replace(/\s+/g, ' ').trim()] ?? null;

const parseIfString = (v) => { try { return typeof v === 'string' && v.trim().startsWith('{') ? JSON.parse(v) : v; } catch { return v; } };
const storedRaw = (v) => { const p = parseIfString(v); return p && typeof p === 'object' ? String(p.rating ?? '') : (v ?? ''); };
const titleKey = (t) => String(t ?? '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// The pill on a card: the label right under "How AI will impact this role" (first pattern of extractAIImpact).
const shownPill = (content) => {
  const m = String(content ?? '').replace(/<[^>]+>/g, ' ')
    .match(/(?:how ai will impact|ai impact on)[^\n]*\n+\s*\*{0,2}([a-z ]+?)\*{0,2}\s*[:\-.(]/i);
  return m ? alias(m[1]) : null;
};

const [jobsRes, researchRes, sectionsRes, reportsRes] = await Promise.all([
  sb.from('enriched_jobs').select('id, report_id, created_at, career_title, overview, typical_tasks, company_size_type, path_type, ai_impact_rating').in('report_id', REPORTS),
  sb.from('ai_research').select('key_findings').eq('is_active', true).order('published_date', { ascending: false }).limit(1),
  sb.from('report_sections').select('report_id, section_type, title, content').in('report_id', REPORTS).in('section_type', ['top_career_1', 'top_career_2', 'top_career_3', 'runner_ups']),
  sb.from('reports').select('id, user_id, created_at').in('id', REPORTS),
]);
for (const r of [jobsRes, researchRes, sectionsRes, reportsRes]) if (r.error) throw new Error(r.error.message);
const research = researchRes.data[0]?.key_findings ?? null;
const userOf = new Map(reportsRes.data.map((r) => [r.id, r.user_id]));
const shown = new Map(); // report|titleKey -> { slot, pill }
for (const s of sectionsRes.data) shown.set(`${s.report_id}|${titleKey(s.title)}`, { slot: s.section_type === 'runner_ups' ? 'runner_up' : 'top3', pill: shownPill(s.content) });

fs.mkdirSync(OUT, { recursive: true });
const done = new Map();
if (fs.existsSync(RAW)) for (const l of fs.readFileSync(RAW, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); done.set(r.id, r); }

const key = requireEnv('TYPESAFE_API_KEY');
const guard = new CostGuard(CAP_USD);
const todo = jobsRes.data.filter((j) => !done.has(j.id));
console.log(`rows ${jobsRes.data.length} | cached ${done.size} | sending ${todo.length}`);
let next = 0;
const worker = async () => {
  while (next < todo.length) {
    const j = todo[next++];
    const state = jevState(j, research);
    const reserve = Math.ceil(JSON.stringify({ state, AI_IMPACT_QUESTIONS }).length / 4) + 100;
    if (!guard.reserve(reserve)) return;
    try {
      const { body, ms } = await callJev(key, { state, questions: AI_IMPACT_QUESTIONS });
      guard.settle(reserve, body.usage?.input_tokens ?? 0);
      const rec = { id: j.id, ms: Math.round(ms), tokens: body.usage?.input_tokens ?? 0, model: body.model, answers: body.answers };
      fs.appendFileSync(RAW, JSON.stringify(rec) + '\n');
      done.set(j.id, rec);
    } catch (e) { guard.settle(reserve, 0); console.error(`row ${j.id}: ${e.message}`); }
  }
};
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`spent this run: ${guard.spentTokens} tokens, $${guard.spentUsd.toFixed(5)}`);

const rows = jobsRes.data.map((j) => {
  const rec = done.get(j.id);
  const lab = rec ? designLabel(rec.answers) : null;
  const own = ownershipOf(j);
  const s = shown.get(`${j.report_id}|${titleKey(j.career_title)}`);
  return {
    report_id: j.report_id, user: userOf.get(j.report_id) === '6f91a359-f9a5-42c9-8d07-192f431c50ef' ? 'stuart' : 'other',
    title: j.career_title, title_key: titleKey(j.career_title), path_type: j.path_type, ownership: own,
    stored_raw: storedRaw(j.ai_impact_rating), stored: alias(storedRaw(j.ai_impact_rating)),
    slot: s?.slot ?? null, pill_shown: s?.pill ?? null,
    jev: lab?.label ?? null, rule: lab?.rule ?? null, score: rec?.answers?.ai_impact?.score ?? null,
    confidence: rec?.answers?.ai_impact?.confidence ?? null, ms: rec?.ms ?? null, tokens: rec?.tokens ?? null,
    top3_ban: lab ? blockedFromTop3(lab.label, own) : null,
  };
});

// Per-title consistency: titles seen in 2+ reports; share whose label is identical in every report.
function consistency(field) {
  const by = new Map();
  for (const r of rows) if (r[field]) { if (!by.has(r.title_key)) by.set(r.title_key, []); by.get(r.title_key).push(r[field]); }
  const multi = [...by.entries()].filter(([, v]) => v.length >= 2);
  const same = multi.filter(([, v]) => new Set(v).size === 1).length;
  return { titles_in_2plus_reports: multi.length, same_label_everywhere: same, pct: multi.length ? Math.round((100 * same) / multi.length) : null,
    unstable: multi.filter(([, v]) => new Set(v).size > 1).map(([k, v]) => `${k}: ${v.join('/')}`) };
}
const dist = (field) => rows.reduce((a, r) => ((a[r[field] ?? 'none'] = (a[r[field] ?? 'none'] ?? 0) + 1), a), {});
const pilled = rows.filter((r) => r.pill_shown && r.jev);
const summary = {
  reports: REPORTS.length, rows: rows.length, answered: rows.filter((r) => r.jev).length,
  stored_raw_words: dist('stored_raw'),
  dist_stored: dist('stored'), dist_jev: dist('jev'),
  stored_vs_jev_same: rows.filter((r) => r.stored && r.jev && r.stored === r.jev).length,
  cards_with_pill: pilled.length,
  pill_vs_stored_same: pilled.filter((r) => r.pill_shown === r.stored).length,
  pill_vs_jev_same: pilled.filter((r) => r.pill_shown === r.jev).length,
  consistency_stored: consistency('stored'), consistency_pill: consistency('pill_shown'), consistency_jev: consistency('jev'),
  top3_ban_hits: rows.filter((r) => r.top3_ban).map((r) => `${r.title} (${r.slot ?? 'not shown'})`),
  top3_cards_that_would_be_banned: rows.filter((r) => r.top3_ban && r.slot === 'top3').length,
  latency_ms_p50: (() => { const v = rows.map((r) => r.ms).filter(Boolean).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? null; })(),
  usd_per_report: +((rows.reduce((a, r) => a + (r.tokens ?? 0), 0) * USD_PER_INPUT_TOKEN) / REPORTS.length).toFixed(5),
};
writeJson(OUT, 'rehearse-rows.json', rows);
writeJson(OUT, 'rehearse-summary.json', summary);
console.log(JSON.stringify(summary, null, 2));
