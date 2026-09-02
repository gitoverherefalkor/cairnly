// Drive a DEMO persona through the coaching chat one step at a time, using
// the same calls the real chat UI makes (docs/handoff/demo-replay-plan.md,
// phase 2). Each invocation is one click or one typed turn, so the person
// steering the walkthrough can read the coach's reply and write the persona's
// next line in reaction to it, exactly as a user would.
//
//   node scripts/demo-chat-step.mjs demo.emma@cairnly.io <command> [args]
//
//   status                     report, current section, last turns (short)
//   last [n]                   print the n-th bot message from the end in full
//   ready                      "I'm Ready!" → delivers the first section
//   continue                   Continue pill: fast-path delivery of the next
//                              section; after a discussion the coach also runs
//                              in the background to fold it into the report
//   say <text>                 typed turn → coach reply
//       --pill=differently|somethingElse   the focus pill pressed first
//                              (stored as message metadata, the "via …" tag)
//       --about=<section_type> "Ask about this role" on that career card
//                              (prefixes the turn with "[About <role>]")
//   explore                    "I'd like to explore this more" pill
//   chip <n>                   click the n-th option chip of the last reply
//   move <section_type>        the Move pill on that career card (auto-sends
//                              the feasibility question for its rating)
//   keep [n]                   press Keep on the n-th bot message from the end
//   explain <section_type>     "Explain this comparison" on career 2 or 3
//   wrapup [--note=<text>]     wrap-up pill → highlights → save → completed
//
// What it mirrors from ChatContainer.tsx, and why it matters for the replay:
//   - the section index (1..10) is derived from the transcript: every
//     delivered section is one bot message with a "### " heading, agent
//     replies never carry one (the same rule detectFollowUpOptions uses)
//   - a Continue after a discussion fires the coach in the background AND
//     delivers the section (skip_history_user_write, like the app)
//   - typed turns are written to chat_messages first, then the coach is
//     called through chat-proxy with the same metadata the app sends
//   - Keep goes through save-chat-response; wrap-up through wrap-up-extract
//     and wrap-up-save with the kept replies, then the engagement row is
//     marked complete as the ClosingCard would
//
// REFUSES any address that is not an obvious demo account: this drives the
// paid coach and writes into a real account's transcript.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
const command = process.argv[3];
const rest = process.argv.slice(4);
if (!email || !command) {
  console.error('usage: node scripts/demo-chat-step.mjs <email> <command> [args] (see header)');
  process.exit(1);
}
if (!/^demo[.\-+]/i.test(email)) {
  console.error(`Refusing "${email}": demo accounts only (address must start with "demo.").`);
  process.exit(1);
}
const flag = (name) => {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const positional = rest.filter((a) => !a.startsWith('--'));

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
if (!url || !anonKey || !serviceKey || !password) {
  console.error(`VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY / ${passwordVar} missing from .env.local`);
  process.exit(1);
}

// ── Chat vocabulary (public/locales/en/chat.json) ──────────────────────────
const READY_MESSAGE = "I'm ready, let's begin!";
const CONTINUE_MESSAGE = "Looks good, let's continue to the next section";
const EXPLORE_MESSAGE = "I'd like to explore this section a bit more";
const WRAP_UP_MESSAGE = "Looks good, I'm all done! Let's wrap up the session.";
const ABOUT_PREFIX = (role) => `[About ${role}]`;

const SECTION_INDEX_TO_TYPE = {
  1: 'approach',
  2: 'strengths',
  3: 'development',
  4: 'values',
  5: 'top_career_1',
  6: 'top_career_2',
  7: 'top_career_3',
  8: 'runner_ups',
  9: 'outside_box',
  10: 'dream_jobs',
};
const FIRST_CAREER_INDEX = 5;
const LAST_SECTION_INDEX = 10;

// ── Clients: service role for reads, the persona's own session for writes ──
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: signin, error: signinErr } = await client.auth.signInWithPassword({ email, password });
if (signinErr) {
  console.error(`Login failed for ${email}: ${signinErr.message}`);
  process.exit(1);
}
const userId = signin.user.id;
const token = signin.session.access_token;
const fnHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey };

