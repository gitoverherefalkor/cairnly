// Builds the survey payload for the English demo persona, Emma Whitfield.
//
// Same mechanism as demo-marcel-payload.mjs: every multiple-choice answer is
// written as a short distinctive SUBSTRING and resolved against the live
// `questions.config.choices` at build time (exact match wins, then unique
// substring), and the build fails loudly on a miss or an ambiguous match. The
// option strings are markdown-laden and the workflows key off them, so hand
// transcription is a guaranteed source of silent mismatches.
//
// Emma is the ASPIRATIONAL persona for the paying (English-speaking) audience,
// where Marloes is deliberately ordinary for the bureau audience: 38, a
// master's degree, senior marketing manager at a London fintech scale-up,
// three direct reports. Not burnt out, "hollowed out": she can do the job
// with her eyes closed, the AI content tools make her wonder which part of
// her craft is actually hers, and she wants work that matters. The demo
// argument is that the coach finds something in a profile that already looks
// successful on paper.
//
// Free text is English: an English user answers in English, and English is
// the canonical report language anyway (no translation pass needed).
//
//   node scripts/demo-emma-payload.mjs  ->  writes docs/report/demo-emma-payload.json

import fs from 'node:fs';
import path from 'node:path';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const URL = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (env or .env.local)');

const SURVEY_ID = '00000000-0000-0000-0000-000000000001';
const Q = (suffix) => {
  const map = {
    name: '11111111-1111-1111-1111-11111111111a',
    pronoun: '11111111-1111-1111-1111-11111111111b',
    age: '11111111-1111-1111-1111-111111111113',
    country: '11111111-1111-1111-1111-111111111114',
    goals: '11111111-1111-1111-1111-111111111115',
    education: '11111111-1111-1111-1111-111111111116',
    subject: '11111111-1111-1111-1111-111111111117',
    years: '11111111-1111-1111-1111-111111111118',
    situation: '11111111-1111-1111-1111-111111111119',
    history: '11111111-1111-1111-1111-111111111110',
    happiness: '11111111-1111-1111-1111-11111111111d',
    skills: '11111111-1111-1111-1111-11111111111f',
    interests: '11111111-1111-1111-1111-111111111120',
    extra: '11111111-1111-1111-1111-111111111121',
  };
  return map[suffix] ?? suffix;
};

// ── The answers ────────────────────────────────────────────────────────────
// `pick`/`picks` values are SUBSTRINGS, resolved below.
const pick = (s) => ({ __pick: s });
const picks = (...a) => ({ __picks: a });

