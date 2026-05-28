#!/usr/bin/env tsx
/**
 * i18n-sync — propagates English translations to other languages via Claude.
 *
 * Source of truth: public/locales/en/*.json
 * Glossary:       scripts/i18n-glossary.json
 *
 * Usage:
 *   npm run i18n:sync nl                # sync Dutch
 *   npm run i18n:sync de --dry-run      # report what would change, no API calls
 *   npm run i18n:sync nl --namespace=chat  # limit to one namespace
 *
 * Behavior:
 *   - Reads each en/<ns>.json, finds missing keys in target locale.
 *   - Sends only missing strings to Claude (one batch per namespace) with the glossary loaded.
 *   - Merges translated keys back into target locale file, preserving existing translations.
 *   - Never deletes existing target keys (safe — if EN key is removed, target keeps old value until manually pruned).
 *
 * Requires ANTHROPIC_API_KEY in .env.
 *
 * See LOCALIZATION_PLAN.md Phase 0.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { config as loadEnv } from "dotenv";

// override: true so .env wins over empty shell-exported vars
// (common gotcha: ANTHROPIC_API_KEY exported empty in zsh shadows the .env value).
loadEnv({ override: true });

const LOCALES_DIR = join(process.cwd(), "public", "locales");
const GLOSSARY_PATH = join(process.cwd(), "scripts", "i18n-glossary.json");
const MODEL = "claude-sonnet-4-5";

// ---------- args ----------
const args = process.argv.slice(2);
const targetLang = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const namespaceFilter = args.find((a) => a.startsWith("--namespace="))?.split("=")[1];

if (!targetLang) {
  console.error("Usage: npm run i18n:sync <lang> [--dry-run] [--namespace=<ns>]");
  process.exit(1);
}
if (targetLang === "en") {
  console.error("English is the source — nothing to sync.");
  process.exit(1);
}

// ---------- helpers ----------
type Nested = { [k: string]: string | Nested };

const flatten = (obj: Nested, prefix = ""): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
};

const unflatten = (flat: Record<string, string>): Nested => {
  const out: Nested = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur: Nested = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur)) cur[parts[i]] = {};
      cur = cur[parts[i]] as Nested;
    }
    cur[parts[parts.length - 1]] = val;
  }
  return out;
};

const loadJSON = (path: string): Nested => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});

// ---------- glossary ----------
const glossary = JSON.parse(readFileSync(GLOSSARY_PATH, "utf8"));
const langRules: string[] = glossary.rules?.[targetLang] ?? [];
const langPreferred: Record<string, string> = glossary.preferred?.[`en->${targetLang}`] ?? {};
const doNotTranslate: string[] = glossary.do_not_translate ?? [];

if (langRules.length === 0) {
  console.error(`No rules defined for language '${targetLang}' in glossary. Add a rules.${targetLang} block to scripts/i18n-glossary.json first.`);
  process.exit(1);
}

// ---------- discover namespaces ----------
const enDir = join(LOCALES_DIR, "en");
if (!existsSync(enDir)) {
  console.error(`Missing source dir: ${enDir}`);
  process.exit(1);
}
const namespaces = readdirSync(enDir)
  .filter((f) => f.endsWith(".json"))
  .filter((f) => !namespaceFilter || basename(f, ".json") === namespaceFilter)
  .map((f) => basename(f, ".json"));

if (namespaces.length === 0) {
  console.error("No namespaces found (or namespace filter matched none).");
  process.exit(1);
}

// ---------- diff + translate ----------
const client = dryRun ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY missing from .env. Aborting (use --dry-run to preview without translating).");
  process.exit(1);
}

const targetDir = join(LOCALES_DIR, targetLang);
let totalMissing = 0;
let totalTranslated = 0;

for (const ns of namespaces) {
  const enFlat = flatten(loadJSON(join(enDir, `${ns}.json`)));
  const targetFlat = flatten(loadJSON(join(targetDir, `${ns}.json`)));
  const missing = Object.fromEntries(Object.entries(enFlat).filter(([k]) => !(k in targetFlat)));
  const missingCount = Object.keys(missing).length;
  totalMissing += missingCount;

  if (missingCount === 0) {
    console.log(`[${ns}] in sync (${Object.keys(enFlat).length} keys)`);
    continue;
  }

  console.log(`[${ns}] ${missingCount} missing key${missingCount === 1 ? "" : "s"} in ${targetLang}`);

  if (dryRun) {
    for (const k of Object.keys(missing).slice(0, 5)) console.log(`  - ${k}: "${missing[k].slice(0, 60)}${missing[k].length > 60 ? "…" : ""}"`);
    if (missingCount > 5) console.log(`  …and ${missingCount - 5} more`);
    continue;
  }

  const systemPrompt = [
    `You are a professional translator from English to ${targetLang.toUpperCase()}.`,
    `You are translating UI strings for Cairnly, a career guidance product.`,
    ``,
    `RULES:`,
    ...langRules.map((r) => `- ${r}`),
    ``,
    `BRAND TERMS — do NOT translate, keep as-is:`,
    doNotTranslate.map((t) => `"${t}"`).join(", "),
    ``,
    Object.keys(langPreferred).length > 0
      ? `PREFERRED TRANSLATIONS for common terms:\n${Object.entries(langPreferred).map(([en, x]) => `- "${en}" -> "${x}"`).join("\n")}`
      : ``,
    ``,
    `OUTPUT: return a JSON object mapping each input key to its translation. No commentary, no markdown fences, just JSON.`,
  ].filter(Boolean).join("\n");

  const userMessage = `Translate the following strings to ${targetLang.toUpperCase()}. Preserve placeholders like {{name}} or {count} exactly. Return JSON.\n\n${JSON.stringify(missing, null, 2)}`;

  try {
    const response = await client!.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
    const translated: Record<string, string> = JSON.parse(jsonMatch[0]);

    const merged = { ...targetFlat, ...translated };
    const outPath = join(targetDir, `${ns}.json`);
    writeFileSync(outPath, JSON.stringify(unflatten(merged), null, 2) + "\n", "utf8");

    totalTranslated += Object.keys(translated).length;
    console.log(`  ✓ wrote ${Object.keys(translated).length} translations to ${outPath}`);
  } catch (err) {
    console.error(`  ✗ failed [${ns}]:`, (err as Error).message);
    process.exitCode = 1;
  }
}

console.log("");
console.log(`Total: ${totalMissing} missing, ${dryRun ? 0 : totalTranslated} translated.`);
if (dryRun) console.log("(dry-run: no files written, no API calls made)");
