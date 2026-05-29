#!/usr/bin/env tsx
/**
 * translate-survey — translate survey content (sections + questions) into a
 * target language using Claude + the shared glossary.
 *
 * Reads `surveys → survey_sections → questions` from Supabase (public SELECT),
 * translates per section for terminology consistency, and writes a review file
 * `scripts/survey-translations-<lang>.json`. It does NOT touch the database.
 * After human review, the writes are applied via the Supabase MCP (the values
 * are merged into `translations->'<lang>'` on each row).
 *
 * Critical: only display text is translated. Answer VALUES stay English.
 *   - section.title / section.description  → translated (not answer values)
 *   - question.label / config.description  → translated (not answer values)
 *   - config.choices                       → translated as a MAP keyed by the
 *     exact English string ({ "<english>": "<translated>" }). The frontend
 *     renders the translation but submits the English key, so n8n and
 *     profiles.region stay byte-identical. See LOCALIZATION_PLAYBOOK.md.
 *
 * Usage:
 *   npm run translate-survey nl
 *   npm run translate-survey de
 *
 * Requires ANTHROPIC_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY in .env.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ override: true });

const GLOSSARY_PATH = join(process.cwd(), "scripts", "i18n-glossary.json");
const MODEL = "claude-sonnet-4-5";

const targetLang = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!targetLang || targetLang === "en") {
  console.error("Usage: npm run translate-survey <lang>   (e.g. nl, de). English is the source.");
  process.exit(1);
}

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!anthropicKey) { console.error("ANTHROPIC_API_KEY missing from .env."); process.exit(1); }
if (!supabaseUrl || !supabaseAnon) { console.error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing from .env."); process.exit(1); }

// ---------- glossary ----------
const glossary = JSON.parse(readFileSync(GLOSSARY_PATH, "utf8"));
const langRules: string[] = glossary.rules?.[targetLang] ?? [];
const doNotTranslate: string[] = glossary.do_not_translate ?? [];
if (langRules.length === 0) {
  console.error(`No glossary rules for '${targetLang}'. Add a rules.${targetLang} block to scripts/i18n-glossary.json first.`);
  process.exit(1);
}

const LANG_NAMES: Record<string, string> = { nl: "Dutch (Nederlands)", de: "German (Deutsch)", fr: "French (Français)" };
const langName = LANG_NAMES[targetLang] ?? targetLang;

// ---------- types ----------
interface QuestionRow { id: string; label: string; order_num: number | null; config: Record<string, unknown> | null; }
interface SectionRow { id: string; title: string; description: string | null; order_num: number | null; questions: QuestionRow[]; }

interface QuestionTranslation { label?: string; description?: string; choices?: Record<string, string>; }
interface SectionTranslation { title?: string; description?: string; }

const supabase = createClient(supabaseUrl, supabaseAnon);
const client = new Anthropic({ apiKey: anthropicKey });

function buildSystemPrompt(): string {
  return [
    `You are a professional translator from English to ${langName}.`,
    `You are translating a career-assessment survey for Cairnly. The audience is professionals aged 18-55.`,
    ``,
    `RULES:`,
    ...langRules.map((r) => `- ${r}`),
    `- Preserve **bold** markdown markers exactly (e.g. "**Energized** (I thrive on interaction)").`,
    `- Preserve parenthetical hints like "(e.g., ...)" and "(Choose up to 3)" structure.`,
    `- Preserve any placeholders ({{x}}, {n}) verbatim.`,
    `- These are survey questions and answer options. Translate naturally, the way a Dutch survey would phrase it, not word-for-word.`,
    ``,
    `BRAND TERMS — keep in English, never translate: ${doNotTranslate.map((t) => `"${t}"`).join(", ")}.`,
    ``,
    `OUTPUT: return ONLY a JSON object, no markdown fence, matching the requested shape. For each question's "choices", return an object mapping each EXACT original English choice string to its translation.`,
  ].join("\n");
}

async function translateSection(section: SectionRow): Promise<{ section: SectionTranslation; questions: Record<string, QuestionTranslation> }> {
  const payload = {
    section: { title: section.title, description: section.description ?? null },
    questions: section.questions.map((q) => ({
      id: q.id,
      label: q.label,
      description: (q.config?.description as string) ?? null,
      choices: Array.isArray(q.config?.choices) ? (q.config!.choices as string[]) : [],
    })),
  };

  const userMessage =
    `Translate this survey section to ${langName}. Return JSON of shape:\n` +
    `{ "section": { "title": "...", "description": "..."|null },\n` +
    `  "questions": { "<id>": { "label": "...", "description": "..."|null, "choices": { "<englishChoice>": "<translation>" } } } }\n\n` +
    `Only include "choices" for questions that have them. Source:\n\n` +
    JSON.stringify(payload, null, 2);

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userMessage }],
  });

  const text = resp.content[0].type === "text" ? resp.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in response for section ${section.id}: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

async function main() {
  // 1. Read the survey tree (public SELECT).
  const { data: survey, error } = await supabase
    .from("surveys")
    .select(`id, survey_sections ( id, title, description, order_num, questions ( id, label, order_num, config ) )`)
    .limit(1)
    .single();
  if (error || !survey) { console.error("Failed to read survey:", error?.message); process.exit(1); }

  const sections: SectionRow[] = ((survey as { survey_sections?: SectionRow[] }).survey_sections ?? [])
    .slice()
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
    .map((s) => ({ ...s, questions: (s.questions ?? []).slice().sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0)) }));

  console.log(`Survey: ${sections.length} sections, ${sections.reduce((n, s) => n + s.questions.length, 0)} questions. Translating to ${targetLang}...`);

  const out = {
    _meta: { lang: targetLang, generatedBy: "scripts/translate-survey.ts", note: "Review then apply via Supabase MCP. Answer values stay English; choices is a map keyed by the English string." },
    sections: {} as Record<string, SectionTranslation>,
    questions: {} as Record<string, QuestionTranslation>,
  };

  for (const section of sections) {
    process.stdout.write(`  [${section.title.slice(0, 40)}] ${section.questions.length} questions... `);
    try {
      const result = await translateSection(section);
      out.sections[section.id] = result.section;
      for (const [qid, qt] of Object.entries(result.questions ?? {})) out.questions[qid] = qt;
      console.log("ok");
    } catch (e) {
      console.log("FAILED");
      console.error("  ", (e as Error).message);
      process.exitCode = 1;
    }
  }

  const outPath = join(process.cwd(), "scripts", `survey-translations-${targetLang}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${Object.keys(out.questions).length} question + ${Object.keys(out.sections).length} section translations to ${outPath}`);
  console.log("Next: review samples, then apply to the DB via Supabase MCP (merge into translations->'" + targetLang + "').");
}

main();
