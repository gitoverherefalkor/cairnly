#!/usr/bin/env tsx
/**
 * demo-translate-fixture — the demo-layer translation of a frozen session.
 *
 *   npx tsx scripts/demo-translate-fixture.ts marcel --to=en
 *   npx tsx scripts/demo-translate-fixture.ts emma --to=nl
 *   npx tsx scripts/demo-translate-fixture.ts marcel --to=en --only=<id,id> --force
 *
 * Writes src/demo/fixtures/<persona>.<from>.messages.<to>.json: every chat
 * message of the fixture in the target language, plus the chat_highlights
 * section (the one section the product's own translator leaves alone). The
 * loader overlays this on the fixture when the visitor's UI language is the
 * target language, so a Dutch visitor can read Emma and an English one
 * Marcel. Idempotent: existing entries are kept unless --force / --only.
 *
 * The product itself never translates chat messages, so nothing here touches
 * the database. Report sections are NOT translated here either: those go
 * through translate-section (the product's gated translator) and land in
 * report_sections.content_i18n; run that first and re-export the fixture.
 *
 * How each message is translated, most faithful first:
 *   reconstructed  a section delivery whose stored text still equals what
 *                  the product renders from the section today → rendered
 *                  again with renderSection() in the target language, i.e.
 *                  exactly what the product would have delivered.
 *   comparison     the "Explain this comparison" reply → the stored
 *                  comparison explanation in the target language.
 *   mapped         canned quick-reply turns (Continue, Explore, Wrap up,
 *                  the welcome click) → the product's own strings.
 *   template       the Move-pill question → buildFeasibilityQuestion's
 *                  template in the target language.
 *   option         a follow-up choice the persona clicked → the same bullet
 *                  of the translated follow-up message.
 *   scoped         "[Over <role>] …" → "[About <role>] …" with the role from
 *                  the glossary and the rest translated.
 *   llm            everything else (typed turns, coach replies, and section
 *                  deliveries WF6 rewrote after the chat) → Claude, with a
 *                  glossary of the report's own titles and the persona's
 *                  typing style preserved.
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSection } from '../supabase/functions/deliver-section/renderer.ts';
import { companyContext } from '../supabase/functions/deliver-section/companyContext.ts';
import { sectionI18n, sectionText, sectionTitle } from '../supabase/functions/_shared/sectionText.ts';

const MODEL = 'claude-opus-5';
const FIXTURES = join('src', 'demo', 'fixtures');
const SECTION_TYPES = [
  'approach', 'strengths', 'development', 'values',
  'top_career_1', 'top_career_2', 'top_career_3', 'runner_ups', 'outside_box', 'dream_jobs',
] as const;
const CAREER_TYPES = new Set(['top_career_1', 'top_career_2', 'top_career_3', 'runner_ups', 'outside_box', 'dream_jobs']);

// ---------- args ----------
const persona = process.argv[2];
const flag = (name: string) => {
  const hit = process.argv.slice(3).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const to = (flag('to') ?? '').slice(0, 2).toLowerCase();
const force = process.argv.includes('--force');
const dry = process.argv.includes('--dry');
const only = new Set((flag('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean));
if (!persona || !to) {
  console.error('usage: npx tsx scripts/demo-translate-fixture.ts <persona> --to=<lang> [--force] [--dry] [--only=id,id]');
  process.exit(1);
}

// ---------- env ----------
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
if (!env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY missing from .env.local');
  process.exit(1);
}
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// ---------- fixture ----------
const fixtureFile = readdirSync(FIXTURES).find((f) => {
  const parts = f.split('.');
  return parts.length === 3 && parts[0] === persona && parts[2] === 'json';
});
if (!fixtureFile) {
  console.error(`No fixture <${persona}>.<lang>.json in ${FIXTURES}`);
  process.exit(1);
}
const from = fixtureFile.split('.')[1];
if (from === to) {
  console.error(`Fixture is already in ${to}.`);
  process.exit(1);
}
type Section = {
  id: string;
  section_type: string;
  title: string | null;
  content: string;
  order_number: number | null;
  company_size_type: string | null;
  alternate_titles: string | null;
  metadata: { comparison?: { headline?: string; explanation?: string }; move?: string } | null;
  content_i18n: Record<string, { title?: string | null; content?: string; comparison?: { headline?: string; explanation?: string } | null }> | null;
};
type Message = { id: string; sender: 'user' | 'bot'; content: string; metadata?: { quick_reply?: string } | null };
type Fixture = { persona: { firstName: string; language: string }; messages: Message[]; sections: Section[] };
const fixture = JSON.parse(readFileSync(join(FIXTURES, fixtureFile), 'utf8')) as Fixture;
const firstName = fixture.persona.firstName;
const isHe = persona === 'marcel';

const sidecarPath = join(FIXTURES, `${persona}.${from}.messages.${to}.json`);
type Sidecar = {
  meta: { persona: string; from: string; to: string; model: string; translatedAt: string; methods: Record<string, string> };
  messages: Record<string, string>;
  sections: Record<string, { title: string; content: string }>;
};
const sidecar: Sidecar = existsSync(sidecarPath)
  ? (JSON.parse(readFileSync(sidecarPath, 'utf8')) as Sidecar)
  : { meta: { persona, from, to, model: MODEL, translatedAt: '', methods: {} }, messages: {}, sections: {} };

// ---------- helpers ----------
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const normTitle = (s: string) =>
  s.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/[-‐-―]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const stripHtml = (s: string | null | undefined) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();

// Section text/title in a language, as deliver-section resolves them.
const resolveRows = (rows: Section[], lang: string) =>
  rows.map((r) => ({ ...r, title: sectionTitle(r, lang) ?? r.title, content: sectionText(r, lang) || r.content }));
const titleIn = (s: Section, lang: string) => stripHtml(sectionTitle(s, lang) ?? s.title);

// ---------- glossary: titles the report itself uses ----------
// source variants (delivered heading, stored translation) → target title.
const titleMap = new Map<string, string>();
const glossaryLines: string[] = [];
for (const s of fixture.sections) {
  if (!s.title) continue;
  const target = titleIn(s, to);
  const source = titleIn(s, from);
  if (!target || !source) continue;
  titleMap.set(normTitle(source), target);
  titleMap.set(normTitle(stripHtml(s.title)), target);
  glossaryLines.push(`«${source}» → «${target}»`);
}
// Headings as they were actually delivered can differ from today's stored
// titles (re-translation drift, e.g. "HR-adviseur" vs "HR Adviseur"): map
// every delivered heading onto the section it belongs to.
for (const m of fixture.messages) {
  if (m.sender !== 'bot') continue;
  for (const h of m.content.matchAll(/^###\s+(.+)$/gm)) {
    const heading = stripHtml(h[1]);
    const key = normTitle(heading);
    if (titleMap.has(key)) continue;
    const hit = fixture.sections.find((s) => {
      const cands = [stripHtml(s.title ?? ''), ...Object.values(s.content_i18n ?? {}).map((e) => stripHtml(e?.title ?? ''))]
        .map(normTitle)
        .filter(Boolean);
      return cands.some((c) => c === key || c.includes(key) || key.includes(c));
    });
    if (hit) {
      const target = titleIn(hit, to);
      titleMap.set(key, target);
      glossaryLines.push(`«${heading}» → «${target}»`);
    }
  }
}
const translateTitle = (raw: string) => titleMap.get(normTitle(raw)) ?? null;

// Sub-section headings (##### …). The chat picks icons by EXACT match on
// the prompt's fixed subheaders (subsectionIcons.ts), so a free translation
// ("Insight into your growth areas" for "Understanding Potential Growth
// Areas") silently loses the icon. The report carries every subheader in
// both languages in the same order, so map source → target by position.
const headingMap = new Map<string, string>();
const h5s = (html: string | null | undefined) => [...(html ?? '').matchAll(/<h5>(.+?)<\/h5>/g)].map((m) => stripHtml(m[1]));
for (const s of fixture.sections) {
  const src = h5s(from === 'en' ? s.content : sectionI18n(s, from)?.content);
  const tgt = h5s(to === 'en' ? s.content : sectionI18n(s, to)?.content);
  if (src.length && src.length === tgt.length) src.forEach((h, i) => headingMap.set(normTitle(h), tgt[i]));
}
const headingPairs = [...new Set([...headingMap.entries()].map(([k, v]) => `«${k}» → «${v}»`))];
// Company size/type lines (#### …): the renderer localises them through
// companyContext(), so map the source rendering of each raw value to its
// target rendering and align by position, like the subheadings.
const sizeLineMap = new Map<string, string>();
for (const s of fixture.sections) {
  if (!s.company_size_type) continue;
  const raw = stripHtml(s.company_size_type);
  sizeLineMap.set(normTitle(companyContext(raw, from)), companyContext(raw, to));
}

/** Replace the target's ##### and #### lines with the report's own, by position. */
function alignSubheadings(source: string, target: string): string {
  let out = target;
  for (const [level, map] of [['#####', headingMap], ['####', sizeLineMap]] as const) {
    const re = new RegExp(`^${level}\\s+(.+)$`, 'gm');
    const isLine = new RegExp(`^${level}\\s+(?!#)`);
    const srcHeads = [...source.matchAll(re)].map((m) => stripHtml(m[1]));
    const lines = out.split('\n');
    const idx = lines.map((l, i) => (isLine.test(l) ? i : -1)).filter((i) => i >= 0);
    if (!srcHeads.length || srcHeads.length !== idx.length) continue;
    srcHeads.forEach((h, i) => {
      const mapped = map.get(normTitle(h));
      if (mapped) lines[idx[i]] = `${level} ${mapped}`;
    });
    out = lines.join('\n');
  }
  return out;
}