const ANSWERS = {
  // Section 1 — about her
  [Q('name')]: 'Emma Whitfield',
  [Q('pronoun')]: pick('She / Her'),
  [Q('age')]: 38,
  [Q('country')]: pick('United Kingdom (London)'),
  [Q('goals')]: picks('new career path', 'burnout or lack of fulfillment'),
  [Q('education')]: pick("Master's degree"),
  [Q('subject')]: 'BA English Literature, then an MA in Strategic Communication.',
  [Q('years')]: 15,
  [Q('situation')]: pick('Managerial or leadership role'),

  [Q('history')]: [
    { title: 'Senior Marketing Manager', companyName: 'B2B fintech scale-up', sector: 'Financial technology',
      companySize: 'Medium (51-200)', companyCulture: 'Startup / Scale-up',
      startMonth: 4, startYear: 2021, endMonth: null, endYear: null, isCurrent: true },
    { title: 'Marketing Manager', companyName: 'Global consumer goods brand', sector: 'Consumer goods',
      companySize: 'Multi National (5000+)', companyCulture: 'Corporate',
      startMonth: 9, startYear: 2017, endMonth: 3, endYear: 2021, isCurrent: false },
    { title: 'Brand Strategist', companyName: 'Brand and communications agency', sector: 'Marketing and advertising',
      companySize: 'Small (11-50)', companyCulture: 'Agency / Consultancy',
      startMonth: 6, startYear: 2013, endMonth: 8, endYear: 2017, isCurrent: false },
    { title: 'Communications Executive', companyName: 'Arts charity', sector: 'Arts and culture',
      companySize: 'Small (11-50)', companyCulture: 'Nonprofit / Social Impact',
      startMonth: 9, startYear: 2010, endMonth: 5, endYear: 2013, isCurrent: false },
  ],

  [Q('happiness')]: [
    { title: 'Senior Marketing Manager', companyName: 'B2B fintech scale-up', happiness: '5',
      reason: "Broad scope and a team of three I genuinely like, but half my week goes on dashboards, attribution debates and re-forecasting pipeline. The parts I'm actually good at, positioning and telling the story, get squeezed to the edges. And since we brought in AI content tools I keep wondering which part of my craft is still mine." },
    { title: 'Marketing Manager', companyName: 'Global consumer goods brand', happiness: '7',
      reason: "Proper brand work with real budgets, campaigns I'm still proud of. Decisions took forever and I spent a lot of time managing upwards, but I loved turning research into a story the whole company could rally behind." },
    { title: 'Brand Strategist', companyName: 'Brand and communications agency', happiness: '8',
      reason: "The best years. Every few weeks a new client problem, a workshop, a strategy deck that made a room go quiet. Long hours, badly paid, and I never once watched the clock." },
    { title: 'Communications Executive', companyName: 'Arts charity', happiness: '6',
      reason: 'A cause I cared about and where I learned to write for real audiences. But tiny budgets, no path upward and I was doing three jobs at once.' },
  ],

  [Q('skills')]: {
    topSkills: ['Positioning and messaging', 'Workshop facilitation', 'Brand storytelling',
                'Customer research synthesis', 'Stakeholder management'],
    topSkillRanks: ['Positioning and messaging', 'Workshop facilitation', 'Customer research synthesis'],
    achievements: "Led the repositioning of our core product from feature-led to outcome-led messaging; the average sales cycle shortened by about 20% over the following two quarters. Built a customer-insight programme (30+ interviews a year) that the product team now relies on more than marketing does. Ran a brand relaunch across 12 markets at my previous employer. Mentor two junior marketers, one of whom was promoted last year.",
    certifications: 'CIM Diploma in Professional Marketing; Design Sprint facilitation training (AJ&Smart)',
    languages: 'English (native), French (conversational)',
  },

  [Q('interests')]: {
    interests: ['Long-distance hiking', 'Pottery', 'Reading about how people make decisions'],
  },

  [Q('extra')]: "I'm 38, no children, my partner is a nurse working shifts, so flexibility matters more to me than a bigger salary. I'm not burnt out exactly, more hollowed out: I can do this job with my eyes closed and that scares me. I would take a pay cut for work that feels like it matters, within reason, there is a London mortgage. Hybrid is fine, fully remote is not what I want. And I want to understand where AI leaves someone like me instead of quietly dreading it.",

  // Section 2 — working style
  '22222222-2222-2222-2222-222222222221': pick('Somewhat Energized'),
  '22222222-2222-2222-2222-222222222222': pick('long-term, big-picture'),
  '22222222-2222-2222-2222-222222222223': pick('Leaning Open'),
  '22222222-2222-2222-2222-222222222224': pick('analogies and metaphors'),
  '22222222-2222-2222-2222-222222222225': pick('Leaning Novelty'),
  '22222222-2222-2222-2222-222222222226': pick('seek compromise to maintain harmony'),
  '22222222-2222-2222-2222-222222222227': pick('Somewhat Flexible'),
  '22222222-2222-2222-2222-222222222228': pick('Comfortable'),
  '22222222-2222-2222-2222-222222222229': pick('Leaning Analysis'),
  '22222222-2222-2222-2222-22222222222a': picks('Perfectionism leading to delays', 'Being overly critical of self or others',
                                                'Taking on too much responsibility'),

  // Section 3 — values and conditions
  '33333333-3333-3333-3333-333333333331': picks('Helping Others & Making an Impact', 'Personal Growth & Challenge', 'Autonomy'),
  '33333333-3333-3333-3333-333333333332': pick('Very'),
  '33333333-3333-3333-3333-333333333333': pick('Very'),
  '33333333-3333-3333-3333-333333333334': pick('Flexible hours'),
  '33333333-3333-3333-3333-333333333335': pick('Moderately important'),
  '33333333-3333-3333-3333-333333333336': pick('50,000–75,000'),
  '33333333-3333-3333-3333-333333333337': pick('Work-life balance perks'),
  '33333333-3333-3333-3333-333333333338': picks('Data-heavy or analytical roles', 'Solo or independent work'),

  // Section 4 — interests and knowledge
  '44444444-4444-4444-4444-444444444441': picks('Business Strategy & Consulting', 'Education & Learning', 'Social Impact & Nonprofit'),
  '44444444-4444-4444-4444-444444444442': picks('The Communicator', 'The Visionary'),
  '44444444-4444-4444-4444-444444444443': pick('Innovative and forward-thinking'),
  '44444444-4444-4444-4444-444444444444': "How people actually make buying decisions versus how they say they do. I've sat in on hundreds of customer interviews and can usually tell within ten minutes which story a company is telling itself. Also positioning: taking a messy product and finding the one sentence that makes it make sense.",
  '44444444-4444-4444-4444-444444444445': pick('Moderately familiar'),
  '44444444-4444-4444-4444-444444444446': picks('Marketing Strategies and Brand Development', 'Innovation and Product Development'),
  '44444444-4444-4444-4444-444444444447': "Usually it's \"can you help me say this better\". Colleagues bring me a deck or an email that isn't landing and I help them find the actual point. Friends come to me when they're weighing a big decision, a job offer, a move, because I ask the questions they've been avoiding.",
  '44444444-4444-4444-4444-444444444448': 'Documentary producer, or running a small research studio that helps organisations understand the people they serve.',

  // Section 5 — teams
  '55555555-5555-5555-5555-555555555551': pick('Offer ideas and actively engage'),
  '55555555-5555-5555-5555-555555555552': pick('Learning from others'),
  '55555555-5555-5555-5555-555555555553': pick('Small (2-5 people)'),
  '55555555-5555-5555-5555-555555555554': pick('Address them directly'),
  '55555555-5555-5555-5555-555555555555': picks('Trusting team members to complete tasks', 'Balancing individual and team responsibilities'),
  '55555555-5555-5555-5555-555555555556': pick('Deadline-Aware'),
  '55555555-5555-5555-5555-555555555557': pick('Delegating autonomy'),
  '55555555-5555-5555-5555-555555555558': pick('Voice concerns openly'),

  // Section 6 — emotional intelligence
  '66666666-6666-6666-6666-666666666661': pick('actively seek it'),
  '66666666-6666-6666-6666-666666666662': pick('encouraging but are careful not to offend'),
  '66666666-6666-6666-6666-666666666663': pick('Offer support and listen empathetically'),
  '66666666-6666-6666-6666-666666666664': pick('Remain calm and control your emotions'),
  '66666666-6666-6666-6666-666666666665': pick('mindfulness or stress-reduction'),
  '66666666-6666-6666-6666-666666666666': pick('Actively engage in social interactions'),
  '66666666-6666-6666-6666-666666666667': picks('Receiving criticism without defensiveness', 'Motivating myself and others'),

  // Section 7 — goals and growth
  '77777777-7777-7777-7777-777777777771': picks('Gain experience in a different role', 'Develop new skills or certifications'),
  '77777777-7777-7777-7777-777777777772': picks('Make a significant contribution to society', 'Continuously learn and adapt'),
  '77777777-7777-7777-7777-777777777773': picks('Misalignment with personal values', 'Uncertainty about my next career step'),
  '77777777-7777-7777-7777-777777777774': pick('Yes, always seeking new skills'),
  '77777777-7777-7777-7777-777777777775': picks('Strategic Planning & Big-Picture Thinking', 'AI & Automation', 'Creative Thinking & Innovation'),
  '77777777-7777-7777-7777-777777777776': pick('Curious about it, but not actively planning'),

  // Flexibility is the one thing she will not trade (her partner's shifts).
  __non_negotiables: { '33333333-3333-3333-3333-333333333334': true },
};