const { data: profile } = await admin
  .from('profiles')
  .select('first_name, country, preferred_language')
  .eq('id', userId)
  .maybeSingle();
const firstName = profile?.first_name ?? '';
const country = profile?.country ?? '';
const language = (profile?.preferred_language || 'en').slice(0, 2).toLowerCase();

// Report: --report=<uuid>, else the newest one that is chat-ready.
let reportId = flag('report');
{
  const { data: reports, error } = await admin
    .from('reports')
    .select('id, status, created_at, payload')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const report = reportId
    ? reports.find((r) => r.id === reportId)
    : reports.find((r) => r.status === 'pending_review' || r.status === 'completed');
  if (!report) {
    console.error('No chat-ready report (pending_review/completed) for this account.');
    process.exit(1);
  }
  reportId = report.id;
  var reportStatus = report.status;
  var payload = typeof report.payload === 'string' ? JSON.parse(report.payload) : report.payload;
}
const sessionId = reportId; // Chat.tsx: sessionId = report.id

// Survey-sourced coach context, as Chat.tsx derives it.
const responses = payload?.responses ?? {};
const flatten = (v) => (Array.isArray(v) ? v.filter(Boolean).map(String).join('; ') : typeof v === 'string' ? v : '');
const assessmentPurpose = flatten(responses['11111111-1111-1111-1111-111111111115']);
const shortGoals = flatten(responses['77777777-7777-7777-7777-777777777771']);
const longGoals = flatten(responses['77777777-7777-7777-7777-777777777772']);
const goalAlignment = [shortGoals && `Short-term: ${shortGoals}`, longGoals && `Long-term: ${longGoals}`]
  .filter(Boolean)
  .join(' | ');

// ── Transcript helpers ─────────────────────────────────────────────────────
const parseIfString = (v) => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};
async function loadMessages() {
  const { data, error } = await admin
    .from('chat_messages')
    .select('id, sender, content, created_at, metadata')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || (a.sender === 'user' ? 0 : 1) - (b.sender === 'user' ? 0 : 1),
  );
}
const isDelivery = (m) => m.sender === 'bot' && /^### /m.test(m.content);
const currentSectionIndexOf = (messages) => {
  const override = flag('section');
  if (override !== undefined) return Number(override);
  return Math.min(messages.filter(isDelivery).length, LAST_SECTION_INDEX);
};
const lastUserTurnWasAdvance = (messages) => {
  const lastUser = [...messages].reverse().find((m) => m.sender === 'user');
  if (!lastUser) return true;
  const lower = lastUser.content.trim().toLowerCase().replace(/[!.,?]+$/, '');
  return lower.includes('continue to the next section') || lower === "i'm ready, let's begin";
};
async function loadSections() {
  const { data, error } = await admin
    .from('report_sections')
    .select('id, section_type, order_number, title, content, metadata, content_i18n')
    .eq('report_id', reportId)
    .order('order_number', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    ...s,
    metadata: parseIfString(s.metadata) ?? null,
    content_i18n: parseIfString(s.content_i18n) ?? null,
  }));
}
const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
const displayTitle = (section) =>
  stripHtml(section.content_i18n?.[language]?.title || section.title);