// Company size/type lines, both languages, from the report's own values.
const sizeLines = new Set<string>();
for (const s of fixture.sections) {
  if (!s.company_size_type) continue;
  const raw = stripHtml(s.company_size_type);
  sizeLines.add(`«${companyContext(raw, from)}» → «${companyContext(raw, to)}»`);
}

// UI phrases the coach quotes (quick replies, pills, buttons).
const chatJson = (lang: string) => JSON.parse(readFileSync(join('public', 'locales', lang, 'chat.json'), 'utf8'));
const cjFrom = chatJson(from);
const cjTo = chatJson(to);
const uiPairs: string[] = [];
for (const key of ['continue', 'explore', 'differently', 'somethingElse', 'wrapUp']) {
  uiPairs.push(`«${cjFrom.quickReplies[key].label}» → «${cjTo.quickReplies[key].label}»`);
}
uiPairs.push(`«${cjFrom.careerPills.askAboutRole}» → «${cjTo.careerPills.askAboutRole}»`);
uiPairs.push(`«${cjFrom.comparison.explain}» → «${cjTo.comparison.explain}»`);
uiPairs.push(`«${cjFrom.ui.keep}» → «${cjTo.ui.keep}»`);
const ALT_LABEL: Record<string, string> = { en: 'Alternate titles:', nl: 'Alternatieve functietitels:' };
const MOVE: Record<string, Record<string, string>> = {
  en: { 'Ready now': 'Ready now', Reframe: 'Reframe', Upskill: 'Upskill', Retrain: 'Retrain' },
  nl: { 'Ready now': 'Direct inzetbaar', Reframe: 'Herpositioneren', Upskill: 'Bijscholen', Retrain: 'Omscholen' },
};
const movePairs = Object.keys(MOVE.en).map((k) => `«${MOVE[from][k]}» → «${MOVE[to][k]}»`);

