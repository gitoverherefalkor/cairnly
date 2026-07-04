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
export function moveLegend(current?: MoveLevel | null): string {
  const head = 'Move (reskilling effort to get into this role):';
  const lines = MOVE_LEVELS.map(
    (l) => `${l === current ? '▶ ' : '   '}${l}: ${MOVE_BLURB[l]}`,
  );
  return [head, ...lines].join('\n');
}
