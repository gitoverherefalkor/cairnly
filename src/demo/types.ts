// Shapes of the frozen demo fixtures under src/demo/fixtures/, written by
// scripts/demo-export-fixture.mjs. See docs/handoff/demo-replay-plan.md.
import type { ReportSection } from '@/hooks/useReportSections';

export interface DemoMessage {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  created_at: string;
  // chat_messages.metadata. `quick_reply` names the focus-type pill
  // ('differently' / 'somethingElse') a typed turn came from; ChatMessage
  // renders it as the small "via …" tag above the bubble.
  metadata?: { quick_reply?: string } | null;
}

export interface DemoPersona {
  firstName: string;
  // profiles.country, shown in the dashboard's welcome block.
  country?: string | null;
  // Language of the CONVERSATION. Only selects which fixture is shown; the
  // chrome around it follows the visitor's i18n language as everywhere else.
  language: string;
  exportedAt: string;
  reportId: string;
  reportStatus?: string;
  // reports.updated_at at export time: the date the dashboard prints.
  reportCompletedAt?: string;
}

// A saved_chat_responses row, as the dashboard's "Saved answers from the
// chat" panel reads it (same shape as hooks/useSavedChatResponses).
export interface DemoSavedResponse {
  id: string;
  report_id: string;
  section_type: string | null;
  label: string | null;
  content: string;
  created_at: string;
}

export interface DemoFixture {
  persona: DemoPersona;
  messages: DemoMessage[];
  // Every report_sections row the chat components read (score pills, Move
  // pill, comparison radar, translated titles). init_summary is excluded.
  sections: ReportSection[];
  // Bot messages the persona pressed Keep on — drives the "Bewaard" badges.
  savedMessageIds: string[];
  // The Keep rows themselves, for the read-only dashboard replay.
  savedResponses?: DemoSavedResponse[];
}

export type DemoAnnotationPlacement = 'top' | 'bottom';

// One margin note. Text lives in public/locales/<lang>/demo.json under
// `annotations.<key>`; only the anchor is persona-specific.
export interface DemoAnnotationAnchor {
  key: string;
  messageId: string;
  // 'top' sits beside the start of the message (a user turn, say);
  // 'bottom' beside its end (where the Keep badge or the radar lives).
  placement?: DemoAnnotationPlacement;
}

// Hand-written overlay next to a fixture (<persona>.<lang>.curation.json).
// Lets us cut boring turns and place the annotations without touching the
// database or the exported transcript. Re-export → re-check this file: the
// ids are the exported row ids and change with every new walkthrough.
export interface DemoCuration {
  hiddenMessageIds?: string[];
  annotations?: DemoAnnotationAnchor[];
}
