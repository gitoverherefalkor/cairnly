// Jev AI-impact: the questions and the label rules from docs/jev-cairnly-ontwerp-2026-09-23.md, 2.3b.
// Pure logic, no Deno imports, so vitest can test it. Must stay identical to designLabel in
// scripts/jev-ai-impact.mjs (--scale work), which produced the measured distribution
// (642 rows: 6 Minimal, 316 Moderate, 317 High, 3 Severe, 0 Critical).

export const AI_IMPACT_LEVELS = ['Minimal', 'Moderate', 'High', 'Severe', 'Critical'] as const;
export type AiImpactLevel = (typeof AI_IMPACT_LEVELS)[number];

// The three questions, verbatim from 2.3b.
export const AI_IMPACT_QUESTIONS = {
  physical_role: {
    type: 'noul',
    instructions: 'Does this role require physical presence or manual dexterity as its core, such as construction, trades, landscaping, or hands-on healthcare, judged on `title`, `overview` and `typical_tasks`?',
  },
  orchestrator_role: {
    type: 'noul',
    instructions: 'Does this role carry strategic accountability and final human judgment at the top of an organization or practice, such as Head of, VP, Director, C-suite, Owner or Partner, where high-stakes decisions, organizational politics and legal accountability cannot be delegated to AI?',
  },
  ai_impact: {
    type: 'score',
    instructions: {
      context: 'Project forward 18 to 24 months, assuming agentic AI that executes multi-step workflows end to end, keeps project and client context over months, and operates business software at professional level. Use `research` to calibrate.',
      question: "How much of this role's core work in `overview` and `typical_tasks` will AI take over? Judge the work itself, not how many of these jobs will exist.",
    },
    criteria: [
      'AI takes over almost nothing. The work rests on physical presence, hands-on skill, or personal accountability that AI cannot carry. Think: skilled trades, emergency response, hands-on care.',
      'AI takes over routine parts: research, drafting, analysis. The person keeps the judgment, editing and decisions, and remains essential. Think: product management, senior consulting, people leadership.',
      'AI takes over a large part of the day-to-day work; the person directs and quality-checks the AI instead of doing that work by hand. Think: mid-level analysis, marketing execution, project coordination.',
      'AI does most of the work; the person mainly supervises and handles exceptions. Think: standard reporting, routine QA, first-line content.',
      'AI does the core work end to end, faster and cheaper, with little human involvement left. Think: data entry, basic customer support, routine translation.',
    ],
  },
} as const;

export interface JevAiImpactAnswers {
  physical_role: { noul: number };
  orchestrator_role: { noul: number };
  ai_impact: { score: number; confidence?: number; probabilities?: Record<string, number> };
}

export type LabelRule = 'physical' | 'orchestrator' | 'floor' | 'score';

// 2.3b:
// - physical_role > 0.8 → Minimal.
// - Severe and Critical only when the score reaches that level (2.5-2.99 stays High, 3.5-3.99 Severe).
// - orchestrator_role > 0.8 → at most Moderate (Minimal allowed, no floor).
// - everyone else round(score) with a floor of Moderate.
export function designLabel(a: JevAiImpactAnswers): { label: AiImpactLevel; rule: LabelRule } {
  if (a.physical_role.noul > 0.8) return { label: 'Minimal', rule: 'physical' };
  let lvl = Math.round(a.ai_impact.score);
  if (lvl >= 3 && a.ai_impact.score < lvl) lvl -= 1;
  lvl = Math.max(0, Math.min(4, lvl));
  if (a.orchestrator_role.noul > 0.8) return { label: AI_IMPACT_LEVELS[Math.min(lvl, 1)], rule: 'orchestrator' };
  if (lvl < 1) return { label: 'Moderate', rule: 'floor' };
  return { label: AI_IMPACT_LEVELS[lvl], rule: 'score' };
}

// Kind of role. Own work = founder / freelance_fractional path, or a company_size_type starting
// with "Own Company". Everything else is employment, including rows without a path_type.
export type Ownership = 'own_work' | 'employee';

export function ownershipOf(row: { path_type?: string | null; company_size_type?: string | null }): Ownership {
  const pt = (row.path_type ?? '').trim().toLowerCase();
  if (pt === 'founder' || pt === 'freelance_fractional') return 'own_work';
  if ((row.company_size_type ?? '').trim().toLowerCase().startsWith('own company')) return 'own_work';
  return 'employee';
}

// Employees: Severe or Critical never in the top 3 (enforced in WF3 Ranking). Own work: no ban.
export function blockedFromTop3(level: AiImpactLevel | null | undefined, ownership: Ownership): boolean {
  return ownership === 'employee' && (level === 'Severe' || level === 'Critical');
}

// The state Jev sees for one career. Only job information, never profile, CV or chat data.
export function jevState(
  job: {
    career_title: string | null;
    overview: string | null;
    typical_tasks: string[] | null;
    company_size_type: string | null;
    path_type: string | null;
  },
  research: string | null,
) {
  return {
    title: job.career_title,
    overview: job.overview,
    typical_tasks: job.typical_tasks,
    company_size_type: job.company_size_type,
    path_type: job.path_type,
    research,
  };
}
