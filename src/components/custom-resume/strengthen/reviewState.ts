// Pure state machine for the one-at-a-time Strengthen review. All staging is
// client-side until the user hits "Apply my changes" — nothing here mutates
// the resume. Kept free of React so it's trivially unit-testable.
import type { Decision, StagedDecision, StrengthIssue, StrengthReview } from './types';

export type ReviewState = {
  queue: string[];                          // pending issue ids, review order
  cursor: string | null;                    // id of the card on screen
  staged: Record<string, StagedDecision>;
};

// Contract: callers must only dispatch undo/goto/accept/skip with ids drawn
// from state.queue (and for undo, ids present in state.staged). The reducer
// is deliberately dumb and does not defend against arbitrary ids.
export type ReviewAction =
  | { type: 'accept'; id: string; user_input?: string }
  | { type: 'skip'; id: string }
  | { type: 'undo'; id: string }
  | { type: 'goto'; id: string };

export function initReviewState(review: StrengthReview): ReviewState {
  const queue = review.issues.filter((i) => i.status === 'pending').map((i) => i.id);
  return { queue, cursor: queue[0] ?? null, staged: {} };
}

function nextCursor(state: ReviewState, staged: Record<string, StagedDecision>): string | null {
  return state.queue.find((id) => !staged[id]) ?? null;
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  if (action.type === 'accept') {
    const input = action.user_input?.trim();
    if (action.user_input !== undefined && !input) return state; // empty input no-op
    const staged = {
      ...state.staged,
      [action.id]: input ? { action: 'apply' as const, user_input: input } : { action: 'apply' as const },
    };
    return { ...state, staged, cursor: nextCursor(state, staged) };
  }
  if (action.type === 'skip') {
    const staged = { ...state.staged, [action.id]: { action: 'skip' as const } };
    return { ...state, staged, cursor: nextCursor(state, staged) };
  }
  if (action.type === 'undo') {
    const staged = { ...state.staged };
    delete staged[action.id];
    return { ...state, staged, cursor: action.id };
  }
  if (action.type === 'goto') {
    if (!state.queue.includes(action.id)) return state;
    return { ...state, cursor: action.id };
  }
  return state;
}

export function buildApplyPayload(state: ReviewState): Decision[] {
  const entries = Object.entries(state.staged);
  const applies = entries.filter(([, d]) => d.action === 'apply');
  const skips = entries.filter(([, d]) => d.action === 'skip');
  return [...applies, ...skips].map(([id, d]) => ({ id, ...d }));
}

export function projectedScore(review: StrengthReview, state: ReviewState): number {
  const impactById = new Map(review.issues.map((i) => [i.id, i.impact]));
  const stagedImpact = Object.entries(state.staged)
    .filter(([, d]) => d.action === 'apply')
    .reduce((s, [id]) => s + (impactById.get(id) ?? 0), 0);
  return Math.min(review.score_potential, review.score + stagedImpact);
}
