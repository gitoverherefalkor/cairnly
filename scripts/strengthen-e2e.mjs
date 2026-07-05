// Live E2E for the Résumé Strengthen chain:
//   edge fn (analyze) → WF10 analyze → strength_review ready
//   → edge fn (apply, 1 one-tap [+1 needs_input if present]) → row patched, score up
// Operates ONLY on a cloned copy of one of the TEST USER'S OWN completed résumés;
// the clone is deleted at the end, on failure, and on early exit.
// Run: set -a; source .env; source .env.local; set +a; node scripts/strengthen-e2e.mjs
//   (needs .env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
//    and .env.local: TEST_USER_PASSWORD, SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = 'sjn.geurts@gmail.com';
const PASS = process.env.TEST_USER_PASSWORD;
const TIMEOUT_MS = 120_000;

// fail() throws so the top-level catch/finally always reports AND cleans up.
// (An earlier version used process.exit(), which skips finally and leaked
// test rows on failed runs.)
const fail = (msg) => { throw new Error(msg); };
const ok = (msg) => console.log('✅', msg);

// n8n's Supabase nodes write jsonb via JSON.stringify → PostgREST stores a
// jsonb STRING primitive, not an object (house pattern; the frontend's
// parseIfString mirrors this). Normalize every jsonb read.
const parseIfString = (v) => {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v ?? null;
};

// Two clients: `admin` (service role) ONLY for test-row setup/cleanup/polling —
// client-side inserts into custom_resumes may be blocked by RLS since prod
// writes go through edge functions. `sb` (user session) makes the actual
// resume-strengthen calls, which is the surface under test.
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sb = createClient(URL, ANON);

let cloneId = null;
const cleanup = async () => {
  if (!cloneId) return;
  await admin.from('custom_resumes').delete().eq('id', cloneId);
  cloneId = null;
  ok('test row cleaned up');
};

try {
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS });
  if (authErr) fail(`sign-in: ${authErr.message}`);
  ok('signed in as test user');

  // 1. Clone one of the TEST USER'S completed resume rows. The user_id filter
  // is load-bearing: without it the service-role client would pick the most
  // recent completed row platform-wide, i.e. potentially a real customer's.
  const { data: source } = await admin.from('custom_resumes')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('status', 'completed')
    .not('career_title', 'like', '%(E2E TEST)%')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (!source) fail('no completed resume to clone for the test user');
  const { data: clone, error: cloneErr } = await admin.from('custom_resumes').insert({
    user_id: source.user_id, report_id: source.report_id,
    career_section_id: source.career_section_id,
    career_title: `${source.career_title} (E2E TEST)`,
    template_id: source.template_id, resume_json: source.resume_json,
    ats_score: source.ats_score, keyword_coverage: source.keyword_coverage,
    status: 'completed',
  }).select().single();
  if (cloneErr) fail(`clone: ${cloneErr.message}`);
  cloneId = clone.id;
  ok(`cloned test row ${clone.id}`);

  // 2. Analyze
  const { error: aErr } = await sb.functions.invoke('resume-strengthen', {
    body: { action: 'analyze', custom_resume_id: clone.id },
  });
  if (aErr) fail(`analyze invoke: ${aErr.message}`);
  ok('analyze fired');

  // 3. Poll until ready
  let review = null;
  for (const start = Date.now(); Date.now() - start < TIMEOUT_MS;) {
    await new Promise((r) => setTimeout(r, 5000));
    const { data } = await admin.from('custom_resumes').select('strength_review').eq('id', clone.id).single();
    review = parseIfString(data?.strength_review);
    if (review?.status === 'ready' || review?.status === 'failed') break;
  }
  if (review?.status !== 'ready') fail(`review not ready: ${JSON.stringify(review)?.slice(0, 300)}`);
  ok(`review ready: score ${review.score}, ${review.issues.length} issues`);

  // 4. Shape assertions
  if (review.issues.length > 7) fail('more than 7 issues surfaced');
  if (review.score_potential > 100) fail('score_potential > 100');
  for (const i of review.issues) {
    if (!['you_had_to_be_there', 'naked_number', 'jargon', 'adjective_skill'].includes(i.flag)) fail(`bad flag ${i.flag}`);
    if (i.card_type === 'one_tap' && !i.suggested_text) fail(`one_tap without suggestion: ${i.id}`);
    if (i.card_type === 'needs_input' && (!i.question || !i.example || !i.preview_template?.includes('{answer}')))
      fail(`needs_input incomplete: ${i.id}`);
  }
  ok('issue shapes valid');

  // 5. Apply: first one_tap (+ first needs_input with a synthetic detail)
  const oneTap = review.issues.find((i) => i.card_type === 'one_tap');
  const needsInput = review.issues.find((i) => i.card_type === 'needs_input');
  const decisions = [];
  if (oneTap) decisions.push({ id: oneTap.id, action: 'apply' });
  // Use the issue's own example as the answer (the UI's "Use this example"
  // flow). A mismatched synthetic answer gets refused by the compose LLM's
  // anti-fabrication guard — line: null — which is correct behavior but not
  // what this test is probing.
  if (needsInput) decisions.push({ id: needsInput.id, action: 'apply', user_input: needsInput.example });

  if (decisions.length === 0) {
    ok('résumé came back recruiter-ready (0 issues) — apply path skipped');
  } else {
    const before = structuredClone(parseIfString(clone.resume_json));
    const { error: pErr } = await sb.functions.invoke('resume-strengthen', {
      body: { action: 'apply', custom_resume_id: clone.id, decisions },
    });
    if (pErr) fail(`apply invoke: ${pErr.message}`);

    // 6. Poll for final state (sync if no needs_input, else compose roundtrip)
    let finalRow = null;
    for (const start = Date.now(); Date.now() - start < TIMEOUT_MS;) {
      const { data } = await admin.from('custom_resumes').select('resume_json, strength_review').eq('id', clone.id).single();
      const sr = parseIfString(data?.strength_review);
      if (sr?.status === 'ready') { finalRow = { resume_json: parseIfString(data.resume_json), strength_review: sr }; break; }
      await new Promise((r) => setTimeout(r, 5000));
    }
    if (!finalRow) fail('apply did not settle to ready in time');

    const fr = finalRow.strength_review;
    if (fr.score <= review.score) fail(`score did not rise: ${review.score} → ${fr.score}`);
    const applied = fr.issues.filter((i) => i.status === 'applied').map((i) => i.id);
    for (const d of decisions) if (!applied.includes(d.id)) fail(`decision ${d.id} not applied`);
    if (JSON.stringify(finalRow.resume_json) === JSON.stringify(before)) fail('resume_json unchanged');
    ok(`apply verified: score ${review.score} → ${fr.score}, ${applied.length} lines rewritten`);
  }

  console.log('\n🎉 E2E PASSED');
} catch (e) {
  console.error('❌', e.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}
