// Rename a DEMO persona everywhere it lives in the database, so a later
// export, PDF render or walkthrough all use the new name.
//
//   node scripts/demo-rename-persona.mjs demo.marloes@cairnly.io --from=Marloes --to=Marcel
//   node scripts/demo-rename-persona.mjs demo.marloes@cairnly.io --from=Marloes --to=Marcel --apply
//
// Without --apply it is a dry run: it prints every row that would change and
// how many occurrences, and writes nothing.
//
// What it touches (demo account only):
//   profiles.first_name
//   reports.payload            (the survey answers: the name field, and any
//                               free text that mentions the persona)
//   chat_messages.content
//   report_sections.content / .title / .content_i18n / .share_quotes
//   saved_chat_responses.content (+ content_hash, recomputed when it was the
//                               plain sha256 of the content; left alone and
//                               flagged otherwise)
//   n8n_chat_histories.message (the coach's own memory, keyed by report id)
//
// Only whole-word, case-sensitive matches are replaced ("Marloes", not
// "marloes-" in a slug). The persona's LAST name is untouched.
//
// The report_sections update sets content and content_i18n in ONE statement.
// The staleness trigger (clear_stale_translations) wipes translations when
// content changes, unless content_i18n is set to a DIFFERENT value in the
// same update. A translation that never mentioned the name stays valid, so
// for such rows the script re-sends the same translations with a
// `renamed_at` marker inside each language entry: identical text, distinct
// jsonb, trigger stays quiet. Readers only look at title/content/comparison.
//
// REFUSES any address that is not an obvious demo account: this rewrites
// report and chat rows with the service role.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
const flag = (name) => {
  const hit = process.argv.slice(3).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const from = flag('from');
const to = flag('to');
const apply = process.argv.includes('--apply');
if (!email || !from || !to) {
  console.error('usage: node scripts/demo-rename-persona.mjs <email> --from=<OldName> --to=<NewName> [--apply]');
  process.exit(1);
}
if (!/^demo[.\-+]/i.test(email)) {
  console.error(`Refusing "${email}": demo accounts only (address must start with "demo.").`);
  process.exit(1);
}
if (!/^[\p{L}][\p{L}' -]*$/u.test(from) || !/^[\p{L}][\p{L}' -]*$/u.test(to)) {
  console.error('Names must be plain words.');
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

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Unicode-aware word boundary: not preceded/followed by a letter.
const NAME_RE = new RegExp(`(?<!\\p{L})${escapeRe(from)}(?!\\p{L})`, 'gu');
const countIn = (s) => (typeof s === 'string' ? (s.match(NAME_RE) || []).length : 0);
const replaceIn = (s) => (typeof s === 'string' ? s.replace(NAME_RE, to) : s);
// jsonb columns: walk the value and replace inside every string. NOT a
// replace on the serialised JSON text: there a newline is the two characters
// "\n", so "\n\nMarloes" hides the name behind a letter and the word
// boundary misses it (that is exactly how the first run left three Dutch
// translations untouched). n8n writes some of these columns as JSON-encoded
// strings (house pattern); such a string primitive is decoded, walked, and
// encoded back, so its shape is preserved.
const walkStrings = (v, fn) => {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v)) return v.map((x) => walkStrings(x, fn));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walkStrings(x, fn)]));
  return v;
};
const replaceJson = (v) => {
  if (v === null || v === undefined) return { value: v, count: 0 };
  let count = 0;
  const tally = (s) => {
    count += countIn(s);
    return s;
  };
  if (typeof v === 'string') {
    // Either a plain string column value or an n8n-style encoded JSON string.
    let decoded = null;
    try {
      decoded = JSON.parse(v);
    } catch {
      decoded = null;
    }
    if (decoded && typeof decoded === 'object') {
      walkStrings(decoded, tally);
      return { value: count ? JSON.stringify(walkStrings(decoded, replaceIn)) : v, count };
    }
    count = countIn(v);
    return { value: count ? replaceIn(v) : v, count };
  }
  walkStrings(v, tally);
  return { value: count ? walkStrings(v, replaceIn) : v, count };
};
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

const log = (line) => console.log(line);
const changes = [];
const note = (table, id, detail, count) => {
  changes.push({ table, id, detail, count });
  log(`  ${table.padEnd(22)} ${String(id).slice(0, 8)}…  ${String(count).padStart(3)}×  ${detail}`);
};

// 1. User + profile.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}
const { data: profile, error: profErr } = await admin
  .from('profiles')
  .select('first_name, last_name')
  .eq('id', user.id)
  .maybeSingle();
if (profErr) throw profErr;
log(`${apply ? 'APPLYING' : 'DRY RUN'}: ${from} → ${to} for ${email} (${user.id})`);
log(`profile now: ${profile?.first_name ?? '(none)'} ${profile?.last_name ?? ''}`);

const updates = [];
if (profile?.first_name && countIn(profile.first_name)) {
  note('profiles', user.id, `first_name "${profile.first_name}" → "${replaceIn(profile.first_name)}"`, 1);
  updates.push(() => admin.from('profiles').update({ first_name: replaceIn(profile.first_name) }).eq('id', user.id));
}

