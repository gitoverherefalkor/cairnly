// Deterministic validation gate for report-section translations.
//
// The translator model is asked to preserve structure exactly; this module is
// what ENFORCES it. A translation that fails any check is never written to the
// database — the caller retries once with the failure list, then falls back to
// English (the canonical content is always a readable fallback).
//
// Pure and dependency-free on purpose: it runs inside Deno edge functions AND
// under vitest (src/lib/translationGate.test.ts), so the same assertions that
// guard production are unit-tested in CI.

export interface GateResult {
  ok: boolean;
  failures: string[];
}

/** Sequence of opening/closing tag names, e.g. "<h5,</h5,<strong". */
export function tagSequence(s: string): string {
  return (s.match(/<\/?[a-zA-Z][a-zA-Z0-9-]*/g) ?? []).map((t) => t.toLowerCase()).join(',');
}

/** All <!-- … --> tokens, sorted (multiset compare — tokens may repeat). */
export function commentTokens(s: string): string[] {
  return (s.match(/<!--[\s\S]*?-->/g) ?? []).slice().sort();
}

/**
 * Digit runs with thousand/decimal separators stripped, sorted.
 * "€75,000 to €170,000" and "€75.000 tot €170.000" both yield
 * ["75000","170000"] — separator localisation is allowed (the glossary
 * mandates it), losing or changing a number is not.
 */
export function digitRuns(s: string): string[] {
  return (s.match(/\d[\d.,]*/g) ?? [])
    .map((r) => r.replace(/[.,]/g, ''))
    .slice()
    .sort();
}

/** Count of non-overlapping occurrences of `needle` in `s`. */
export function countOccurrences(s: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = s.indexOf(needle);
  while (i !== -1) {
    n++;
    i = s.indexOf(needle, i + needle.length);
  }
  return n;
}

/**
 * Markdown/structure markers that must survive translation 1:1. Tag sequence
 * covers the HTML skeleton; these cover the markdown-ish conventions the
 * report bodies actually use (see real samples: "## " headings inside HTML,
 * "✓ **…**" / "⚠ **…**" reality-check bullets, "- " lists, ** bold spans).
 */
