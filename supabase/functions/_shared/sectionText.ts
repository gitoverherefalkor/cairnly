// The single accessor pair of the language contract (docs/LANGUAGE_CONTRACT_PLAN.md).
//
// report_sections.content / .title are ALWAYS canonical English. Translations
// live in report_sections.content_i18n[lang], written only by the
// translate-section edge function after passing a deterministic gate.
//
// Rules for every consumer:
//   - Rendering prose/titles to the user → sectionText / sectionTitle (falls
//     back to English when no translation exists — never blank, never mixed
//     with a stale translation, because the DB trigger wipes content_i18n on
//     any content change).
//   - Parsing/regexing (AI-impact level, overview extraction, job matching,
//     title matching) → ALWAYS the canonical `content` / `title` columns.
//     Canonical English is what makes those regexes reliable forever.

export interface SectionTranslation {
  title?: string | null;
  content?: string;
  comparison?: { headline?: string; explanation?: string } | null;
  translated_at?: string;
  model?: string;
}

// Structural shape we need — kept loose so ReportSection (hand-written),
// generated Supabase rows, and edge-function rows all satisfy it.
export interface TranslatableSection {
  content?: string | null;
  title?: string | null;
  content_i18n?: unknown;
}

/** The stored translation entry for a language, or null. */
export function sectionI18n(section: TranslatableSection, lang: string): SectionTranslation | null {
  const i18n = section.content_i18n;
  if (!i18n || typeof i18n !== 'object' || Array.isArray(i18n)) return null;
  const short = String(lang ?? '').slice(0, 2).toLowerCase();
  const entry = (i18n as Record<string, unknown>)[short];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return entry as SectionTranslation;
}

/** Body prose in the user's language, falling back to canonical English. */
export function sectionText(section: TranslatableSection, lang: string): string {
  const t = sectionI18n(section, lang)?.content;
  return typeof t === 'string' && t.length > 0 ? t : section.content ?? '';
}

/** Title in the user's language, falling back to canonical English. */
export function sectionTitle(section: TranslatableSection, lang: string): string | null {
  const entry = sectionI18n(section, lang);
  // A translation entry may legitimately carry title: null (canonical had none).
  if (entry && typeof entry.title === 'string' && entry.title.length > 0) return entry.title;
  return section.title ?? null;
}

/** True when this section has a stored translation for the language. */
export function hasTranslation(section: TranslatableSection, lang: string): boolean {
  return sectionI18n(section, lang) !== null;
}

/**
 * All titles this section is known by (canonical + every stored translation).
 * Chat messages carry the title `deliver-section` rendered at delivery time,
 * which can be either language — matching must accept both.
 */
export function sectionTitleCandidates(section: TranslatableSection): string[] {
  const out: string[] = [];
  if (section.title) out.push(section.title);
  const i18n = section.content_i18n;
  if (i18n && typeof i18n === 'object' && !Array.isArray(i18n)) {
    for (const entry of Object.values(i18n as Record<string, unknown>)) {
      const t = (entry as SectionTranslation | null)?.title;
      if (typeof t === 'string' && t.length > 0) out.push(t);
    }
  }
  return out;
}
