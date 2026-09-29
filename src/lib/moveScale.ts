import { moveBlurb, moveLabel } from '@/lib/enumLabels';

// Move = reskilling effort to get into a role. 4-level scale, AI-adjusted,
// set by WF4 per career (report_sections.metadata.move). Single source of
// truth for the chat badge, dashboard pill, and share card so the levels,
// colors, and hover legend never drift apart.

export const MOVE_LEVELS = ['Ready now', 'Reframe', 'Upskill', 'Retrain'] as const;
export type MoveLevel = (typeof MOVE_LEVELS)[number];

// Low effort -> high effort. Used by the dashboard pill + share card (hex).
export const MOVE_COLOR: Record<MoveLevel, string> = {
  'Ready now': '#22c55e', // bright green — green is go
  Reframe: '#14b8a6',     // teal
  Upskill: '#f59e0b',     // amber
  Retrain: '#f97316',     // orange
};

export const MOVE_BLURB: Record<MoveLevel, string> = {
  'Ready now': 'your skills already fit',
  Reframe: 'reposition your experience, no new skills',
  Upskill: 'a real but bridgeable learning gap',
  Retrain: 'a large gap or a new field',
};

export function normalizeMove(raw: string | null | undefined): MoveLevel | null {
  if (!raw) return null;
  return MOVE_LEVELS.find((l) => l.toLowerCase() === raw.toLowerCase().trim()) ?? null;
}

// Multiline legend for a native title tooltip; the current level is marked.
// Labels/blurbs localize via enumLabels; the stored level tokens stay English
// (language contract — machine tokens in the DB are always English).
export function moveLegend(current?: MoveLevel | null, lang?: string | null): string {
  const nl = String(lang ?? 'en').toLowerCase().startsWith('nl');
  const head = nl
    ? 'Stap (omscholingsinspanning om in deze rol te komen):'
    : 'Move (reskilling effort to get into this role):';
  const lines = MOVE_LEVELS.map(
    (l) => `${l === current ? '▶ ' : '   '}${moveLabel(l, lang)}: ${moveBlurb(l, MOVE_BLURB[l], lang)}`,
  );
  return [head, ...lines].join('\n');
}

// Builds the question auto-sent by the "Can I get there from here?" pill.
// Names the role inline so the agent has context without the [About <role>]
// prefix (that prefix is only applied to free-text turns, not chip sends),
// and explicitly asks for the transition/reskilling angle so the reply
// covers feasibility of the jump, not just the role itself.
// Written in the viewer's language: the user reads it as their own message,
// and the agent mirrors the language of the question in its reply.
export function buildFeasibilityQuestion(
  roleTitle: string,
  moveLevel?: string | null,
  lang?: string | null,
): string {
  const nl = String(lang ?? 'en').slice(0, 2).toLowerCase() === 'nl';
  const base = nl
    ? `Hoe realistisch is de overstap naar ${roleTitle} vanaf waar ik nu sta, en wat zou ik moeten leren of bijleren om daar te komen?`
    : `How realistic is the move into ${roleTitle} from where I am now, and what would I need to learn or reskill to get there?`;
  // When the report has a Move rating for this role, name it so the agent ties
  // its answer to the pill and justifies the label (rather than answering blind).
  // The level is quoted with the label the user sees on the pill (localised).
  // (Answer legibility / short paragraphs is handled by the WF5 system prompt.)
  if (!moveLevel) return base;
  const shownLevel = moveLabel(moveLevel, lang);
  return nl
    ? `${base} Mijn rapport beoordeelt de benodigde stap voor deze overstap als "${shownLevel}". Leg uit waarom die beoordeling zo is, en of die klopt.`
    : `${base} My report rates the reskilling effort for this move as "${shownLevel}". Explain why it is rated that, and whether it holds up.`;
}
