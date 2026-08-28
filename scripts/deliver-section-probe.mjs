// Live probe for deliver-section after the language-contract change.
// Signs in as the TEST USER, delivers one section of their own report through
// the real edge function, and asserts the response is coherent: 200, non-empty
// markdown, English boilerplate for an English profile, no language mixing.
// Read-mostly: the only writes are the normal chat-history rows on the TEST
// user's own report (what every real delivery writes).
// Run: set -a; source .env; source .env.local; set +a; node scripts/deliver-section-probe.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = 'sjn.geurts@gmail.com';
const PASS = process.env.TEST_USER_PASSWORD;

const fail = (msg) => { throw new Error(msg); };

const sb = createClient(URL, ANON);
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASS });
if (authErr) fail(`login failed: ${authErr.message}`);
console.log('signed in as test user');

const { data: reports, error: repErr } = await sb
  .from('reports')
  .select('id, status, created_at')
  .order('created_at', { ascending: false })
  .limit(1);
if (repErr || !reports?.length) fail(`no report found: ${repErr?.message}`);
const report = reports[0];
console.log(`report ${report.id} (${report.status})`);

const resp = await fetch(`${URL}/functions/v1/deliver-section`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${auth.session.access_token}`,
    apikey: ANON,
  },
  body: JSON.stringify({ report_id: report.id, section_type: 'approach', skip_history_user_write: true }),
});
const body = await resp.json().catch(() => ({}));
if (resp.status !== 200) fail(`deliver-section -> ${resp.status}: ${JSON.stringify(body).slice(0, 300)}`);
const content = body.content ?? '';
if (content.length < 200) fail(`content suspiciously short (${content.length} chars)`);

// English profile -> English boilerplate ("dive into your personality profile")
const hasEnIntro = /personality profile/i.test(content);
// and no Dutch boilerplate leaking in
const hasNlIntro = /persoonlijkheidsprofiel/i.test(content);
console.log(`content: ${content.length} chars | EN intro: ${hasEnIntro} | NL leak: ${hasNlIntro}`);
if (!hasEnIntro || hasNlIntro) fail('boilerplate language check failed');
console.log('deliver-section probe PASSED');
await sb.auth.signOut();
