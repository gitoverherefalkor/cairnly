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

export const INTAKE_SHOT_ALT: Record<IntakeShot, string> = {
  dashboard: 'Career dashboard with three scored matches',
  'ai-impact': 'Coach chat explaining how AI impacts a suggested role',
  'jobs-avoids': 'Job search hiding roles the user said to avoid',
  'salary-steps': 'Career detail with salary ranges and steps for pursuing the role',
  'key-insight': 'Coach chat sharing a key personal insight',
  radar: 'Radar chart comparing top career matches',
};

// Dream-job beat: no dedicated Dream Job Analysis capture yet; null leaves
// the visitor's current screen in place until one is added.
const DREAM: IntakeShot | null = null;

/** Per-intent beat plans (beat 1 first), mirroring beatsFor() server-side.
 * `null` means "this beat has no specific screen: leave the carousel where it
 * is" — early beats keep the pill-matched slide instead of all snapping to
 * the same dashboard shot. Exported for the server-drift test; not part of
 * the component API. */
export const PLANS: Record<string, (IntakeShot | null)[]> = {
  // default + life-changed open on the dashboard close-up (the strongest
  // "this is what you get" screen for those stories); the other pills keep
  // their pill-matched resting slide through the early beats.
  default: ['dashboard', null, null, DREAM, 'radar'],
  'good-at-it': [null, null, 'jobs-avoids', DREAM, 'radar'],
  'ai-worried': [null, 'ai-impact', DREAM, 'radar'],
  'life-changed': ['dashboard', null, 'salary-steps', DREAM],
  'understand-myself': [null, null, 'key-insight', DREAM, 'radar'],
  other: [null, null, null, DREAM, 'radar'],
};

/** The shot a beat should pin, or null when the beat has no opinion. */
export function intakeShotFor(intent: string, beat: number): IntakeShot | null {
  const plan = PLANS[intent] ?? PLANS.default;
  return plan[beat - 1] ?? null;
}

/** Which shot closes the funnel per intent, once the pitch lands. */
const PITCH_SHOT: Record<string, IntakeShot> = {
  default: 'dashboard',
  'good-at-it': 'dashboard',
  'ai-worried': 'ai-impact',
  'life-changed': 'salary-steps',
  'understand-myself': 'key-insight',
};

export function pitchShotFor(intent: string): IntakeShot {
  return PITCH_SHOT[intent] ?? 'dashboard';
}
