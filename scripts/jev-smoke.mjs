// Jev smoke test: 100 calls with a made-up state (no user data), model pinned to jev-1.13.0.
// Reports p50/p95 latency, the model version the API answered with, and token usage.
// Cost ceiling $0.10: the run stops before a call that would cross it.
//
// Latency is measured from wherever this runs (a laptop, not an edge function in eu-west-1),
// one call at a time, so it includes the local network leg.
//
// Run:   node scripts/jev-smoke.mjs [--n 100] [--out <dir>] [--dry-run]
import {
  JEV_MODEL, USD_PER_INPUT_TOKEN, CostGuard, callJev, loadEnvLocal, parseArgs, quantile, requireEnv, writeJson,
} from './jev-shared.mjs';

const args = parseArgs();
const N = Number(args.n ?? 100);
const CAP_USD = 0.10;
const OUT = args.out ?? 'scratchpad';

// Invented coaching turn. No real person, report or chat is involved.
const state = {
  current_section: 'top_career_2',
  coach_last_message: 'That covers the second match, Product Operations Lead. Ready to move on to the third one?',
  user_message: 'Honestly the ops side sounds a bit dull, but fine, let us see the next one.',
};

const questions = {
  turn_type: {
    type: 'choice',
    instructions: 'What is the user doing in `user_message`, read against `coach_last_message`?',
    criteria: {
      advance: 'Wants to move to the next section.',
      question: 'Asks a question.',
      pushback: 'Rejects or criticises the suggestion.',
      acknowledgement: 'Thanks or small talk.',
    },
  },
  mild_dislike: {
    type: 'noul',
    instructions: 'Does `user_message` express a mild dislike of the career without rejecting it outright?',
  },
  enthusiasm: {
    type: 'score',
    instructions: 'How enthusiastic is the user about the career discussed?',
    criteria: ['Rejects it.', 'Lukewarm or indifferent.', 'Interested.', 'Clearly excited.'],
  },
};

const projectedTokens = Math.ceil(JSON.stringify({ state, questions }).length / 4) + 200;
console.log(`model ${JEV_MODEL} | ${N} calls | projected ~${projectedTokens} input tokens per call`);
if (args['dry-run']) {
  console.log(`dry run: projected total ~${projectedTokens * N} tokens, $${(projectedTokens * N * USD_PER_INPUT_TOKEN).toFixed(4)}; nothing sent`);
  process.exit(0);
}

loadEnvLocal();
const key = requireEnv('TYPESAFE_API_KEY');
const guard = new CostGuard(CAP_USD);
const rows = [];

for (let i = 0; i < N; i++) {
  const reserve = Math.max(projectedTokens, ...rows.map((r) => r.input_tokens));
  if (!guard.reserve(reserve)) {
    console.error(`STOP at call ${i}: next call would cross the $${CAP_USD} ceiling (spent $${guard.spentUsd.toFixed(5)})`);
    break;
  }
  try {
    const { body, ms } = await callJev(key, { state, questions });
    const input = body.usage?.input_tokens ?? 0;
    guard.settle(reserve, input);
    rows.push({ i, ms, model: body.model, input_tokens: input, output_tokens: body.usage?.output_tokens ?? 0, answers: body.answers });
  } catch (e) {
    guard.settle(reserve, 0);
    console.error(`call ${i} failed: ${e.message}`);
    if (e.status === 401 || e.status === 422) process.exit(1); // key or request shape wrong: no point continuing
    rows.push({ i, error: e.message });
  }
}

const ok = rows.filter((r) => !r.error);
const lat = ok.map((r) => r.ms).sort((a, b) => a - b);
const models = [...new Set(ok.map((r) => r.model))];
const inTok = ok.map((r) => r.input_tokens);
const summary = {
  pinned: JEV_MODEL,
  answered_by: models,
  calls_ok: ok.length,
  calls_failed: rows.length - ok.length,
  latency_ms: {
    p50: Math.round(quantile(lat, 0.5)),
    p95: Math.round(quantile(lat, 0.95)),
    min: Math.round(lat[0]),
    max: Math.round(lat[lat.length - 1]),
    first_call: Math.round(ok[0]?.ms ?? NaN),
  },
  input_tokens_per_call: { min: Math.min(...inTok), max: Math.max(...inTok) },
  output_tokens_total: ok.reduce((s, r) => s + r.output_tokens, 0),
  input_tokens_total: guard.spentTokens,
  cost_usd: Number(guard.spentUsd.toFixed(6)),
  answers_identical_across_calls: new Set(ok.map((r) => JSON.stringify(r.answers))).size === 1,
};

console.log(JSON.stringify(summary, null, 2));
const file = writeJson(OUT, `jev-smoke-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`, { summary, rows });
console.log(`raw responses: ${file}`);
