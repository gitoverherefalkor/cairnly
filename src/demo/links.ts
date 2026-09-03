// Links between the demo pages (/demo, /demo/dashboard, /demo/jobs).
//
// Two query parameters travel with the visitor and must survive every hop:
//   p        the partner audience tag (?p=<slug>): CTAs point at the pilot
//            call instead of checkout, and the visit is attributed
//   persona  which frozen session to show (?persona=emma|marcel), set by the
//            homepage entry points; overrides the language pick
// Everything else in the query string is dropped.
import { isDemoPersonaId, type DemoPersonaId } from './loadFixture';

const CARRIED = ['p', 'persona'] as const;

/** The `?persona=` value when it names a persona the demo knows. */
export function readPersonaParam(search: string): DemoPersonaId | undefined {
  const value = new URLSearchParams(search).get('persona');
  return isDemoPersonaId(value) ? value : undefined;
}

/** The query string to carry to the next demo page ('' when nothing to carry). */
export function demoQuery(search: string): string {
  const from = new URLSearchParams(search);
  const to = new URLSearchParams();
  for (const key of CARRIED) {
    const value = from.get(key);
    if (value) to.set(key, value);
  }
  const out = to.toString();
  return out ? `?${out}` : '';
}

/** `route` with the carried parameters appended. */
export function demoLink(route: string, search: string): string {
  return `${route}${demoQuery(search)}`;
}
