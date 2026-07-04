// Deterministic domain logic for the Résumé Strengthen feature.
// Everything here is pure and side-effect free so it can be tested in Deno
// and (for selectIssues/getLineAtTarget) mirrored verbatim inside WF10's
// Code node — this file is the source of truth for that copy.

export type IssueTarget =
  | { section: 'summary' }
  | { section: 'experience'; exp_index: number; bullet_index: number }
  | { section: 'highlights'; index: number }
  | { section: 'skills'; group: 'technical' | 'tools' | 'soft' | 'languages'; index: number };

export type StrengthIssue = {
  id: string;
  flag: 'you_had_to_be_there' | 'naked_number' | 'jargon' | 'adjective_skill';
  card_type: 'one_tap' | 'needs_input';
  impact: number;
  target: IssueTarget;
  original_text: string;
  suggested_text?: string;
  question?: string;
  example?: string;
  preview_template?: string;
  status: 'pending' | 'applied' | 'skipped';
  user_input?: string | null;
};

export type StrengthReview = {
  status: 'pending' | 'ready' | 'applying' | 'failed';
  score: number;
  score_base: number;
  score_potential: number;
  language: string;
  generated_at: string;
  error?: string;
  issues: StrengthIssue[];
};

export type Decision = { id: string; action: 'apply' | 'skip'; user_input?: string };

// deno-lint-ignore no-explicit-any
type ResumeJson = any; // shape owned by WF9; we only address lines inside it

const WEAK_BASELINE = 40;
const CAP_NORMAL = 5;
const CAP_WEAK = 7;
const MAX_INPUT_LEN = 500;

// Runtime guard: this file gets copy-pasted into an n8n JS Code node, where
// numeric-string indices ('0' instead of 0) are a common slip. Only genuine
// integers may address a line.
const isIndex = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function getLineAtTarget(resume: ResumeJson, t: IssueTarget): string | null {
  try {
    if (t.section === 'summary') return typeof resume.summary === 'string' ? resume.summary : null;
    if (t.section === 'experience') {
      if (!isIndex(t.exp_index) || !isIndex(t.bullet_index)) return null;
      return resume.experience?.[t.exp_index]?.bullets?.[t.bullet_index] ?? null;
    }
    if (t.section === 'highlights') {
      if (!isIndex(t.index)) return null;
      return resume.highlights?.[t.index] ?? null;
    }
    if (t.section === 'skills') {
      if (!isIndex(t.index)) return null;
      return resume.skills_grouped?.[t.group]?.[t.index] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// Precondition: caller must have confirmed getLineAtTarget(resume, t) !== null.
// Throws on unresolvable targets by design — do not call blind (this applies
// to the WF10 Code-node copy too).
export function setLineAtTarget(resume: ResumeJson, t: IssueTarget, text: string): ResumeJson {
  const next = structuredClone(resume);
  if (t.section === 'summary') next.summary = text;
  else if (t.section === 'experience') next.experience[t.exp_index].bullets[t.bullet_index] = text;
  else if (t.section === 'highlights') next.highlights[t.index] = text;
  else if (t.section === 'skills') next.skills_grouped[t.group][t.index] = text;
  return next;
}

export function selectIssues(
  baseline: number,
  candidates: StrengthIssue[],
  resume: ResumeJson,
): StrengthReview {
  const valid = candidates.filter((c) => getLineAtTarget(resume, c.target) !== null);
  const cap = baseline < WEAK_BASELINE ? CAP_WEAK : CAP_NORMAL;
  const surfaced = [...valid].sort((a, b) => b.impact - a.impact).slice(0, cap)
    .map((c) => ({
      ...c,
      // Sanitize LLM-authored impacts at intake: integers 1..10 only.
      impact: Math.max(1, Math.min(10, Math.round(Number(c.impact) || 1))),
      status: 'pending' as const,
      user_input: null,
    }));
  const potential = Math.min(100, baseline + surfaced.reduce((s, i) => s + i.impact, 0));
  return {
    status: 'ready',
    score: baseline,
    score_base: baseline,
    score_potential: potential,
    language: 'en', // caller overwrites with the user's preferred_language
    generated_at: new Date().toISOString(),
    issues: surfaced,
  };
}

export function computeScore(review: StrengthReview): number {
  const applied = review.issues
    .filter((i) => i.status === 'applied')
    .reduce((s, i) => s + i.impact, 0);
  return Math.min(review.score_potential, review.score_base + applied);
}

export type ComposeItem = {
  id: string;
  target: IssueTarget;
  original_text: string;
  question: string;
  user_input: string;
};

export function applyDecisions(
  resume: ResumeJson,
  review: StrengthReview,
  decisions: Decision[],
): {
  patchedResume: ResumeJson;
  review: StrengthReview;
  composeItems: ComposeItem[];
  finalScoreAfterCompose: number;
} {
  // Reject duplicate ids up front: apply-then-skip for the same issue in one
  // payload would otherwise patch the line yet leave its status contradicted.
  const ids = decisions.map((d) => d.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate decision ids');

  const byId = new Map(review.issues.map((i) => [i.id, i]));
  let patched = resume;
  const composeItems: ComposeItem[] = [];
  const nextIssues = review.issues.map((i) => ({ ...i }));
  const nextById = new Map(nextIssues.map((i) => [i.id, i]));

  for (const d of decisions) {
    const issue = byId.get(d.id); // immutable fields only (card_type/target/impact)
    if (!issue) throw new Error(`Unknown issue id: ${d.id}`);
    const next = nextById.get(d.id)!;
    // Consult LIVE state for the already-applied guard, not the frozen snapshot:
    if (next.status === 'applied') throw new Error(`Issue already applied: ${d.id}`);

    if (d.action === 'skip') {
      next.status = 'skipped';
      continue;
    }
    if (issue.card_type === 'one_tap') {
      if (!issue.suggested_text) throw new Error(`one_tap issue missing suggested_text: ${d.id}`);
      // Trust boundary: user may have edited the suggestion. Cap length,
      // fall back to the stored suggestion when no override given.
      const text = (d.user_input ?? issue.suggested_text).slice(0, MAX_INPUT_LEN);
      patched = setLineAtTarget(patched, issue.target, text);
      next.status = 'applied';
      next.user_input = d.user_input ?? null;
    } else {
      const input = (d.user_input ?? '').trim();
      if (!input) throw new Error(`needs_input issue requires user_input: ${d.id}`);
      if (input.length > MAX_INPUT_LEN) throw new Error(`user_input too long for ${d.id}`);
      composeItems.push({
        id: issue.id,
        target: issue.target,
        original_text: issue.original_text,
        question: issue.question ?? '',
        user_input: input,
      });
      next.user_input = input; // stays 'pending' until compose writes the line
    }
  }

  const interim: StrengthReview = { ...review, issues: nextIssues };
  interim.score = computeScore(interim);

  const composeImpact = composeItems
    .map((c) => byId.get(c.id)!.impact)
    .reduce((s, n) => s + n, 0);
  const finalScoreAfterCompose = Math.min(
    interim.score_potential,
    interim.score + composeImpact,
  );

  return { patchedResume: patched, review: interim, composeItems, finalScoreAfterCompose };
}