export function structureMarkers(s: string): Record<string, number> {
  const lines = s.split('\n');
  const startsWith = (prefix: string) =>
    lines.filter((l) => l.trimStart().startsWith(prefix)).length;
  return {
    mdHeading: startsWith('## ') + startsWith('### ') + startsWith('#### ') + startsWith('##### '),
    bullet: startsWith('- '),
    check: countOccurrences(s, '✓'),
    warn: countOccurrences(s, '⚠'),
    boldMarkers: (s.match(/\*\*/g) ?? []).length,
    careerSplit: countOccurrences(s, '---CAREER_SPLIT---'),
    codeFence: (s.match(/```/g) ?? []).length,
  };
}

// Function-word stopword lists for language sniffing. Deliberately excludes
// words that are common in BOTH languages ("of", "is", "in", "was", "water").
// English loanwords in Dutch marketing copy (assessment, feedback) never
// appear here — only grammar words that unambiguously mark the language.
const STOPWORDS: Record<string, readonly string[]> = {
  en: [
    'the', 'and', 'your', 'you', 'that', 'with', 'for', 'this', 'are', 'on',
    'as', 'at', 'be', 'have', 'from', 'it', 'not', 'but', 'by', 'an', 'will',
    'can', 'what', 'how', 'to', 'into', 'than', 'more', 'most', 'where',
  ],
  nl: [
    'de', 'het', 'een', 'en', 'van', 'je', 'jij', 'jouw', 'dat', 'met',
    'voor', 'dit', 'zijn', 'op', 'als', 'aan', 'bij', 'niet', 'maar', 'door',
    'naar', 'ook', 'wat', 'hoe', 'om', 'te', 'er', 'dan', 'zo', 'deze',
    'die', 'wordt', 'kunt', 'kun', 'geen', 'meer', 'nog', 'al', 'uit', 'over',
  ],
  de: [
    'der', 'die', 'das', 'und', 'ein', 'eine', 'mit', 'für', 'auf', 'ist',
    'nicht', 'sie', 'ihre', 'ihr', 'werden', 'wird', 'auch', 'als', 'aus',
    'bei', 'nach', 'über', 'durch', 'wie', 'oder', 'aber', 'wenn', 'dann',
  ],
};

/**
 * Best-effort language sniff on prose (tags stripped first).
 * Returns 'unknown' when there isn't enough signal — callers must treat
 * 'unknown' as a pass, not a failure (short or list-heavy sections).
 */
export function sniffLanguage(s: string, minWords = 25): string {
  const text = s
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .toLowerCase();
  const words = text.match(/[a-zà-ÿ']+/g) ?? [];
  if (words.length < minWords) return 'unknown';
  const scores: Record<string, number> = {};
  for (const [lang, stops] of Object.entries(STOPWORDS)) {
    const set = new Set(stops);
    scores[lang] = words.filter((w) => set.has(w)).length;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestLang, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  // Require clear dominance: at least 5 hits and double the runner-up.
  if (bestScore >= 5 && bestScore >= secondScore * 2) return bestLang;
  return 'unknown';
}

/**
 * The full gate. `canonical` is the stored English content, `translated` the
 * model output, `target` the language it should be in.
 */
export function runGate(canonical: string, translated: string, target: string): GateResult {
  const failures: string[] = [];

  if (!translated || translated.trim().length === 0) {
    return { ok: false, failures: ['translation is empty'] };
  }

  const tagsA = tagSequence(canonical);
  const tagsB = tagSequence(translated);
  if (tagsA !== tagsB) {
    failures.push(
      `HTML tag skeleton differs (canonical: ${tagsA.split(',').filter(Boolean).length} tags, translation: ${tagsB.split(',').filter(Boolean).length} tags). Reproduce every HTML tag exactly: same tags, same nesting, same count, same order.`,
    );
  }

  const tokA = commentTokens(canonical).join('|');
  const tokB = commentTokens(translated).join('|');
  if (tokA !== tokB) {
    failures.push('HTML comment tokens (<!-- … -->) were changed, translated, added or removed. Reproduce them verbatim.');
  }

  const digitsA = digitRuns(canonical).join('|');
  const digitsB = digitRuns(translated).join('|');
  if (digitsA !== digitsB) {
    failures.push(
      'Numbers differ between canonical and translation. Every number, score, salary figure and year must survive unchanged (thousand/decimal separators may be localised, digits may not change).',
    );
  }

  const markersA = structureMarkers(canonical);
  const markersB = structureMarkers(translated);
  for (const key of Object.keys(markersA)) {
    if (markersA[key] !== markersB[key]) {
      failures.push(
        `Structure marker "${key}" count changed (${markersA[key]} -> ${markersB[key]}). Keep markdown headings, bullets, ✓/⚠ markers, bold spans, fences and split tokens 1:1.`,
      );
    }
  }

  const sniffOut = sniffLanguage(translated);
  if (sniffOut !== 'unknown' && sniffOut !== target) {
    failures.push(`Translation reads as "${sniffOut}", expected "${target}". The entire prose must be in the target language.`);
  }

  // Whole-document dominance misses PARTIAL translations (half the paragraphs
  // translated, half left English — structure identical, no dominant language).
  // So also sniff per paragraph: any full paragraph still reading as a
  // different language fails. Short quoted fragments (a user's own English
  // survey answer inside Dutch prose) stay below the word threshold and pass.
  if (target !== 'en') {
    const paragraphs = translated.split(/\n\s*\n/);
    const wrongParas = paragraphs
      .map((p, i) => ({ i, lang: sniffLanguage(p, 12) }))
      .filter((p) => p.lang !== 'unknown' && p.lang !== target);
    if (wrongParas.length > 0) {
      failures.push(
        `${wrongParas.length} paragraph(s) are not in the target language (e.g. paragraph ${wrongParas[0].i + 1} reads as "${wrongParas[0].lang}"). Translate every paragraph.`,
      );
    }
  }

  return { ok: failures.length === 0, failures };
}

/**
 * Input-side check: is the canonical content actually English?
 * This is the permanent regression alarm for the generators — if any future
 * prompt change makes a workflow emit non-English canonical content again,
 * this is what catches it (and the caller alerts instead of translating
 * garbage). 'unknown' passes: short/format-heavy sections have no signal.
 */
export function canonicalLooksEnglish(canonical: string): boolean {
  const sniffed = sniffLanguage(canonical);
  return sniffed === 'unknown' || sniffed === 'en';
}
