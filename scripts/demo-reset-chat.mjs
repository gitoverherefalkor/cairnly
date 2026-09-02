// Reset a DEMO account's chat to a pristine first-session state.
//
//   node scripts/demo-reset-chat.mjs demo.marloes@cairnly.io
//
// "Returning user" state lives in FOUR places; this script wipes the three
// server-side ones for the account's reports:
//   1. chat_messages        — the visible transcript. Any row at all marks the
//                             user "engaged", which re-arms the auto-resume
//                             (which then writes new rows — self-re-arming).
//   2. n8n_chat_histories   — the coach's own memory, keyed by report_id.
//                             Skip this and the coach "remembers" deleted turns.
//   3. user_engagement_tracking.chat_started_at / chat_last_section_index —
//                             keyed by USER id; this is why incognito alone
//                             still resumes.
// The fourth place is the browser's localStorage: close ALL private windows
// and open a fresh one (incognito keeps storage while any window stays open).
//
// Sections, feedback fields, and report status are NOT touched here — this is
// a chat reset, not a report reset.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('usage: node scripts/demo-reset-chat.mjs <email>');
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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}

const { data: reports, error: repErr } = await admin
  .from('reports')
  .select('id, created_at')
  .eq('user_id', user.id);
if (repErr) throw repErr;
const reportIds = (reports ?? []).map((r) => r.id);
console.log(`reports for ${email}: ${reportIds.join(', ') || '(none)'}`);

let msgCount = 0;
let memCount = 0;
let chapterCount = 0;
if (reportIds.length > 0) {
  const { data: delMsgs, error: msgErr } = await admin
    .from('chat_messages')
    .delete()
    .in('report_id', reportIds)
    .select('id');
  if (msgErr) throw msgErr;
  msgCount = delMsgs?.length ?? 0;

  const { data: delMem, error: memErr } = await admin
    .from('n8n_chat_histories')
    .delete()
    .in('session_id', reportIds)
    .select('id');
  if (memErr) throw memErr;
  memCount = delMem?.length ?? 0;

  // Chapter-1 feedback row: while it exists, the chapter feedback card is
  // skipped for this report — a test click-through would hide that beat
  // from the real demo run.
  const { data: delChap, error: chapErr } = await admin
    .from('report_sections')
    .delete()
    .in('report_id', reportIds)
    .eq('section_type', 'chapter_1_feedback')
    .select('id');
  if (chapErr) throw chapErr;
  chapterCount = delChap?.length ?? 0;
}

const { data: eng, error: engErr } = await admin
  .from('user_engagement_tracking')
  .update({ chat_started_at: null, chat_last_section_index: null })
  .eq('user_id', user.id)
  .select('user_id');
if (engErr) throw engErr;

console.log(`chat_messages deleted:        ${msgCount}`);
console.log(`n8n_chat_histories deleted:   ${memCount}`);
console.log(`chapter_1_feedback deleted:   ${chapterCount}`);
console.log(`engagement rows cleared:      ${eng?.length ?? 0}`);
console.log('Server-side chat state is pristine. Now close ALL private windows and open a fresh one.');
