/**
 * Whether a survey question is satisfied: either it is not required, or it has
 * a valid answer for its type.
 *
 * Shared by the Continue gate (SurveyForm), the resume cursor and
 * section-complete calc (useSurveyState), and the pre-submit completeness
 * check — so every part of the survey agrees on what "answered" means.
 *
 * The per-type rules matter because answers come in different shapes: a
 * cleared multi-select is an empty array, ranking/career-history answers are
 * objects/arrays. A naive `!== '' && !== null` check wrongly treats those
 * empty-but-present values as answered.
 */

// An "Other" answer stores its free-text as `Other: <text>`. It counts as
// answered only once at least this many characters are typed; a bare `other`
// (option picked, nothing typed) never counts.
const OTHER_MIN_CHARS = 4;

// Career-happiness "Why this score?" minimum length. Without enough context
// behind a score, downstream personalization either pads with vague claims
// or invents reasoning — so we require a short justification per role.
export const CAREER_HAPPINESS_MIN_REASON_CHARS = 15;

function isOtherValueComplete(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  if (value === 'other') return false;
  if (value.startsWith('Other: ')) {
    return value.slice('Other: '.length).trim().length >= OTHER_MIN_CHARS;
  }
  return true; // a regular choice, not an "Other" value
}

export function isQuestionAnswered(question: any, response: any): boolean {
  if (!question || !question.required) return true;

  if (question.type === 'multiple_choice' && question.allow_multiple) {
    const minSelections = question.min_selections;
    const maxSelections = question.max_selections;

    if (Array.isArray(response)) {
      // A picked-but-unfilled "Other" entry blocks completion.
      if (response.some((v) => !isOtherValueComplete(v))) return false;
      if (minSelections && response.length < minSelections) return false;
      if (!minSelections && response.length === 0) return false;
      if (maxSelections && response.length > maxSelections) return false;
      return true;
    }

    if (minSelections && minSelections > 0) return false;
    if (!isOtherValueComplete(response)) return false;
    return response !== undefined && response !== null && response !== '';
  }

  if (question.type === 'ranking') {
    const choices = question.config?.choices || [];
    if (!response || typeof response !== 'object') return false;
    const rankedItems = Object.keys(response).filter(
      (key) => response[key] !== null && response[key] !== undefined
    );
    return rankedItems.length === choices.length;
  }

  if (question.type === 'skills_achievements') {
    // Only the Languages sub-section is required: at least one preset with a
    // proficiency, or a fully filled "other" language.
    const langs = response?.languages;
    if (!langs || typeof langs !== 'object') return false;
    const presets = langs.presets && typeof langs.presets === 'object' ? langs.presets : {};
    const other = langs.other && typeof langs.other === 'object' ? langs.other : null;

    let validCount = 0;
    for (const lang of Object.keys(presets)) {
      if (!presets[lang]) return false; // checked but no proficiency picked
      validCount++;
    }
    if (other) {
      const hasLang = !!other.language;
      const hasProf = !!other.proficiency;
      if (hasLang !== hasProf) return false; // partially filled
      if (hasLang && hasProf) validCount++;
    }
    return validCount >= 1;
  }

  if (question.type === 'career_happiness') {
    // Every active role needs a happiness rating AND a justification of at
    // least CAREER_HAPPINESS_MIN_REASON_CHARS characters — see the constant's
    // comment for the reasoning.
    if (!Array.isArray(response) || response.length === 0) return false;
    for (const entry of response) {
      if (typeof entry?.happiness !== 'number' || entry.happiness < 1) return false;
      const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
      if (reason.length < CAREER_HAPPINESS_MIN_REASON_CHARS) return false;
    }
    return true;
  }

  if (question.type === 'career_history') {
    // Validate the first 5 (active) entries: any entry with a title must have
    // companySize, companyCulture and startYear. At least one active entry
    // must have a title.
    if (!Array.isArray(response)) return false;
    const activeEntries = response.slice(0, 5);
    for (const entry of activeEntries) {
      if (entry.title && entry.title.trim()) {
        // Sector is required too — it shows a red border when empty, so it must
        // also block the Continue button (otherwise the red field is misleading).
        if (!entry.companySize || !entry.companyCulture || !entry.startYear || !entry.sector?.trim()) {
          return false;
        }
      }
    }
    return activeEntries.some((entry: any) => entry.title && entry.title.trim());
  }

  // Single-select "Other": needs enough text typed; a bare `other` fails.
  if (!isOtherValueComplete(response)) return false;
  return response !== undefined && response !== null && response !== '';
}