// ── The calls the UI makes ─────────────────────────────────────────────────
async function insertMessage(sender, content, metadata = null) {
  const { data, error } = await client
    .from('chat_messages')
    .insert({ session_id: sessionId, report_id: reportId, user_id: userId, sender, content, metadata })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function sendToCoach(message, currentSectionIndex) {
  const res = await fetch(`${url}/functions/v1/chat-proxy`, {
    method: 'POST',
    headers: fnHeaders,
    body: JSON.stringify({
      action: 'sendMessage',
      'n8n-chat/sessionId': sessionId,
      chatInput: message,
      metadata: {
        report_id: reportId,
        first_name: firstName,
        country,
        assessment_purpose: assessmentPurpose,
        goal_alignment: goalAlignment,
        current_section: SECTION_INDEX_TO_TYPE[currentSectionIndex] ?? null,
        careers_revealed: currentSectionIndex >= FIRST_CAREER_INDEX,
        preferred_language: language,
      },
    }),
  });
  if (!res.ok) throw new Error(`chat-proxy ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  const text = data.output ?? data.text ?? data.message ?? '';
  return text === '' && Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : text;
}

async function deliver(sectionType, previousSectionType, userMessage, skipHistoryUserWrite) {
  const res = await fetch(`${url}/functions/v1/deliver-section`, {
    method: 'POST',
    headers: fnHeaders,
    body: JSON.stringify({
      report_id: reportId,
      section_type: sectionType,
      previous_section_type: previousSectionType,
      user_message: userMessage,
      session_id: sessionId,
      user_id: userId,
      skip_history_user_write: skipHistoryUserWrite,
    }),
  });
  if (!res.ok) throw new Error(`deliver-section ${res.status}: ${await res.text().catch(() => '')}`);
  return (await res.json()).content;
}

async function upsertEngagement(fields) {
  const { error } = await admin
    .from('user_engagement_tracking')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.error('[engagement] upsert failed:', error.message);
}

// Typed turn (or a chip / pill message): persist, ask the coach, persist.
async function converse(message, metadata, currentSectionIndex) {
  await insertMessage('user', message, metadata);
  process.stdout.write('coach is thinking… ');
  const started = Date.now();
  const reply = await sendToCoach(message, currentSectionIndex);
  console.log(`${Math.round((Date.now() - started) / 1000)}s`);
  if (!reply) throw new Error('empty reply from the coach');
  await insertMessage('bot', reply);
  await upsertEngagement({ chat_last_activity_at: new Date().toISOString() });
  console.log('\n' + reply + '\n');
}

// Follow-up option chips, as ChatMessage.detectFollowUpOptions reads them.
function detectFollowUpOptions(markdown) {
  if (/^### /m.test(markdown)) return null;
  const bulletRegex = /^\s*-\s*(?:\*\*(.+?)\*\*\s*(.*)|(.+))$/;
  const options = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(bulletRegex);
    if (!m) continue;
    if (m[1] !== undefined) {
      const title = m[1].trim().replace(/[!?.]+$/, '');
      const rawDesc = (m[2] || '').replace(/^\s*-\s*/, '').trim();
      options.push({ display: rawDesc ? `${title} — ${rawDesc}` : title, message: title });
    } else {
      const plain = (m[3] || '').trim();
      options.push({ display: plain, message: plain.replace(/[!?.]+$/, '') });
    }
  }
  return options.length >= 2 ? options : null;
}

// buildFeasibilityQuestion (ChatMessage.tsx), English.
function feasibilityQuestion(roleTitle, moveLevel) {
  const base = `How realistic is the move into ${roleTitle} from where I am now, and what would I need to learn or reskill to get there?`;
  if (!moveLevel) return base;
  return `${base} My report rates the reskilling effort for this move as "${moveLevel}". Explain why it is rated that, and whether it holds up.`;
}

const sectionOfType = (sections, type) => {
  const hit = sections.find((s) => s.section_type === type);
  if (!hit) {
    console.error(`No ${type} row on this report.`);
    process.exit(1);
  }
  return hit;
};

// ── Commands ───────────────────────────────────────────────────────────────
const messages = await loadMessages();
const sectionIndex = currentSectionIndexOf(messages);
const header = () =>
  console.log(
    `report ${reportId} (${reportStatus}) · section ${sectionIndex}${SECTION_INDEX_TO_TYPE[sectionIndex] ? ` (${SECTION_INDEX_TO_TYPE[sectionIndex]})` : ''} · ${messages.length} messages\n`,
  );

switch (command) {
  case 'status': {
    header();
    const sections = await loadSections();
    console.log(
      'sections:',
      sections.map((s) => `${s.section_type}${s.order_number ? `#${s.order_number}` : ''}`).join(', '),
    );
    console.log('');
    for (const m of messages.slice(-6)) {
      const tag = m.metadata?.quick_reply ? ` [via ${m.metadata.quick_reply}]` : '';
      console.log(`${m.sender.padEnd(4)}${tag} ${m.content.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
    break;
  }

  case 'last': {
    const n = Number(positional[0] ?? 1);
    const bots = messages.filter((m) => m.sender === 'bot');
    const target = bots[bots.length - n];
    if (!target) {
      console.error('No such bot message.');
      process.exit(1);
    }
    console.log(target.content);
    break;
  }

  case 'ready': {
    header();
    if (messages.length > 0) {
      console.error('Transcript is not empty; refusing to start over (run demo-reset-chat.mjs first).');
      process.exit(1);
    }
    const now = new Date().toISOString();
    await upsertEngagement({ chat_started_at: now, chat_last_activity_at: now });
    const content = await deliver('approach', undefined, READY_MESSAGE, false);
    await upsertEngagement({ chat_last_activity_at: new Date().toISOString(), chat_last_section_index: 1 });
    console.log(content);
    break;
  }

  case 'continue': {
    header();
    const nextIndex = sectionIndex + 1;
    const nextType = SECTION_INDEX_TO_TYPE[nextIndex];
    if (!nextType) {
      console.error('Already on the last section; use `wrapup`.');
      process.exit(1);
    }
    const previousType = SECTION_INDEX_TO_TYPE[sectionIndex];
    const hadDiscussion = !lastUserTurnWasAdvance(messages);
    // Career rows come from WF4 (last pipeline step); wait like the app does.
    const sections = await loadSections();
    if (!sections.some((s) => s.section_type === nextType)) {
      console.error(`${nextType} rows are not there yet; wait for the pipeline and retry.`);
      process.exit(1);
    }
    console.log(`delivering ${nextType}${hadDiscussion ? ' (coach folds the discussion in, in the background)' : ''}…`);
    const agent = hadDiscussion
      ? sendToCoach(CONTINUE_MESSAGE, sectionIndex).then(
          (r) => console.log(`background coach reply (${r.length} chars, not shown in chat)`),
          (e) => console.error('[advance] background coach failed:', e.message),
        )
      : Promise.resolve();
    const content = await deliver(nextType, previousType, CONTINUE_MESSAGE, hadDiscussion);
    await agent;
    await upsertEngagement({ chat_last_activity_at: new Date().toISOString(), chat_last_section_index: nextIndex });
    console.log('\n' + content);
    break;
  }

  case 'say': {
    header();
    let text = positional.join(' ').trim();
    if (!text) {
      console.error('say: text required');
      process.exit(1);
    }
    const pill = flag('pill');
    if (pill && !['differently', 'somethingElse'].includes(pill)) {
      console.error('--pill must be differently or somethingElse');
      process.exit(1);
    }
    const about = flag('about');
    if (about) {
      const sections = await loadSections();
      const role = displayTitle(sectionOfType(sections, about));
      text = `${ABOUT_PREFIX(role)} ${text}`;
    }
    console.log(`you${pill ? ` [via ${pill}]` : ''}: ${text}\n`);
    await converse(text, pill ? { quick_reply: pill } : null, sectionIndex);
    break;
  }

  case 'explore': {
    header();
    console.log(`you: ${EXPLORE_MESSAGE}\n`);
    await converse(EXPLORE_MESSAGE, null, sectionIndex);
    break;
  }

  case 'chip': {
    header();
    const n = Number(positional[0]);
    const lastBot = [...messages].reverse().find((m) => m.sender === 'bot');
    const options = lastBot ? detectFollowUpOptions(lastBot.content) : null;
    if (!options) {
      console.error('The last coach message has no option chips.');
      process.exit(1);
    }
    options.forEach((o, i) => console.log(`  ${i + 1}. ${o.display}`));
    const opt = options[n - 1];
    if (!opt) {
      console.error(`chip: pick 1..${options.length}`);
      process.exit(1);
    }
    console.log(`\nyou (chip ${n}): ${opt.message}\n`);
    await converse(opt.message, null, sectionIndex);
    break;
  }

  case 'move': {
    header();
    const sections = await loadSections();
    const section = sectionOfType(sections, positional[0]);
    const question = feasibilityQuestion(displayTitle(section), section.metadata?.move ?? null);
    console.log(`you (Move pill): ${question}\n`);
    await converse(question, null, sectionIndex);
    break;
  }

  case 'keep': {
    header();
    const n = Number(positional[0] ?? 1);
    const bots = messages.filter((m) => m.sender === 'bot');
    const target = bots[bots.length - n];
    if (!target) {
      console.error('No such bot message.');
      process.exit(1);
    }
    const res = await fetch(`${url}/functions/v1/save-chat-response`, {
      method: 'POST',
      headers: fnHeaders,
      body: JSON.stringify({
        report_id: reportId,
        content: target.content,
        section_type: SECTION_INDEX_TO_TYPE[sectionIndex] ?? null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`save-chat-response ${res.status}: ${JSON.stringify(body)}`);
    console.log(`kept message ${target.id}: ${JSON.stringify(body).slice(0, 200)}`);
    break;
  }

  case 'explain': {
    header();
    const sections = await loadSections();
    const section = sectionOfType(sections, positional[0]);
    const explanation =
      section.content_i18n?.[language]?.comparison?.explanation || section.metadata?.comparison?.explanation;
    if (!explanation) {
      console.error(`${positional[0]} has no comparison explanation.`);
      process.exit(1);
    }
    const id = await insertMessage('bot', explanation);
    console.log(`explanation posted as bot message ${id}:\n\n${explanation}`);
    break;
  }

  case 'wrapup': {
    header();
    await insertMessage('user', WRAP_UP_MESSAGE);
    process.stdout.write('extracting highlights… ');
    const ex = await fetch(`${url}/functions/v1/wrap-up-extract`, {
      method: 'POST',
      headers: fnHeaders,
      body: JSON.stringify({ report_id: reportId }),
    });
    const exBody = await ex.json().catch(() => ({}));
    if (!ex.ok || !exBody.highlights) throw new Error(`wrap-up-extract ${ex.status}: ${JSON.stringify(exBody).slice(0, 300)}`);
    console.log('done\n' + exBody.highlights + '\n');
    const { data: saved } = await admin
      .from('saved_chat_responses')
      .select('content, created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });
    const savedResponses = (saved ?? []).map((r) => ({ content: r.content, saved_at: r.created_at }));
    process.stdout.write(`saving (${savedResponses.length} kept replies)… `);
    const sv = await fetch(`${url}/functions/v1/wrap-up-save`, {
      method: 'POST',
      headers: fnHeaders,
      body: JSON.stringify({
        report_id: reportId,
        highlights: exBody.highlights,
        addendum: flag('note') ?? null,
        saved_responses: savedResponses,
      }),
    });
    const svBody = await sv.json().catch(() => ({}));
    if (!sv.ok) throw new Error(`wrap-up-save ${sv.status}: ${JSON.stringify(svBody).slice(0, 300)}`);
    console.log('done');
    // ClosingCard → trackChatComplete
    await upsertEngagement({
      chat_completed_at: new Date().toISOString(),
      chat_last_activity_at: new Date().toISOString(),
      chat_last_section_index: LAST_SECTION_INDEX,
    });
    const { data: after } = await admin.from('reports').select('status').eq('id', reportId).single();
    console.log(`report status: ${after?.status}`);
    break;
  }

  default:
    console.error(`Unknown command "${command}" (see the header of this script).`);
    process.exit(1);
}
