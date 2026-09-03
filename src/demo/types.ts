// Shapes of the frozen demo fixtures under src/demo/fixtures/, written by
// scripts/demo-export-fixture.mjs. See docs/handoff/demo-replay-plan.md.
import type { ReportSection } from '@/hooks/useReportSections';
import type { JobSearchResult } from '@/hooks/useJobSearch';
import type { SavedJob } from '@/hooks/useSavedJobs';

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

// Demo-layer translation of a session (scripts/demo-translate-fixture.ts):
// every chat message in another language, plus the chat_highlights section
// (the one section the product's translator leaves alone). Overlaid on the
// fixture by applyTranslation() when the visitor's UI language is `to`.
export interface DemoTranslation {
  meta: { persona: string; from: string; to: string; model: string; translatedAt: string; methods: Record<string, string> };
  messages: Record<string, string>;
  sections: Record<string, { title: string; content: string }>;
}

export interface DemoFixture {
  persona: DemoPersona;
  // Set by applyTranslation(): the language the transcript is shown in when
  // it is not the session's own. Pages use it for the "you are reading a
  // translation" note.
  translatedTo?: string;
  messages: DemoMessage[];
  // Every report_sections row the chat components read (score pills, Move
  // pill, comparison radar, translated titles). init_summary is excluded.
  sections: ReportSection[];
  // Bot messages the persona pressed Keep on — drives the "Bewaard" badges.
  savedMessageIds: string[];
  // The Keep rows themselves, for the read-only dashboard replay.
  savedResponses?: DemoSavedResponse[];
  // Phase 4 (docs/handoff/demo-toolkit-plan.md): one REAL job-search run per
  // persona, frozen. Results are never stored server-side (the 24h cache
  // expires), so this fixture is the only copy: demo-export-fixture.mjs
  // carries the key over on a re-freeze. Written by demo-run-job-search.mjs.
  jobs?: DemoJobSearchResult[];
  // The persona's saved_jobs rows (the kanban), exported like savedResponses.
  savedJobs?: DemoSavedJob[];
}

// Structurally the JobSearchResult the Jobs page holds in state, plus when
// and how the search ran (the /demo/jobs intro prints the date; listings age).
export interface DemoJobSearchResult extends JobSearchResult {
  searchedAt?: string;
  searchOptions?: {
    countryCodes: string[];
    workArrangement: string;
    jobCommitment: string;
  };
}

export type DemoSavedJob = SavedJob;

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
