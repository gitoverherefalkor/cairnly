// Freeze a DEMO account's finished coaching session into a JSON fixture for
// the public /demo replay (docs/handoff/demo-replay-plan.md).
//
//   node scripts/demo-export-fixture.mjs demo.marloes@cairnly.io
//   node scripts/demo-export-fixture.mjs demo.marloes@cairnly.io --report=<uuid>
//
// Writes src/demo/fixtures/<persona>.<lang>.json with:
//   persona   — first name, language, which report, when exported
//   messages  — chat_messages in order (id, sender, content, created_at, metadata)
//   sections  — every report_sections row the chat reads (init_summary excluded:
//               nothing renders it and it is raw survey extraction, not prose)
//   savedMessageIds — messages the persona pressed Keep on, resolved by matching
//               saved_chat_responses.content back to the transcript (the table
//               has no message_id column; ChatContainer deletes by content too)
//   savedResponses  — the saved_chat_responses rows themselves (label, section,
//               content), which the dashboard's "Saved answers" panel renders
//
// Report selection: the NEWEST report with status 'completed', falling back to
// the newest report that has any chat messages. Never blindly "the newest":
// demo-rerun-report.mjs creates a fresh chat-less report that would win that
// race and export an empty transcript. --report=<uuid> overrides.
//
// jsonb columns written by n8n arrive as JSON-encoded STRINGS (house pattern);
// metadata / content_i18n / share_quotes are parsed here so the fixture holds
// real objects and every reader can trust the shape.
//
// REFUSES any address that is not an obvious demo account: this dumps a full
// transcript + report into a file that gets committed to a public repo.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('usage: node scripts/demo-export-fixture.mjs <email> [--report=<uuid>] [--out=<path>]');
  process.exit(1);
}
if (!/^demo[.\-+]/i.test(email)) {
  console.error(`Refusing "${email}": demo accounts only (address must start with "demo.").`);
  process.exit(1);
}
const flag = (name) => {
  const hit = process.argv.slice(3).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const reportOverride = flag('report');
const outOverride = flag('out');

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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// n8n's Supabase nodes store jsonb as string primitives. Normalise to objects.
const parseIfString = (v) => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

// 1. Demo user + profile.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}
const { data: profile } = await admin
  .from('profiles')
  .select('first_name, preferred_language, country')
  .eq('id', user.id)
  .maybeSingle();
const language = (profile?.preferred_language || 'en').slice(0, 2).toLowerCase();
const firstName = profile?.first_name || email.split('@')[0].replace(/^demo[.\-+]/i, '');

// 2. Pick the report.
const { data: reports, error: repErr } = await admin
  .from('reports')
  .select('id, status, created_at, updated_at')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
if (repErr) throw repErr;
if (!reports?.length) {
  console.error('This account has no reports.');
  process.exit(1);
}
let report = null;
if (reportOverride) {
  report = reports.find((r) => r.id === reportOverride) ?? null;
  if (!report) {
    console.error(`--report=${reportOverride} is not one of this account's reports.`);
    process.exit(1);
  }
} else {
  report = reports.find((r) => r.status === 'completed') ?? null;
  if (!report) {
    for (const r of reports) {
      const { count } = await admin
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('report_id', r.id);
      if ((count ?? 0) > 0) {
        report = r;
        break;
      }
    }
  }
}
if (!report) {
  console.error('No completed report and no report with chat messages — nothing to freeze.');
  process.exit(1);
}
console.log(`report: ${report.id} (${report.status}, ${report.created_at})`);

// 3. Transcript.
const { data: rawMessages, error: msgErr } = await admin
  .from('chat_messages')
  .select('id, sender, content, created_at, metadata')
  .eq('report_id', report.id)
  .order('created_at', { ascending: true });
if (msgErr) throw msgErr;
const messages = (rawMessages ?? [])
  .map((m) => ({
    id: m.id,
    sender: m.sender,
    content: m.content,
    created_at: m.created_at,
    metadata: parseIfString(m.metadata) ?? null,
  }))
  // deliver-section persists the user's turn and the section it triggered in
  // one write, so both rows can share a created_at. On a tie the user turn
  // comes first: that is the order the conversation happened in.
  .sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) ||
      (a.sender === 'user' ? 0 : 1) - (b.sender === 'user' ? 0 : 1),
  );
if (messages.length === 0) {
  console.error('Report has no chat messages — refusing to write an empty replay.');
  process.exit(1);
}

// 4. Sections (everything the chat components read).
const { data: rawSections, error: secErr } = await admin
  .from('report_sections')
  .select('*')
  .eq('report_id', report.id)
  // init_summary is raw survey extraction, chapter_1_feedback is the
  // product-feedback form: neither is report content anything renders.
  .not('section_type', 'in', '(init_summary,chapter_1_feedback)');
if (secErr) throw secErr;
const sections = (rawSections ?? [])
  .map((s) => ({
    ...s,
    metadata: parseIfString(s.metadata) ?? null,
    content_i18n: parseIfString(s.content_i18n) ?? null,
    share_quotes: parseIfString(s.share_quotes) ?? null,
  }))
  .sort(
    (a, b) =>
      (a.order_number ?? 9999) - (b.order_number ?? 9999) ||
      a.created_at.localeCompare(b.created_at),
  );

// 5. Keeps → message ids (matched on content, as the chat itself does).
const { data: saved, error: savedErr } = await admin
  .from('saved_chat_responses')
  .select('id, report_id, section_type, label, content, created_at')
  .eq('report_id', report.id)
  .order('created_at', { ascending: true });
if (savedErr) throw savedErr;
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const savedMessageIds = [];
let unmatched = 0;
for (const row of saved ?? []) {
  const hit = messages.find((m) => m.sender === 'bot' && norm(m.content) === norm(row.content));
  if (hit) savedMessageIds.push(hit.id);
  else unmatched += 1;
}

// 6. Write.
// --persona=<slug> names the persona when it differs from the login (the
// account demo.marloes@ became the persona Marcel; the login stayed).
const personaSlug =
  flag('persona')?.toLowerCase() ??
  email.split('@')[0].replace(/^demo[.\-+]/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const outPath = outOverride ?? join('src', 'demo', 'fixtures', `${personaSlug}.${language}.json`);
const fixture = {
  persona: {
    firstName,
    language,
    country: profile?.country ?? null,
    exportedAt: new Date().toISOString(),
    reportId: report.id,
    reportStatus: report.status,
    // What the dashboard prints as the report date (Dashboard.tsx uses
    // updated_at, which wrap-up-save bumps when the report completes).
    reportCompletedAt: report.updated_at ?? report.created_at,
  },
  messages,
  sections,
  savedMessageIds,
  savedResponses: saved ?? [],
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n');

const i18nMissing = sections.filter((s) => !s.content_i18n?.[language]).map((s) => s.section_type);
console.log(`messages:          ${messages.length}`);
console.log(`sections:          ${sections.length} (${sections.map((s) => s.section_type).join(', ')})`);
console.log(`keeps matched:     ${savedMessageIds.length}${unmatched ? ` (${unmatched} unmatched)` : ''}`);
if (language !== 'en') {
  console.log(
    `translations:      ${i18nMissing.length === 0 ? `all sections carry ${language}` : `MISSING ${language} on ${i18nMissing.join(', ')}`}`,
  );
}
console.log(`written:           ${outPath}`);
