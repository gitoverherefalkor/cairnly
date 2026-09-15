/**
 * Question 3d ("What kind of schedule works best for you?") lets the candidate
 * add a weekly hours ceiling. Rather than a new sidecar, the ceiling is folded
 * into the answer string itself:
 *
 *   "Part-time work (max 24 hours/week)"
 *
 * That keeps the whole n8n chain working untouched. WF1's `Process Survey Data1`
 * copies `chosen` through verbatim and matches the option list with
 * `String(userAns).includes(opt)`, so the base choice still resolves; the
 * `[NON-NEGOTIABLE]` marker is then appended after ours, giving WF3 one
 * readable string:
 *
 *   "Part-time work (max 24 hours/week) [NON-NEGOTIABLE]"
 *
 * The suffix is ALWAYS English, in every locale. `config.choices` is the
 * canonical answer value (see useSurvey.ts) and WF1's SURVEY_SCHEMA matches on
 * the English options — only the field's label is translated.
 */

const HOURS_CEILING = / \(max (\d+) hours\/week\)$/;

/** Splits a stored answer back into its base choice and the hours ceiling. */
export function splitHoursCeiling(raw: unknown): { choice: string; hours: string } {
  if (typeof raw !== 'string') return { choice: '', hours: '' };
  const match = raw.match(HOURS_CEILING);
  if (!match) return { choice: raw, hours: '' };
  return { choice: raw.slice(0, match.index), hours: match[1] };
}

/** Composes the stored answer. No choice or no hours means no suffix. */
export function joinHoursCeiling(choice: string, hours: string): string {
  const trimmed = (hours || '').trim();
  if (!choice || !trimmed) return choice;
  return `${choice} (max ${trimmed} hours/week)`;
}

/**
 * Digits only, capped at 80, so the composed string always round-trips through
 * splitHoursCeiling and n8n never sees "max 240 hours/week".
 */
export function sanitizeHours(input: string): string {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '').slice(0, 2);
  if (!digits) return '';
  return String(Math.min(Number(digits), 80));
}
