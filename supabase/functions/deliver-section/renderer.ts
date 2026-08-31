// Pure renderer for Atlas section deliveries.
// Takes one-or-more rows from the `report_sections` table and produces
// the markdown message body shown in the chat — identical to what the
// WF5.2 Atlas Agent currently emits for the same row.
//
// Three section families share the structure:
//   personality       → 1 row, plain-text title, content body
//   career-single     → 1 row, HTML title + size + alt titles + content
//   career-multi      → N rows, same shape, joined with blank lines
//
// dream_jobs is "career-multi-lite" (no size/alt-titles, no <strong> on title).

import { getBoilerplate, type SectionType } from './boilerplate.ts';

export interface ReportSectionRow {
  section_type: string;
  order_number: number | null;
  title: string | null;
  alternate_titles: string | null;
  company_size_type: string | null;
  content: string | null;
  score: number | null;
  /**
   * Language of the CANONICAL content — always 'en' for generated prose under
   * the language contract. Optional so existing callers that don't select the
   * column keep type-checking.
   */
  language?: string | null;
  /**
   * Stored translations, keyed by language code (language contract). The
   * caller resolves rows through sectionText/sectionTitle before rendering.
   */
  content_i18n?: Record<string, unknown> | null;
}

const PERSONALITY: ReadonlySet<SectionType> = new Set([
  'approach',
  'strengths',
  'development',
  'values',
]);

const CAREER_SINGLE: ReadonlySet<SectionType> = new Set([
  'top_career_1',
  'top_career_2',
  'top_career_3',
]);

const CAREER_MULTI: ReadonlySet<SectionType> = new Set([
  'runner_ups',
  'outside_box',
  'dream_jobs',
]);

/**
 * Convert the limited HTML subset used by WF4 parsers into markdown,
 * and apply the same content normalizations the agent applies today.
 *
 * Tags actually present in `report_sections.content` and metadata fields:
 *   <h3>, <h4>, <h5>, <strong>
 * Plus the WF4 outside_box bug where titles end up as
 *   <h3><strong>**Title**</strong></h3>
 * which we collapse to plain text "Title" inside header lines.
 *
 * Normalizations:
 *   - Strip leaked question-IDs like [3a], [1k], [7b] that occasionally
 *     leak past the WF4 prompt rules.
 *   - Strip the trailing "More details… your dashboard…" sentence that
 *     WF4 prompts append. The agent removes it; we do the same.
 */
function htmlToMarkdown(input: string | null | undefined): string {
  if (!input) return '';
  let s = input;

  // Headers — newline before/after to ensure standalone block
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, inner) => `### ${stripInlineTags(inner)}`);
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_m, inner) => `#### ${stripInlineTags(inner)}`);
  s = s.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_m, inner) => `##### ${stripInlineTags(inner)}`);

  // Strong → markdown bold
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');

  // Drop any remaining tags we didn't expect (defensive — keeps content clean
  // if WF4 ever introduces something new)
  s = s.replace(/<\/?[a-z][^>]*>/gi, '');

  // Strip leaked question-IDs (e.g. " [3a]", "[1n]", "[7b]"). Match a single
  // letter suffix; avoids eating things like "[80-120 words]" in prompts.
  s = s.replace(/\s*\[\d+[a-z]\]/g, '');

  // Strip the trailing "More details..." line that WF4 emits as a footer.
  // Variants seen:
  //   "More details about this role can be viewed in your dashboard after this chat."
  //   "**More details in your dashboard.**"
  s = s.replace(/\s*\*?\*?(?:More details|Meer details)[^\n]*$/i, '');

  return s.trim();
}

/**
 * Inline-tag stripper used inside header content. Headers should never
 * contain markdown bold around their entire text (that produces "### **Title**"
 * which renders as a header containing the bold tokens). Collapse them.
 */
function stripInlineTags(s: string): string {
  // First strip <strong>
  let out = s.replace(/<strong>([\s\S]*?)<\/strong>/gi, '$1');
  // Then collapse markdown bold that wraps the whole header (the WF4 bug)
  out = out.trim();
  if (out.startsWith('**') && out.endsWith('**')) {
    const inner = out.slice(2, -2);
    if (!inner.includes('**')) out = inner;
  }
  return out.trim();
}

/**
 * Render a personality section (approach / strengths / development / values).
 * Title is plain text in the DB; we add the markdown header.
 */
function renderPersonality(row: ReportSectionRow): string {
  const title = (row.title ?? '').trim();
  const content = htmlToMarkdown(row.content);
  return `### ${title}\n\n${content}`.trim();
}


/** The metadata columns come in two shapes. Legacy rows (WF4/WF3 up to
 *  2026-08-31) carry presentation baked into the data:
 *    alternate_titles:  `<strong>Alternate titles:</strong> CX Trainer, …`
 *    company_size_type: `<h4><strong>Medium (51-200) / Agency</strong></h4>`
 *  Newer rows carry the bare values. The renderer owns the heading level and
 *  the caption for BOTH shapes: any stored markup/caption is stripped first,
 *  then re-emitted here — so legacy rows render byte-identically to before,
 *  and the caption is translatable without touching the data.
 *
 *  The job titles themselves stay English on purpose. "CX Trainer" and
 *  "Customer Operations Coach" are the titles Dutch vacancies actually use;
 *  translating them would make them unrecognisable and unsearchable. */