// 2. Reports (payload) for this user.
const { data: reports, error: repErr } = await admin.from('reports').select('id, payload').eq('user_id', user.id);
if (repErr) throw repErr;
const reportIds = (reports ?? []).map((r) => r.id);
for (const r of reports ?? []) {
  const { value, count } = replaceJson(r.payload);
  if (count) {
    note('reports.payload', r.id, 'survey answers', count);
    updates.push(() => admin.from('reports').update({ payload: value }).eq('id', r.id));
  }
}

// 3. Chat messages.
const { data: msgs, error: msgErr } = await admin
  .from('chat_messages')
  .select('id, content')
  .in('report_id', reportIds);
if (msgErr) throw msgErr;
for (const m of msgs ?? []) {
  const count = countIn(m.content);
  if (count) {
    note('chat_messages', m.id, m.content.slice(0, 50).replace(/\n/g, ' ') + '…', count);
    updates.push(() => admin.from('chat_messages').update({ content: replaceIn(m.content) }).eq('id', m.id));
  }
}

// 4. Report sections: content + title + content_i18n + share_quotes in one update.
const { data: sections, error: secErr } = await admin
  .from('report_sections')
  .select('id, section_type, title, content, content_i18n, share_quotes')
  .in('report_id', reportIds);
if (secErr) throw secErr;
let blocked = 0;
for (const s of sections ?? []) {
  const cContent = countIn(s.content);
  const cTitle = countIn(s.title);
  const i18n = replaceJson(s.content_i18n);
  const quotes = replaceJson(s.share_quotes);
  const total = cContent + cTitle + i18n.count + quotes.count;
  if (!total) continue;
  const patch = {};
  if (cContent) patch.content = replaceIn(s.content);
  if (cTitle) patch.title = replaceIn(s.title);
  if (i18n.count) patch.content_i18n = i18n.value;
  if (quotes.count) patch.share_quotes = quotes.value;
  const canonicalChanges = cContent > 0 || cTitle > 0;
  const translations =
    s.content_i18n && typeof s.content_i18n === 'object' && !Array.isArray(s.content_i18n)
      ? s.content_i18n
      : null;
  let kept = '';
  if (canonicalChanges && translations && Object.keys(translations).length > 0 && !i18n.count) {
    // Keep the (still valid) translations past the staleness trigger: same
    // text, distinct jsonb value.
    const stamp = new Date().toISOString();
    patch.content_i18n = Object.fromEntries(
      Object.entries(translations).map(([lang, entry]) => [
        lang,
        entry && typeof entry === 'object' ? { ...entry, renamed_at: stamp } : entry,
      ]),
    );
    kept = `, translations kept (renamed_at marker)`;
  }
  note('report_sections', s.id, `${s.section_type}: content ${cContent}, title ${cTitle}, i18n ${i18n.count}, quotes ${quotes.count}${kept}`, total);
  updates.push(() => admin.from('report_sections').update(patch).eq('id', s.id));
}

// 5. Saved chat responses (+ hash).
const { data: saved, error: savedErr } = await admin
  .from('saved_chat_responses')
  .select('id, content, content_hash')
  .in('report_id', reportIds);
if (savedErr) throw savedErr;
for (const row of saved ?? []) {
  const count = countIn(row.content);
  if (!count) continue;
  const newContent = replaceIn(row.content);
  const patch = { content: newContent };
  let hashNote = 'hash unchanged';
  if (row.content_hash && row.content_hash === sha256(row.content)) {
    patch.content_hash = sha256(newContent);
    hashNote = 'hash recomputed (sha256 of content)';
  } else if (row.content_hash) {
    hashNote = 'hash NOT recomputed: stored hash is not sha256(content); left as is';
  }
  note('saved_chat_responses', row.id, hashNote, count);
  updates.push(() => admin.from('saved_chat_responses').update(patch).eq('id', row.id));
}

// 6. The coach's memory.
const { data: mem, error: memErr } = await admin
  .from('n8n_chat_histories')
  .select('id, message')
  .in('session_id', reportIds);
if (memErr) throw memErr;
for (const row of mem ?? []) {
  const { value, count } = replaceJson(row.message);
  if (count) {
    note('n8n_chat_histories', row.id, 'coach memory', count);
    updates.push(() => admin.from('n8n_chat_histories').update({ message: value }).eq('id', row.id));
  }
}

log(`\n${changes.length} row(s) to change, ${changes.reduce((a, c) => a + c.count, 0)} occurrence(s)${blocked ? `, ${blocked} BLOCKED` : ''}.`);
if (!apply) {
  log('Dry run only. Re-run with --apply to write.');
  process.exit(blocked ? 2 : 0);
}
if (blocked) {
  console.error('Refusing to apply while rows are blocked; resolve them first.');
  process.exit(2);
}
let done = 0;
for (const run of updates) {
  const { error } = await run();
  if (error) throw error;
  done += 1;
}
log(`Applied ${done} update(s). Next: re-export the fixture and re-render the PDFs.`);
