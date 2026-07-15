/**
 * Show-don't-tell mapping for the intake chat: which REAL product screenshot
 * the hero pins beside each conversation beat, per intent. Beat order mirrors
 * the server's beat plans in supabase/functions/intake-chat/prompts.ts
 * (beatsFor): keep the two in sync when a plan changes.
 */
export type IntakeShot =
  | 'dashboard'
  | 'ai-impact'
  | 'jobs-avoids'
  | 'salary-steps'
  | 'key-insight'
  | 'radar';

export const INTAKE_SHOT_SRC: Record<IntakeShot, string> = {
  dashboard: '/images/live/landing/intake/dashboard-top-matches.jpg',
  'ai-impact': '/images/live/landing/intake/coach-ai-impact.jpg',
  'jobs-avoids': '/images/live/landing/intake/jobs-hiding-avoids.jpg',
  'salary-steps': '/images/live/landing/intake/career-salary-steps.jpg',
  'key-insight': '/images/live/landing/intake/coach-key-insight.jpg',
  radar: '/images/live/landing/intake/career-compare-radar.jpg',
};

// Dream-job beat: no dedicated Dream Job Analysis capture yet; the dashboard
// (which lists the dream jobs) stands in until one is added.
const DREAM: IntakeShot = 'dashboard';

/** Per-intent beat plans (beat 1 first), mirroring beatsFor() server-side. */
const PLANS: Record<string, IntakeShot[]> = {
  default: ['dashboard', 'dashboard', 'dashboard', DREAM, 'radar'],
  'good-at-it': ['dashboard', 'dashboard', 'jobs-avoids', DREAM, 'radar'],
  'ai-worried': ['dashboard', 'ai-impact', DREAM, 'radar'],
  'life-changed': ['dashboard', 'dashboard', 'salary-steps', DREAM],
  'understand-myself': ['dashboard', 'dashboard', 'key-insight', DREAM, 'radar'],
  other: ['dashboard', 'dashboard', 'dashboard', DREAM, 'radar'],
};

export function intakeShotFor(intent: string, beat: number): IntakeShot {
  const plan = PLANS[intent] ?? PLANS.default;
  return plan[beat - 1] ?? 'dashboard';
}

/** Screenshot shown beside the package card once the pitch lands. */
export const PITCH_SHOT_SRC: Record<string, string> = {
  default: INTAKE_SHOT_SRC.dashboard,
  'good-at-it': INTAKE_SHOT_SRC.dashboard,
  'ai-worried': INTAKE_SHOT_SRC['ai-impact'],
  'life-changed': INTAKE_SHOT_SRC['salary-steps'],
  'understand-myself': INTAKE_SHOT_SRC['key-insight'],
};
