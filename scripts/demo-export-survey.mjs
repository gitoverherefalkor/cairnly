// Freeze the three survey questions the public demo shows (/demo/survey),
// with both personas' real answers, into src/demo/fixtures/survey.json.
//
//   node scripts/demo-export-survey.mjs
//
// Which three, and why (docs/handoff/demo-replay-plan.md):
//   career_happiness  the 1-10 slider + "why" per role, linked to the roles
//                     the résumé filled in. The report's central insight is
//                     derived from it, so it answers "is this a quiz?" first.
//   ranking           drag-to-rank the eight career values. The most tactile
//                     control in the product, ten seconds of work.
//   schedule          a plain choice PLUS the non-negotiable rider, the one
//                     that shows a hard constraint is respected downstream.
// career_history is exported as CONTEXT only: career_happiness reads it
// through `allResponses` (config.linkedQuestionId), and it is what the
// résumé step pre-fills. It is never rendered as a question of its own.
//
// Also exported per persona: the file name for the mocked résumé step and the
// message ids the "see what this became" links jump to in the chat replay
// (the section deliveries for approach/values, and the curation's pillTag
// anchor — the turn where the persona volunteers the constraint the survey
// asked about). Ids are verified against the committed fixtures, so a
// re-export after a new walkthrough fails loudly instead of linking nowhere.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const FIXTURES = join('src', 'demo', 'fixtures');
const OUT = join(FIXTURES, 'survey.json');

// The three questions, in the order the demo shows them.
const QUESTION_IDS = [
  '11111111-1111-1111-1111-11111111111d', // career_happiness
  '33333333-3333-3333-3333-333333333331', // ranking — career values
  '33333333-3333-3333-3333-333333333334', // schedule + non-negotiable rider
];
// Answer carried along for context only (career_happiness reads it).
const CONTEXT_IDS = ['11111111-1111-1111-1111-111111111110']; // career_history

const PERSONAS = {
  marcel: {
    fixture: 'marcel.nl.json',
    curation: 'marcel.nl.curation.json',
    email: 'demo.marloes@cairnly.io', // the login kept its original address
    resumeFile: 'Marcel_de_Vries_CV.pdf',
  },
  emma: {
    fixture: 'emma.en.json',
    curation: 'emma.en.curation.json',
    email: 'demo.emma@cairnly.io',
    resumeFile: 'Emma_Whitfield_Resume.pdf',
  },
};
// A believable PDF size for the mocked step, and the field count the real
// parser reports for a CV of this shape.
const RESUME_BYTES = 188_416;
const RESUME_FIELDS = 9;

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

// 1. The question rows, raw (label/choices English, translations alongside):
//    the demo resolves them per language exactly as useSurvey does.
const { data: rows, error: qErr } = await admin
  .from('questions')
  .select(
    'id, type, label, required, allow_multiple, allow_other, order_num, min_selections, max_selections, config, translations',
  )
  .in('id', [...QUESTION_IDS, ...CONTEXT_IDS]);
if (qErr) throw qErr;
const byId = Object.fromEntries((rows ?? []).map((r) => [r.id, r]));
for (const id of [...QUESTION_IDS, ...CONTEXT_IDS]) {
  if (!byId[id]) {
    console.error(`Question ${id} not found — the seeded ids changed?`);
    process.exit(1);
  }
}
const questions = QUESTION_IDS.map((id) => byId[id]);
const context = CONTEXT_IDS.map((id) => byId[id]);

// 2. Per persona: answers from the report payload + the jump targets.
const stripHtml = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
const personas = {};
for (const [personaId, meta] of Object.entries(PERSONAS)) {
  const fixture = JSON.parse(readFileSync(join(FIXTURES, meta.fixture), 'utf8'));
  const curation = JSON.parse(readFileSync(join(FIXTURES, meta.curation), 'utf8'));
  const lang = fixture.persona.language;

  const { data: report, error: rErr } = await admin
    .from('reports')
    .select('payload')
    .eq('id', fixture.persona.reportId)
    .single();
  if (rErr) throw rErr;
  const responses = report?.payload?.responses ?? {};

  const answers = {};
  for (const id of [...QUESTION_IDS, ...CONTEXT_IDS]) {
    if (responses[id] === undefined) {
      console.error(`${personaId}: no answer for ${id}`);
      process.exit(1);
    }
    answers[id] = responses[id];
  }
  // The non-negotiable flag lives in a sidecar, not in the answer.
  answers.__non_negotiables = responses.__non_negotiables ?? {};

  // Jump targets: the section deliveries carrying the section's own title,
  // and the pillTag turn (the constraint the persona volunteered).
  const titleOf = (type) => {
    const s = fixture.sections.find((x) => x.section_type === type);
    return stripHtml(s?.content_i18n?.[lang]?.title ?? s?.title ?? '');
  };
  const deliveryOf = (type) => {
    const title = titleOf(type);
    const hit = fixture.messages.find((m) => m.sender === 'bot' && title && m.content.includes(`### ${title}`));
    if (!hit) {
      console.error(`${personaId}: no delivered message for section ${type} (title "${title}")`);
      process.exit(1);
    }
    return hit.id;
  };
  const pillTag = (curation.annotations ?? []).find((a) => a.key === 'pillTag')?.messageId;
  if (!pillTag || !fixture.messages.some((m) => m.id === pillTag)) {
    console.error(`${personaId}: pillTag anchor missing from the curation or the transcript`);
    process.exit(1);
  }

  personas[personaId] = {
    language: lang,
    firstName: fixture.persona.firstName,
    resume: { fileName: meta.resumeFile, fileSizeBytes: RESUME_BYTES, fieldsExtracted: RESUME_FIELDS },
    answers,
    // questionId → the chat message that answer paid off in
    focus: {
      [QUESTION_IDS[0]]: deliveryOf('approach'),
      [QUESTION_IDS[1]]: deliveryOf('values'),
      [QUESTION_IDS[2]]: pillTag,
    },
  };
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      meta: { exportedAt: new Date().toISOString(), questionIds: QUESTION_IDS, contextIds: CONTEXT_IDS },
      questions,
      context,
      personas,
    },
    null,
    2,
  ) + '\n',
);

console.log(`questions:  ${questions.map((q) => q.type).join(', ')}`);
console.log(`context:    ${context.map((q) => q.type).join(', ')}`);
for (const [id, p] of Object.entries(personas)) {
  console.log(`${id.padEnd(7)} ${p.language} | résumé ${p.resume.fileName} | focus ${Object.values(p.focus).map((m) => m.slice(0, 8)).join(', ')}`);
}
console.log(`written:    ${OUT}`);
