// Which career scores a user may SEE. Only the Top 3 show their match number.
// Runner-ups, outside-the-box picks and dream jobs keep their score in the data
// (sorting, chart placement) but never display it: a runner-up at 61/100 next
// to a Top 3 at 90 reads as "only three jobs suit you" (Sjoerd, 2026-10-15).
// Every surface that renders a score number goes through visibleCareerScore.

export const TOP_CAREER_TYPES = ['top_career_1', 'top_career_2', 'top_career_3'] as const;

export function isTopCareerType(sectionType: string | null | undefined): boolean {
  return !!sectionType && (TOP_CAREER_TYPES as readonly string[]).includes(sectionType);
}

/** The score to display, or null when it must stay hidden (non-Top-3 or missing). */
export function visibleCareerScore(
  section: { section_type?: string | null; score?: number | string | null } | null | undefined,
): number | null {
  if (!section || !isTopCareerType(section.section_type) || section.score == null) return null;
  const n = Number(section.score);
  return Number.isFinite(n) ? n : null;
}
