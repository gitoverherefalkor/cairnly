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