const ALT_TITLES_LABEL: Record<string, string> = {
  en: 'Alternate titles:',
  nl: 'Alternatieve functietitels:',
};

function altTitlesLabel(language: string): string {
  const key = String(language ?? 'en').slice(0, 2).toLowerCase();
  return ALT_TITLES_LABEL[key] ?? ALT_TITLES_LABEL.en;
}

/** Company size/type line: `#### Medium (51-200) / Agency` from either shape. */
function renderSizeLine(raw: string | null): string {
  const text = htmlToMarkdown(raw)
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .trim();
  return text ? `#### ${text}` : '';
}

/** Alternate-titles line: `**<label>** A, B` from either shape. */
function renderAltTitlesLine(raw: string | null, language: string): string {
  const text = htmlToMarkdown(raw)
    .replace(/\*\*/g, '')
    .replace(/^(Alternate titles|Alternatieve functietitels)\s*:\s*/i, '')
    .trim();
  return text ? `**${altTitlesLabel(language)}** ${text}` : '';
}

/**
 * Render a single career card body — used for top_career_1/2/3 directly,
 * and as the per-row helper for runner_ups / outside_box.
 *
 * Output:
 *   ### Career Title
 *   #### Company size / type
 *   **Alternate titles:** Foo, Bar
 *
 *   {content}
 *
 * Skips any of the metadata lines that are NULL.
 */
function renderCareerCard(row: ReportSectionRow, language: string = 'en'): string {
  const parts: string[] = [];
  const title = htmlToMarkdown(row.title);
  if (title) parts.push(title);
  const size = renderSizeLine(row.company_size_type);
  if (size) parts.push(size);
  const alts = renderAltTitlesLine(row.alternate_titles, language);
  if (alts) parts.push(alts);

  const header = parts.join('\n\n');
  const body = htmlToMarkdown(row.content);
  return [header, body].filter(Boolean).join('\n\n');
}

/**
 * Render a dream-job card. Same shape as a career card except no metadata
 * fields, and the title comes pre-wrapped as <h3>Title</h3> (no <strong>).
 */
function renderDreamCard(row: ReportSectionRow): string {
  const title = htmlToMarkdown(row.title);
  const body = htmlToMarkdown(row.content);
  return [title, body].filter(Boolean).join('\n\n');
}

/**
 * Assemble intro + content block + outro into the final chat message.
 * Wraps the content block in `---` horizontal rules to match the SOP.
 */
function wrap(intro: string | null, body: string, outro: string | null): string {
  const parts: string[] = [];
  if (intro) parts.push(intro);
  parts.push('---');
  parts.push(body);
  parts.push('---');
  if (outro) parts.push(outro);
  return parts.join('\n\n').trim();
}

/**
 * Public entry point. Given a section_type and the raw rows from the
 * `report_sections` table for that section, return the rendered markdown.
 *
 * Rows must already be filtered to the requested section_type. For
 * multi-row sections (runner_ups, outside_box, dream_jobs) they should
 * be ordered by `order_number` ascending — this function does its own
 * order_number sort defensively.
 */
export function renderSection(
  sectionType: SectionType,
  rows: ReportSectionRow[],
  language: string = 'en',
): string {
  if (rows.length === 0) {
    throw new Error(`No rows provided for section_type=${sectionType}`);
  }

  const boilerplate = getBoilerplate(language)[sectionType];

  if (PERSONALITY.has(sectionType)) {
    return wrap(boilerplate.intro, renderPersonality(rows[0]), boilerplate.outro);
  }

  if (CAREER_SINGLE.has(sectionType)) {
    return wrap(boilerplate.intro, renderCareerCard(rows[0], language), boilerplate.outro);
  }

  if (CAREER_MULTI.has(sectionType)) {
    const sorted = [...rows].sort(
      (a, b) => (a.order_number ?? 0) - (b.order_number ?? 0),
    );

    const isDream = sectionType === 'dream_jobs';
    const cards = sorted
      .map((r) => (isDream ? renderDreamCard(r) : renderCareerCard(r, language)))
      .join('\n\n---\n\n');

    return wrap(boilerplate.intro, cards, boilerplate.outro);
  }

  throw new Error(`Unknown section_type: ${sectionType}`);
}

/**
 * Build the langchain-compatible JSONB payload for n8n_chat_histories.
 * The agent's Postgres memory reads back this shape via the langchain JS
 * lib, so any deviation will throw on the agent's next turn.
 */
export function buildAiChatMessage(content: string) {
  return {
    type: 'ai',
    content,
    tool_calls: [],
    additional_kwargs: {},
    response_metadata: {},
    invalid_tool_calls: [],
  };
}

export function buildHumanChatMessage(content: string) {
  return {
    type: 'human',
    content,
    additional_kwargs: {},
    response_metadata: {},
  };
}
