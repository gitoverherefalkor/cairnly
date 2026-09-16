// Which careers a "Not for me" dismissal removes from a rendering of the
// report, and which it only marks. Pure functions over ReportSection[] — no
// React, no Supabase, no PDF.
//
// Lives in lib/ rather than components/report-pdf/ because BOTH renderings
// need it: the printed document and the dashboard's career map have to agree
// about which careers exist, or a runner-up you set aside vanishes from the
// PDF while staying a bubble on the dashboard map. It started in report-pdf/
// when the PDF was the only caller; the dashboard could not import it from
// there without pointing components/dashboard/ at components/report-pdf/,
// and every dependency between those two runs the other way today
// (ReportPrintDocument imports reportChartData, dashboardV2Shared and the
// V4*SVG components from the dashboard). lib/ is where the codebase already
// keeps helpers shared across both, e.g. sectionText.

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
