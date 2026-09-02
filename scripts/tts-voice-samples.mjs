// Rendert TTS-samples zodat we met onze OREN kunnen kiezen welke stem het
// beste Nederlands spreekt, in plaats van te gokken.
//
// Waarom dit bestaat: de live tts edge function staat hard op voice 'nova'
// (Amerikaanse vrouwenstem) met ENGELSE delivery-instructies. Bij
// gpt-4o-mini-tts stuurt dat instructions-veld de uitspraak mee, dus Engelse
// instructies duwen ook Nederlandse tekst richting Engelse klankvorming.
// Dit script isoleert die twee variabelen:
//   1. welke stem?            → 5 kandidaten
//   2. instructies EN of NL?  → zelfde stem, twee varianten
// Plus per stem één Engelse sample, want wie nova vervangt verandert ook hoe
// het Engels klinkt. De stem moet in BEIDE talen werken.
//
// Run: set -a; source .env.local; set +a; node scripts/tts-voice-samples.mjs
//   (heeft OPENAI_API_KEY nodig in .env.local — staat er nu nog niet in)
//
// Output: scratchpad_tts/*.mp3 (gitignored via scratchpad*/)
import { mkdir, writeFile } from 'node:fs/promises';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('❌ OPENAI_API_KEY ontbreekt. Zet hem in .env.local en run:');
  console.error('   set -a; source .env.local; set +a; node scripts/tts-voice-samples.mjs');
  process.exit(1);
}

const OUT_DIR = 'scratchpad_tts';

// Identiek aan productie ([supabase/functions/tts/index.ts]) zodat wat je hier
// hoort ook is wat je straks in de chat hoort. Alleen voice + instructions
// variëren; model, format en speed staan vast.
const MODEL = 'gpt-4o-mini-tts';

// De 13 stemmen die gpt-4o-mini-tts accepteert (geverifieerd op de OpenAI
// docs, sept 2026). Er bestaat GEEN stem 'Daan' — namen als Daan komen van
// andere aanbieders, bv. de ElevenLabs-stemmenbibliotheek.
const ALL_VOICES = [
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova',
  'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
];

// Default: nova = de oude productiestem (nulmeting), ash = de nieuwe NL-stem,
// plus de dichtstbijzijnde alternatieven als ash tegenvalt. Overschrijfbaar
// zonder dit bestand aan te raken:
//   VOICES=onyx,cedar,verse node scripts/tts-voice-samples.mjs
const VOICES = (process.env.VOICES?.split(',').map((v) => v.trim()).filter(Boolean))
  ?? ['nova', 'ash', 'onyx', 'marin', 'cedar'];

const unknown = VOICES.filter((v) => !ALL_VOICES.includes(v));
if (unknown.length) {
  console.error(`❌ Onbekende stem(men): ${unknown.join(', ')}`);
  console.error(`   Geldig: ${ALL_VOICES.join(', ')}`);
  process.exit(1);
}

// Exact de string die nu live staat. Dit is de baseline-variant.
const INSTR_EN =
  'Speak at a brisk, upbeat conversational pace, like an energetic but ' +
  'warm career coach. Clear and natural, never rushed or robotic.';

// Zelfde intentie, maar in het Nederlands en met een expliciete tongval-hint.
// De laatste zin gaat over leenwoorden ("feedback", "senior"), precies waar
// een Amerikaans getrainde stem normaal uit de bocht vliegt.
const INSTR_NL =
  'Spreek vlot en natuurlijk Nederlands met een Nederlandse tongval, in een ' +
  'warm maar energiek tempo, zoals een enthousiaste loopbaancoach. Helder en ' +
  'menselijk, nooit gehaast of robotachtig. Spreek Engelse leenwoorden uit ' +
  'zoals een Nederlander dat doet.';

// Bewust een fonetische stresstest, geen makkelijke tekst: scherpe g (gaan,
// groep), sch (beschrijft, schaalbaarheid), ui (uitleg, uitwisselen), eu
// (keuze), ij (fijn), Engelse leenwoorden (feedback, senior, team) en cijfers
// als "8/10" — precies zoals ze in de echte chat staan.
const TEXT_NL =
  'Fijn dat die zin raak was. Het patroon dat je beschrijft zie ik terug in ' +
  'je scores: 8/10 voor senior klantcontact, maar 6/10 voor teamleider. Dat ' +
  'verschil is geen toeval. Jouw keuze om verantwoordelijkheid te nemen voor ' +
  'het resultaat, zonder de hele groep aan te sturen, past bij hoe je jezelf ' +
  'omschrijft. De uitleg over schaalbaarheid en het uitwisselen van feedback ' +
  'binnen je team sluit daar naadloos op aan. Zullen we dit verder uitwerken, ' +
  'of gaan we door naar de volgende suggestie?';

// Regressiecheck: klinkt de nieuwe stem ook nog goed in het Engels?
const TEXT_EN =
  'Good that the line landed. The pattern you describe shows up in your ' +
  'scores too: 8 out of 10 for senior client contact, but 6 out of 10 for ' +
  'team lead. That gap is not a coincidence. Choosing to own the outcome ' +
  'without steering the whole group fits how you describe yourself. Shall we ' +
  'work this out further, or move on to the next suggestion?';

// Elke render = één sample-bestand.
const JOBS = [
  ...VOICES.flatMap((voice) => [
    { file: `nl-${voice}-instr-en.mp3`, voice, text: TEXT_NL, instructions: INSTR_EN },
    { file: `nl-${voice}-instr-nl.mp3`, voice, text: TEXT_NL, instructions: INSTR_NL },
  ]),
  ...VOICES.map((voice) => ({
    file: `en-${voice}.mp3`, voice, text: TEXT_EN, instructions: INSTR_EN,
  })),
];

async function render({ file, voice, text, instructions }) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      voice,
      input: text,
      instructions,
      response_format: 'mp3',
      speed: 1.0,
    }),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text()}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(`${OUT_DIR}/${file}`, buf);
  return buf.length;
}

await mkdir(OUT_DIR, { recursive: true });
console.log(`Rendert ${JOBS.length} samples met ${MODEL} → ${OUT_DIR}/\n`);

let failed = 0;
// Sequentieel: 15 requests is niets, en zo blijft de log leesbaar en raken we
// geen rate limit als we later meer stemmen toevoegen.
for (const job of JOBS) {
  try {
    const bytes = await render(job);
    console.log(`✅ ${job.file.padEnd(26)} ${(bytes / 1024).toFixed(0)} KB`);
  } catch (err) {
    failed++;
    console.error(`❌ ${job.file.padEnd(26)} ${err.message}`);
  }
}

console.log(`\nKlaar. ${JOBS.length - failed}/${JOBS.length} gelukt.`);
console.log(`
Luistervolgorde:
  1. nl-nova-instr-en.mp3  ← de OUDE situatie (nova + Engelse instructies)
  2. nl-ash-instr-nl.mp3   ← de NIEUWE situatie, wat er nu op de branch staat
  3. rest van nl-*-instr-nl.mp3 ← alternatieven als ash tegenvalt
  4. nl-ash-instr-en.mp3   ← isoleert hoeveel de instructies alléén doen
  5. en-nova.mp3           ← Engels blijft ongewijzigd, puur ter controle
`);
