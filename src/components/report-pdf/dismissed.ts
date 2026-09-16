import type { ReportSection } from '@/hooks/useReportSections';

// What report-print-data sends alongside the sections: one entry per career
// the user set aside via the dashboard "Not for me" control.
export interface DismissedRef {
  section_id: string;
  section_type: string;
}

// Career groups that repeat (one report_sections row per career). A dismissed
// one is simply absent from the printed report — nothing in the prose refers
// to "runner-up number 3", so removing it leaves no hole.
const DROPPABLE = new Set(['runner_ups', 'outside_box', 'dream_jobs']);

// The top 3 are referred to by number throughout the narrative ("your second
// match"), so a dismissed one stays in the document and is marked instead.
const MARKABLE = new Set(['top_career_1', 'top_career_2', 'top_career_3']);

/**
 * Removes dismissed careers from the printable section list. Only the
 * repeating career groups are dropped; everything else passes through,
 * including a dismissed top-3 career (see isSetAside).
 */
export function filterDismissed(
  sections: ReportSection[],
  dismissed: DismissedRef[],
): ReportSection[] {
  if (dismissed.length === 0) return sections;
  const droppedIds = new Set(
    dismissed.filter((d) => DROPPABLE.has(d.section_type)).map((d) => d.section_id),
  );
  if (droppedIds.size === 0) return sections;
  return sections.filter((s) => !droppedIds.has(s.id));
}

/** True when this section is a top-3 career the user set aside. */
export function isSetAside(section: ReportSection, dismissed: DismissedRef[]): boolean {
  if (!MARKABLE.has(section.section_type)) return false;
  return dismissed.some((d) => d.section_id === section.id);
}
