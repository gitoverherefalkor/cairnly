// Builds the survey payload for the Dutch demo persona, Marloes de Vries.
//
// WHY A SCRIPT AND NOT A HAND-WRITTEN JSON: multiple-choice answers must match
// the survey's option strings EXACTLY — they are markdown-laden ("**Energized**
// (I thrive on interaction)") and the workflows key off them. Transcribing 50 of
// those by hand is a guaranteed source of silent mismatches. So every choice
// here is written as a short distinctive SUBSTRING, resolved against the live
// `questions.config.choices` at build time, and the build fails loudly on a
// miss or an ambiguous match.
//
// Marloes is deliberately ORDINARY: a team lead at an insurer, HBO, steady
// career, wants fewer meetings and more meaning on 32 hours. A bureau's client
// looks like her, not like a Nike brand manager — the product's value shows
// best when the input is unremarkable and the output still finds something.
//
// Free text is in Dutch because a Dutch user answers in Dutch. The generators
// write English canonical regardless (language contract), and translate-section
// produces the Dutch document afterwards.
//
//   node scripts/demo-marloes-payload.mjs  ->  writes docs/report/demo-marloes-payload.json

import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');

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
  [Q('name')]: 'Marloes de Vries',
  [Q('pronoun')]: pick('She / Her'),
  [Q('age')]: 41,
  [Q('country')]: pick('Northern and Western Europe'),
  [Q('goals')]: picks('new career path', 'better work-life balance'),
  [Q('education')]: pick("Bachelor's degree"),
  [Q('subject')]: 'Bedrijfskunde (HBO), met een uitstroomprofiel dienstverlening en klantprocessen.',
  [Q('years')]: 18,
  [Q('situation')]: pick('Senior managerial role'),

  [Q('history')]: [
    { title: 'Teamleider Klantenservice', companyName: 'Regionale verzekeraar', sector: 'Verzekeringen',
      companySize: 'Large (201-1000)', companyCulture: 'Corporate',
      startMonth: 3, startYear: 2019, endMonth: null, endYear: null, isCurrent: true },
    { title: 'Senior Medewerker Klantcontact', companyName: 'Regionale verzekeraar', sector: 'Verzekeringen',
      companySize: 'Large (201-1000)', companyCulture: 'Corporate',
      startMonth: 1, startYear: 2015, endMonth: 2, endYear: 2019, isCurrent: false },
    { title: 'Medewerker Klantenservice', companyName: 'Energieleverancier', sector: 'Energie',
      companySize: 'Enterprise (1000-5000)', companyCulture: 'Corporate',
      startMonth: 9, startYear: 2011, endMonth: 12, endYear: 2014, isCurrent: false },
    { title: 'Administratief Medewerker', companyName: 'Accountantskantoor', sector: 'Zakelijke dienstverlening',
      companySize: 'Small (11-50)', companyCulture: 'Small Business Owner (up to 5 FTE)',
      startMonth: 8, startYear: 2007, endMonth: 8, endYear: 2011, isCurrent: false },
  ],

  [Q('happiness')]: [
    { title: 'Teamleider Klantenservice', companyName: 'Regionale verzekeraar', happiness: '6',
      reason: 'Ik doe het werk graag en mijn team draait goed, maar ik zit klem tussen wat het management wil en wat mijn mensen aankunnen. Er gaat te veel tijd op aan rapportages en overleg.' },
    { title: 'Senior Medewerker Klantcontact', companyName: 'Regionale verzekeraar', happiness: '8',
      reason: 'Veel direct klantcontact en ik was degene die de lastige gevallen oploste. Ik kwam thuis met het gevoel dat ik iets had betekend.' },
    { title: 'Medewerker Klantenservice', companyName: 'Energieleverancier', happiness: '4',
      reason: 'Strak op gespreksduur gestuurd. Weinig ruimte om een klant echt te helpen, alleen om het gesprek af te ronden.' },
    { title: 'Administratief Medewerker', companyName: 'Accountantskantoor', happiness: '5',
      reason: 'Prettige collega’s en ik leerde er nauwkeurig werken, maar het werk zelf was voorspelbaar en eenzaam.' },
  ],

  [Q('skills')]: {
    topSkills: ['Coachen van medewerkers', 'De-escaleren bij klachten', 'Werkprocessen verbeteren',
                'Roosters en bezetting plannen', 'Schriftelijke communicatie'],
    topSkillRanks: ['Coachen van medewerkers', 'De-escaleren bij klachten', 'Werkprocessen verbeteren'],
    achievements: 'Klanttevredenheid van mijn team in twee jaar van 7,1 naar 8,0 gebracht. Het inwerkprogramma voor nieuwe medewerkers herschreven, waardoor de inwerktijd van tien naar zes weken ging. Twee medewerkers begeleid naar een senior rol.',
    certifications: 'Praktijkopleider (Kenniscentrum), basistraining Coachend Leidinggeven',
    languages: 'Nederlands (moedertaal), Engels (goed), Duits (basis)',
  },

  [Q('interests')]: {
    interests: ['Vrijwilligerswerk bij de lokale voedselbank', 'Hardlopen', 'Volkstuin',
                'Koken voor grote groepen', 'Podcasts over psychologie'],
  },

  [Q('extra')]: 'Ik werk nu 36 uur en wil terug naar 32, mijn kinderen zijn 8 en 11. Ik wil niet per se weg bij mijn werkgever, maar ik merk dat ik leegloop op het aantal overleggen en de rapportagedruk. Wat ik het liefste doe is mensen beter maken in hun werk. Een dagelijkse reis van meer dan 45 minuten is voor mij niet haalbaar.',

  // Section 2 — working style
  '22222222-2222-2222-2222-222222222221': pick('Somewhat Energized'),
  '22222222-2222-2222-2222-222222222222': pick('gut feeling and how it affects others'),
  '22222222-2222-2222-2222-222222222223': pick('Leaning Deliberative'),
  '22222222-2222-2222-2222-222222222224': pick('Adapt my style based on the audience'),
  '22222222-2222-2222-2222-222222222225': pick('Leaning Structure'),
  '22222222-2222-2222-2222-222222222226': pick('seek compromise to maintain harmony'),
  '22222222-2222-2222-2222-222222222227': pick('Somewhat Structured'),
  '22222222-2222-2222-2222-222222222228': pick('Uncomfortable'),
  '22222222-2222-2222-2222-222222222229': pick('Leaning Action'),
  '22222222-2222-2222-2222-22222222222a': picks('Taking on too much responsibility', 'Avoiding confrontation',
                                                'Difficulty delegating tasks'),

  // Section 3 — values and conditions
  '33333333-3333-3333-3333-333333333331': picks('Work-Life Balance', 'Job Satisfaction', 'Autonomy'),
  '33333333-3333-3333-3333-333333333332': pick('Very'),
  '33333333-3333-3333-3333-333333333333': pick('Essential'),
  '33333333-3333-3333-3333-333333333334': pick('Part-time work'),
  '33333333-3333-3333-3333-333333333335': pick('Moderately important'),
  '33333333-3333-3333-3333-333333333336': pick('50,000–75,000'),
  '33333333-3333-3333-3333-333333333337': pick('Work-life balance perks'),
  '33333333-3333-3333-3333-333333333338': picks('High-pressure or fast-paced', 'Frequent decision-making'),

  // Section 4 — interests and knowledge
  '44444444-4444-4444-4444-444444444441': picks('Human Resources & People Operations', 'Education & Learning'),
  '44444444-4444-4444-4444-444444444442': picks('The Adapter', 'The Leader'),
  '44444444-4444-4444-4444-444444444443': pick('Collaborative and team-oriented'),
  '44444444-4444-4444-4444-444444444444': 'Hoe je een klantenserviceteam draaiende houdt zonder dat mensen opbranden. Ik weet precies waar in een klantproces de irritatie ontstaat en hoe je dat eruit haalt.',
  '44444444-4444-4444-4444-444444444445': pick('Somewhat familiar'),
  '44444444-4444-4444-4444-444444444446': picks('Project Management and Leadership'),
  '44444444-4444-4444-4444-444444444447': 'Collega’s komen bij mij als ze vastlopen met een lastige klant, of als ze twijfelen of dit werk nog bij ze past. Ik krijg vaak te horen dat ik goed kan luisteren zonder meteen met een oplossing te komen.',
  '44444444-4444-4444-4444-444444444448': 'Iets doen met het opleiden en begeleiden van mensen. Loopbaanbegeleider of trainer lijkt me mooi, maar ik weet niet of ik daar de papieren voor heb.',

  // Section 5 — teams
  '55555555-5555-5555-5555-555555555551': pick('Ensure execution by keeping tasks organized'),
  '55555555-5555-5555-5555-555555555552': pick('Achieving common goals'),
  '55555555-5555-5555-5555-555555555553': pick('Medium (6-10 people)'),
  '55555555-5555-5555-5555-555555555554': pick('Seek a compromise to maintain harmony'),
  '55555555-5555-5555-5555-555555555555': picks('Challenges with delegation', 'Managing different work styles'),
  '55555555-5555-5555-5555-555555555556': pick('Steady Planner'),
  '55555555-5555-5555-5555-555555555557': pick('Coaching style'),
  '55555555-5555-5555-5555-555555555558': pick('Approach them privately'),

  // Section 6 — emotional intelligence
  '66666666-6666-6666-6666-666666666661': pick('actively seek it'),
  '66666666-6666-6666-6666-666666666662': pick('encouraging but are careful not to offend'),
  '66666666-6666-6666-6666-666666666663': pick('Offer support and listen empathetically'),
  '66666666-6666-6666-6666-666666666664': pick('Remain calm and control your emotions'),
  '66666666-6666-6666-6666-666666666665': pick('Talk to colleagues or friends'),
  '66666666-6666-6666-6666-666666666666': pick('Keep it mostly work-focused'),
  '66666666-6666-6666-6666-666666666667': picks('Handling conflict constructively', 'Managing stress effectively'),

  // Section 7 — goals and growth
  '77777777-7777-7777-7777-777777777771': picks('Improve work-life balance', 'Gain experience in a different role'),
  '77777777-7777-7777-7777-777777777772': picks('Make a significant contribution to society', 'Establish expertise and recognition'),
  '77777777-7777-7777-7777-777777777773': picks('Uncertainty about my next career step', 'Gaps in skills or professional development',
                                                'Work-life balance constraints'),
  '77777777-7777-7777-7777-777777777774': pick('Yes, if relevant to my career'),
  '77777777-7777-7777-7777-777777777775': picks('People & Culture (HR)', 'Communication & Public Speaking'),
  '77777777-7777-7777-7777-777777777776': pick('Not for me'),

  // Schedule is the thing she will not bend on.
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
  // An exact match always wins: "Uncomfortable" is a substring of "Very
  // uncomfortable", and substring-only matching made that pair ambiguous.
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

if (problems.length) {
  console.error('UNRESOLVED CHOICES:\n' + problems.join('\n'));
  process.exit(1);
}

const payload = {
  survey_id: SURVEY_ID,
  surveyType: 'Office / Business Pro - 2025 v1 EN',
  accessCode: 'DEMO-NL-MARLOES',
  completedAt: new Date().toISOString(),
  responses,
};

const out = path.join('docs', 'report', 'demo-marloes-payload.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload, null, 2));
console.log(`✅ resolved ${Object.keys(responses).length} responses -> ${out}`);