// Canned turns: the product's own strings in both languages.
const canned = new Map<string, string>();
for (const key of ['continue', 'explore', 'wrapUp', 'skip']) {
  canned.set(norm(cjFrom.quickReplies[key].message), cjTo.quickReplies[key].message);
}
canned.set(norm(cjFrom.welcome.readyMessage), cjTo.welcome.readyMessage);

// Move-pill question (buildFeasibilityQuestion in ChatMessage.tsx).
const FEAS: Record<string, { parse: RegExp; level: RegExp; build: (role: string, label: string | null) => string }> = {
  nl: {
    parse: /^Hoe realistisch is de overstap naar (.+?) vanaf waar ik nu sta/,
    level: /als "([^"]+)"/,
    build: (role, label) =>
      `Hoe realistisch is de overstap naar ${role} vanaf waar ik nu sta, en wat zou ik moeten leren of bijleren om daar te komen?` +
      (label ? ` Mijn rapport beoordeelt de benodigde stap voor deze overstap als "${label}". Leg uit waarom die beoordeling zo is, en of die klopt.` : ''),
  },
  en: {
    parse: /^How realistic is the move into (.+?) from where I am now/,
    level: /as "([^"]+)"/,
    build: (role, label) =>
      `How realistic is the move into ${role} from where I am now, and what would I need to learn or reskill to get there?` +
      (label ? ` My report rates the reskilling effort for this move as "${label}". Explain why it is rated that, and whether it holds up.` : ''),
  },
};
const ABOUT: Record<string, RegExp> = { nl: /^\[Over\s+(.+?)\]\s*/, en: /^\[About\s+(.+?)\]\s*/ };
const ABOUT_PREFIX: Record<string, (role: string) => string> = { nl: (r) => `[Over ${r}] `, en: (r) => `[About ${r}] ` };
const ESCAPE: Record<string, RegExp> = { en: /something else|let me know|on your mind/i, nl: /iets anders|wat je bezighoudt/i };

