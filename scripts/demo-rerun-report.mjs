// Re-run a DEMO account's survey answers through the full WF1-WF4 pipeline.
//
//   node scripts/demo-rerun-report.mjs demo.marloes@cairnly.io
//   node scripts/demo-rerun-report.mjs demo.emma@cairnly.io --payload=docs/report/demo-emma-payload.json
//
// Takes the stored answers (reports.payload) from the account's newest report,
// submits them as a FRESH report via forward-to-n8n (so nothing collides with
// the old report's sections/chat), and polls until the new report reaches
// pending_review — i.e. chat-ready. The old report is NOT touched here; clean
// it up separately once the new one is confirmed good.
//
// --payload=<path> submits that JSON file instead (the output of a
// demo-<persona>-payload.mjs build). That is how a brand-new persona gets its
// FIRST report, since there is no stored payload to re-run yet.
//
// REFUSES any address that is not an obvious demo account: this re-runs the
// paid AI pipeline and would otherwise silently regenerate a real customer's
// report. Login uses the DEMO_<LOCALPART>_PASSWORD entry that
// demo-set-password.mjs wrote to .env.local.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('usage: node scripts/demo-rerun-report.mjs <email>');
  process.exit(1);
}
if (!/^demo[.\-+]/i.test(email)) {
  console.error(`Refusing "${email}": demo accounts only (address must start with "demo.").`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const passwordVar = `DEMO_${email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_PASSWORD`;
const password = env[passwordVar];
if (!url || !anonKey || !serviceKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}
if (!password) {
  console.error(`${passwordVar} missing from .env.local — run demo-set-password.mjs first.`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. Locate the demo user + their newest report's stored answers.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}
const payloadPath = process.argv.slice(3).find((a) => a.startsWith('--payload='))?.slice('--payload='.length);
let payload;
if (payloadPath) {
  payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
  if (!payload?.responses || !payload?.survey_id) {
    console.error(`${payloadPath} does not look like a survey payload (needs survey_id + responses).`);
    process.exit(1);
  }
  console.log(`payload from file: ${payloadPath} (${Object.keys(payload.responses).length} responses)`);
} else {
  const { data: oldReport, error: repErr } = await admin
    .from('reports')
    .select('id, status, payload, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (repErr) throw repErr;
  if (!oldReport?.payload) {
    console.error('Newest report has no stored payload — nothing to re-run (pass --payload=<file> for a first run).');
    process.exit(1);
  }
  payload = typeof oldReport.payload === 'string' ? JSON.parse(oldReport.payload) : oldReport.payload;
  console.log(`old report: ${oldReport.id} (${oldReport.status}, ${oldReport.created_at})`);
}

// 2. Sign in as the demo user (forward-to-n8n derives user_id from the JWT).
const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: signin, error: signinErr } = await client.auth.signInWithPassword({ email, password });
if (signinErr) {
  console.error(`Login failed for ${email}: ${signinErr.message}`);
  process.exit(1);
}

// 3. Fresh submit with the stored answers → new report row, full WF1-WF4 run.
const res = await fetch(`${url}/functions/v1/forward-to-n8n`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${signin.session.access_token}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ payload }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.report_id) {
  console.error(`forward-to-n8n failed (${res.status}):`, JSON.stringify(body).slice(0, 400));
  process.exit(1);
}
const newReportId = body.report_id;
console.log(`new report: ${newReportId} — pipeline started, polling status…`);

// 4. Poll until the new report is chat-ready (pending_review) or failed.
//    WF1→WF4 + translation typically takes 10-25 minutes.
const startedAt = Date.now();
const TIMEOUT_MS = 45 * 60 * 1000;
while (Date.now() - startedAt < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, 60_000));
  const { data: row } = await admin
    .from('reports')
    .select('status')
    .eq('id', newReportId)
    .single();
  const { count } = await admin
    .from('report_sections')
    .select('id', { count: 'exact', head: true })
    .eq('report_id', newReportId);
  const mins = Math.round((Date.now() - startedAt) / 60000);
  console.log(`[${mins}m] status=${row?.status} sections=${count ?? 0}`);
  if (row?.status === 'failed') {
    console.error('Pipeline FAILED — check n8n executions.');
    process.exit(2);
  }
  if (row?.status && row.status !== 'processing') {
    console.log(`DONE: report ${newReportId} is ${row.status} with ${count ?? 0} sections.`);
    process.exit(0);
  }
}
console.error('Timed out after 45 minutes — check n8n executions.');
process.exit(3);