// ── Resolve substrings against the real choices ────────────────────────────
const res = await fetch(`${URL}/rest/v1/questions?select=id,label,config`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!res.ok) throw new Error(`questions fetch failed: ${res.status}`);
const questions = await res.json();
const byId = new Map(questions.map((q) => [q.id, q]));

const problems = [];
function resolveOne(qid, needle) {
  const choices = byId.get(qid)?.config?.choices;
  if (!Array.isArray(choices)) {
    problems.push(`${qid}: no choices on question (needle "${needle}")`);
    return needle;
  }
  // An exact match always wins: "Comfortable" is a substring of "Very
  // comfortable", and substring-only matching made that pair ambiguous.
  const exact = choices.find((c) => c.toLowerCase() === needle.toLowerCase());
  if (exact) return exact;
  const hits = choices.filter((c) => c.toLowerCase().includes(needle.toLowerCase()));
  if (hits.length === 0) {
    problems.push(`${qid}: NO MATCH for "${needle}" in [${choices.map((c) => c.slice(0, 40)).join(' | ')}]`);
    return needle;
  }
  if (hits.length > 1) {
    problems.push(`${qid}: AMBIGUOUS "${needle}" -> ${hits.length} matches`);
    return hits[0];
  }
  return hits[0];
}

const responses = {};
for (const [qid, val] of Object.entries(ANSWERS)) {
  if (val && typeof val === 'object' && '__pick' in val) responses[qid] = resolveOne(qid, val.__pick);
  else if (val && typeof val === 'object' && '__picks' in val)
    responses[qid] = val.__picks.map((n) => resolveOne(qid, n));
  else responses[qid] = val;
}

// Respect the survey's own selection caps, so the payload could have come
// from the real form.
for (const [qid, val] of Object.entries(responses)) {
  const max = byId.get(qid)?.config?.max_selections;
  if (max && Array.isArray(val) && val.length > max) problems.push(`${qid}: ${val.length} picks, max ${max}`);
}

if (problems.length) {
  console.error('UNRESOLVED CHOICES:\n' + problems.join('\n'));
  process.exit(1);
}

const payload = {
  survey_id: SURVEY_ID,
  surveyType: 'Office / Business Pro - 2025 v1 EN',
  accessCode: 'DEMO-EN-EMMA',
  completedAt: new Date().toISOString(),
  responses,
};

const out = path.join('docs', 'report', 'demo-emma-payload.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`✅ resolved ${Object.keys(responses).length} responses -> ${out}`);