// Follow-up option bullets, parsed the way ChatMessage's detectFollowUpOptions does.
const BULLET = /^\s*-\s*(?:\*\*(.+?)\*\*\s*(.*)|(.+))$/;
function optionMessages(markdown: string): string[] {
  if (/^### /m.test(markdown)) return [];
  const out: string[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(BULLET);
    if (!m) continue;
    const title = (m[1] !== undefined ? m[1] : m[3] ?? '').trim().replace(/[!?.]+$/, '');
    out.push(title);
  }
  return out;
}

// ---------- the model ----------
const LANG_NAME: Record<string, string> = { en: 'English', nl: 'Dutch' };
const system = [
  `You translate a ${LANG_NAME[from]} career-coaching chat transcript into ${LANG_NAME[to]} for a public product demo. The persona is ${firstName} (${isHe ? 'he/him' : 'she/her'}); the other speaker is an AI career coach.`,
  '',
  'Output ONLY the translation. No preamble, no notes, no code fence.',
  'Preserve the markdown structure exactly: the same heading levels (#, ##, ###, ####, #####), bold, bullet and numbered lists, blank lines, "---" separators, emoji and bracketed labels, in the same order. Do not add, drop, merge, reorder or summarise anything; translate every sentence.',
  `Career and section titles must use the report's own titles, exactly as listed here (they have to match the report):`,
  ...glossaryLines.map((l) => `  ${l}`),
  `Sub-section headings (##### lines) must use these exact target headings:`,
  ...headingPairs.map((l) => `  ${l}`),
  `Labels and lines: «${ALT_LABEL[from]}» → «${ALT_LABEL[to]}»`,
  ...[...sizeLines].map((l) => `  ${l}`),
  'Reskilling levels: ' + movePairs.join('; '),
  'UI phrases the coach refers to: ' + uiPairs.join('; '),
  to === 'en'
    ? 'Coach voice: warm, direct, second person "you". Keep euro amounts and Dutch institutions (HBO, NOLOC, Praktijkopleider, voedselbank) as they are; add a two-word gloss in parentheses only where the source has none and an English reader would otherwise be lost. British spelling.'
    : 'Coachstem: warm, direct, tweede persoon "je/jij". Houd bedragen in £ en Britse instellingen (CIM, Design Council, UAL, GOV.UK) zoals ze zijn; voeg alleen een korte toelichting tussen haakjes toe waar de bron er geen heeft en een Nederlandse lezer anders afhaakt.',
  to === 'en'
    ? `${firstName}'s own typed turns are casual: lowercase sentence starts, missing final punctuation, the odd typo, run-on sentences. Reproduce that register in English (lowercase where the source is lowercase, no final period where the source has none, a natural small slip where the source has one). Do not tidy it up.`
    : `De getypte beurten van ${firstName} zijn informeel: kleine letters aan het begin, geen punt aan het eind, af en toe een typefout, lange zinnen met komma's. Geef dat register in het Nederlands weer (kleine letters waar de bron ze heeft, geen slotpunt waar de bron er geen heeft, een natuurlijk klein slipje waar de bron er een heeft). Niet opschonen.`,
  to === 'en'
    ? 'Follow-up option lists (a short intro, bullets, and a closing "Iets anders" line) keep exactly the same number of bullets; translate the closing line so it contains "Something else? Just let me know!".'
    : 'Vervolgkeuzelijsten (korte intro, opsommingstekens en een slotregel met "Something else") houden precies hetzelfde aantal opsommingstekens; vertaal de slotregel zo dat er "Iets anders? Laat het gewoon weten!" in staat.',
  'A "[Over …]" / "[About …]" prefix is never part of your output; the caller adds it.',
].join('\n');

async function translate(text: string, role: 'user' | 'bot', context: Message[]): Promise<string> {
  const ctx = context
    .map((m) => `<context role="${m.sender}">\n${m.content}\n</context>`)
    .join('\n');
  const user = `${ctx ? `Previous turns, for context only (do NOT translate these):\n${ctx}\n\n` : ''}Translate this ${role === 'user' ? `typed turn by ${firstName}` : 'coach message'}:\n<message role="${role}">\n${text}\n</message>`;
  for (let attempt = 1; ; attempt++) {
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') throw new Error('refusal');
      const out = final.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      if (!out) throw new Error('empty translation');
      return out.replace(/^<message[^>]*>\n?/, '').replace(/\n?<\/message>$/, '').trim();
    } catch (err) {
      if (attempt >= 3 || !(err instanceof Anthropic.APIError && (err.status === 429 || err.status >= 500))) throw err;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
}

if (dry) {
  console.log('glossary:\n  ' + glossaryLines.join('\n  '));
  console.log('company lines:\n  ' + [...sizeLines].join('\n  '));
  console.log('ui phrases:\n  ' + uiPairs.join('\n  '));
}

// ---------- plan ----------
const messages = fixture.messages;
const bots = messages.filter((m) => m.sender === 'bot');
const methods = sidecar.meta.methods;
const want = (id: string) => (only.size ? only.has(id) : force || !sidecar.messages[id]);
const set = (id: string, text: string, method: string) => {
  sidecar.messages[id] = text;
  methods[id] = method;
};

// 1. Section deliveries that still equal what the product renders → re-render.
const reconstructed = new Set<string>();
for (const type of SECTION_TYPES) {
  const rows = fixture.sections.filter((s) => s.section_type === type);
  if (!rows.length) continue;
  let source = '';
  try {
    source = renderSection(type as never, resolveRows(rows, from) as never, from);
  } catch {
    continue;
  }
  const hit = bots.find((m) => norm(m.content) === norm(source));
  if (!hit) continue;
  reconstructed.add(hit.id);
  // Deterministic and free: always refreshed, so a later fix to the renderer
  // or its label tables (companyContext, boilerplate) reaches the sidecar on
  // the next run without --force.
  if (only.size && !only.has(hit.id)) continue;
  set(hit.id, renderSection(type as never, resolveRows(rows, to) as never, to), 'reconstructed');
}

// 2. Comparison explanations → the stored text in the target language.
for (const s of fixture.sections) {
  const src = from === 'en' ? s.metadata?.comparison?.explanation : sectionI18n(s, from)?.comparison?.explanation;
  const tgt = to === 'en' ? s.metadata?.comparison?.explanation : sectionI18n(s, to)?.comparison?.explanation;
  if (!src || !tgt) continue;
  const hit = bots.find((m) => norm(m.content) === norm(src));
  if (hit && want(hit.id)) set(hit.id, tgt, 'comparison');
}

// 3. Everything else, in transcript order (follow-up answers need the
//    translated bot message before them).
let llmCalls = 0;
const warnings: string[] = [];
for (let i = 0; i < messages.length; i++) {
  const m = messages[i];
  if (!want(m.id) || (sidecar.messages[m.id] && methods[m.id] && !force && !only.has(m.id))) continue;
  if (methods[m.id] === 'reconstructed' || methods[m.id] === 'comparison') continue;
  const n = norm(m.content);

  if (m.sender === 'user') {
    // canned quick-reply turn
    const c = canned.get(n);
    if (c) { set(m.id, c, 'mapped'); continue; }
    // Move-pill question
    const f = FEAS[from];
    const fm = m.content.match(f.parse);
    if (fm) {
      const role = translateTitle(fm[1]) ?? fm[1];
      const lvlLabel = m.content.match(f.level)?.[1] ?? null;
      const level = lvlLabel ? Object.keys(MOVE[from]).find((k) => MOVE[from][k] === lvlLabel) ?? null : null;
      set(m.id, FEAS[to].build(role, level ? MOVE[to][level] : lvlLabel), 'template');
      continue;
    }
    // a follow-up option she clicked → same bullet of the translated bot message
    const prev = messages[i - 1];
    if (prev && prev.sender === 'bot') {
      const opts = optionMessages(prev.content);
      const idx = opts.findIndex((o) => norm(o).toLowerCase() === n.toLowerCase());
      if (idx >= 0) {
        const prevT = sidecar.messages[prev.id];
        const tOpts = prevT ? optionMessages(prevT) : [];
        if (tOpts.length === opts.length && tOpts[idx]) { set(m.id, tOpts[idx], 'option'); continue; }
        warnings.push(`${m.id.slice(0, 8)}: option answer but translated bullets do not line up (${tOpts.length} vs ${opts.length}); used llm`);
      }
    }
    // "[Over X] …"
    const am = m.content.match(ABOUT[from]);
    if (am) {
      const role = translateTitle(am[1]) ?? am[1];
      const rest = m.content.replace(ABOUT[from], '');
      if (dry) { set(m.id, ABOUT_PREFIX[to](role) + '[dry] ' + rest, 'scoped'); continue; }
      llmCalls++;
      set(m.id, ABOUT_PREFIX[to](role) + (await translate(rest, 'user', messages.slice(Math.max(0, i - 2), i))), 'scoped');
      continue;
    }
    if (dry) { set(m.id, '[dry] ' + m.content, 'llm'); continue; }
    llmCalls++;
    set(m.id, await translate(m.content, 'user', messages.slice(Math.max(0, i - 2), i)), 'llm');
    continue;
  }

  // bot
  if (dry) { set(m.id, '[dry] ' + m.content, 'llm'); continue; }
  llmCalls++;
  const out = await translate(m.content, 'bot', messages.slice(Math.max(0, i - 2), i));
  set(m.id, out, 'llm');
  // guards the chat components depend on
  const srcOpts = optionMessages(m.content);
  if (srcOpts.length >= 2 && ESCAPE[from].test(m.content)) {
    const tOpts = optionMessages(out);
    if (tOpts.length !== srcOpts.length) warnings.push(`${m.id.slice(0, 8)}: follow-up bullets ${srcOpts.length} → ${tOpts.length}`);
    if (!ESCAPE[to].test(out)) warnings.push(`${m.id.slice(0, 8)}: follow-up lost its escape-hatch phrase`);
  }
  for (const h of out.matchAll(/^###\s+(.+)$/gm)) {
    const heading = stripHtml(h[1]);
    const known = [...titleMap.values()].some((t) => normTitle(t) === normTitle(heading));
    if (!known && /^### /m.test(m.content)) warnings.push(`${m.id.slice(0, 8)}: heading «${heading}» is not a glossary title`);
  }
  process.stdout.write(`  llm ${m.id.slice(0, 8)} (${out.length} chars)\n`);
}

// 3b. Subheadings of model-translated section deliveries → the report's own
//     (icons match on them). Runs on every existing entry, so a re-run with
//     no new translations still repairs older sidecars.
let realigned = 0;
for (const m of messages) {
  if (m.sender !== 'bot' || methods[m.id] !== 'llm' || !/^### /m.test(m.content)) continue;
  const before = sidecar.messages[m.id];
  if (!before) continue;
  const after = alignSubheadings(m.content, before);
  if (after !== before) {
    sidecar.messages[m.id] = after;
    realigned += 1;
  }
}

// 4. chat_highlights: the wrap-up's own text, natively in the session language.
const highlights = fixture.sections.find((s) => s.section_type === 'chat_highlights');
if (highlights && (force || !sidecar.sections.chat_highlights)) {
  const title = stripHtml(sectionTitle(highlights, from) ?? highlights.title) || 'Highlights';
  const content = sectionText(highlights, from) || highlights.content;
  if (dry) {
    sidecar.sections.chat_highlights = { title: '[dry] ' + title, content: '[dry] ' + content };
  } else {
    llmCalls += 2;
    sidecar.sections.chat_highlights = {
      title: await translate(title, 'bot', []),
      content: await translate(content, 'bot', []),
    };
  }
}

// ---------- write + report ----------
sidecar.meta = { ...sidecar.meta, persona, from, to, model: MODEL, translatedAt: new Date().toISOString(), methods };
if (!dry) writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2) + '\n');
const counts: Record<string, number> = {};
for (const id of Object.keys(sidecar.messages)) counts[methods[id] ?? '?'] = (counts[methods[id] ?? '?'] ?? 0) + 1;
const missing = messages.filter((m) => !sidecar.messages[m.id]).map((m) => m.id.slice(0, 8));
console.log(`\n${persona}: ${from} → ${to}  (${llmCalls} model calls${dry ? ', dry run' : ''})`);
console.log('methods:', JSON.stringify(counts));
console.log('reconstructed sections:', reconstructed.size, '| subheadings realigned:', realigned, '| chat_highlights:', sidecar.sections.chat_highlights ? 'yes' : 'no');
console.log('missing:', missing.length ? missing.join(', ') : 'none');
if (warnings.length) console.log('WARNINGS:\n  ' + warnings.join('\n  '));
console.log(dry ? '(dry run, nothing written)' : `written: ${sidecarPath}`);
