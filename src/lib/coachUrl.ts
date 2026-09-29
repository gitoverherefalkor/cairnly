// Links into the post-report coach page (/coach). Kept free of the Supabase
// client so shared dashboard components can build links without pulling it in.

export type CoachEntryPoint = 'chat' | 'career' | 'move' | 'set_aside' | 'checkin';

/**
 * Link into the coach page. `ask` is sent as the first message automatically
 * (costs one message, used for one-click questions like the Move pill);
 * `draft` only pre-fills the input so the user can edit before sending.
 */
export function coachUrl(opts: {
  entry?: CoachEntryPoint;
  context?: string;
  ask?: string;
  draft?: string;
}): string {
  const p = new URLSearchParams();
  if (opts.entry) p.set('entry', opts.entry);
  if (opts.context) p.set('context', opts.context);
  if (opts.ask) p.set('ask', opts.ask);
  if (opts.draft) p.set('draft', opts.draft);
  const qs = p.toString();
  return qs ? `/coach?${qs}` : '/coach';
}
