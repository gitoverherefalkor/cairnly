// Shared bits for the outreach click tracking (outreach-click + ops-outreach).

/**
 * Link scanners and other non-humans that "click" an outreach link. Outlook
 * SafeLinks and Gmail's image/URL proxies open every link seconds after the
 * mail lands, which would otherwise read as a hot lead. Case-insensitive
 * substring match on the user-agent, exactly the list from the phase 2 brief.
 *
 * This is a list, not a guarantee. Phase 3 adds time-based filtering against
 * the send timestamp once that exists.
 */
export const BOT_UA_PATTERNS = [
  'bot',
  'crawler',
  'spider',
  'preview',
  'headless',
  'microsoft office',
  'safelinks',
  'outlook',
  'google-safety',
  'googleimageproxy',
  'curl',
  'python-requests',
  'slackbot',
  'linkedinbot',
  'whatsapp',
];

/**
 * True when the user-agent looks like a scanner rather than a browser. An
 * empty user-agent is treated as a bot too: every real browser sends one, a
 * bare HTTP client often does not.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim().toLowerCase();
  if (!ua) return true;
  return BOT_UA_PATTERNS.some((p) => ua.includes(p));
}

/** Allowed values of outreach_prospects.status. Mirrors the DB check constraint. */
export const OUTREACH_STATUSES = [
  'nog_niet_benaderd',
  'verzonden',
  'opvolging_1',
  'opvolging_2',
  'gereageerd',
  'gesprek_gepland',
  'gesprek_gevoerd',
  'pilot_afgesproken',
  'partner_aangemaakt',
  'codes_gemint',
  'pilot_gestart',
  'founding_partner',
  'afgewezen',
  'geen_fit',
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

// ─── Parked replies and the check-in ─────────────────────────────────────────
//
// Some replies need no answer now but do need one later: "I'll pass it on, my
// colleagues will be in touch." /ops parks those ("Park, they'll get back to
// me"), which takes the agency off Waiting on you and starts a check-in clock.
// Mirrored in src/lib/outreach.ts, which Vite cannot import from here.

/** Working days after parking before the check-in is due. Two weeks: time to talk it over internally. */
export const CHECK_IN_WORKING_DAYS = 10;

/**
 * No check-in once the conversation has moved on: a call is booked, they said
 * no, or they are already running a pilot.
 */
export const CHECK_IN_CLOSED: ReadonlySet<string> = new Set([
  'nog_niet_benaderd',
  'gesprek_gepland',
  'pilot_gestart',
  'founding_partner',
  'afgewezen',
  'geen_fit',
]);

interface LatestMail {
  direction: string;
  sentiment?: string | null;
  sent_at: string;
}

/**
 * Parked = they wrote last (a person, not an out-of-office) and the park stamp
 * is newer than that mail. A fresh mail from them un-parks it by itself; so
 * does any mail from us, because then we wrote last.
 */
export function isParked(dismissedAt: string | null | undefined, latest: LatestMail | null | undefined): boolean {
  if (!dismissedAt || !latest) return false;
  if (latest.direction !== 'in' || latest.sentiment === 'auto') return false;
  return Date.parse(dismissedAt) >= Date.parse(latest.sent_at);
}
