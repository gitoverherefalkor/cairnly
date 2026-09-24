// What happens to an incoming mail: the "Who approves what" table of the
// control-center spec (docs/superpowers/specs/2026-09-24-outreach-control-center-design.md),
// as a function.
//
//   bounce          → nothing sent; the address is marked broken
//   stop            → nothing sent, ever again (they asked not to be mailed)
//   ignore          → out-of-office; chases keep their cadence
//   auto_rejection  → the boilerplate "jammer, laat het weten" goes out by itself
//   review          → a concept waits for Sjoerd, with a push ping
//
// The auto-rejection lane is deliberately narrow. A rejection only goes
// unread when it is unambiguous: no question in it, and no real conversation
// behind it (no call booked or held). Anything else is a person Sjoerd
// should answer himself.

import type { Sentiment } from './outreachReply.ts';

export type Route = 'ignore' | 'stop' | 'bounce' | 'auto_rejection' | 'review';

const BOUNCE_FROM = /^(mailer-daemon|postmaster)@/i;
const BOUNCE_SUBJECT =
  /undeliverable|delivery status notification|mail delivery (failed|subsystem)|returned mail|onbestelbaar|niet afgeleverd|kan niet worden bezorgd/i;

/** Decided before any model call: a bounce is a machine talking, recognisably. */
export function isBounce(m: { from: string; subject: string; contentType?: string | null }): boolean {
  if (BOUNCE_FROM.test(m.from)) return true;
  if (BOUNCE_SUBJECT.test(m.subject)) return true;
  return /multipart\/report/i.test(m.contentType ?? '');
}

/** A real question in what they typed. A '?' inside a URL is a query string, not a question. */
export function hasQuestion(replyOnly: string): boolean {
  return replyOnly.replace(/https?:\/\/\S+/g, ' ').includes('?');
}

/** The status ladder, in the order of outreach_status_rank() in the database. */
const LADDER = [
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
];

/** A call booked or held means a real conversation; its rejection deserves Sjoerd's own words. */
const CONVERSATION_STARTED = new Set(['gesprek_gepland', 'gesprek_gevoerd', 'pilot_afgesproken', 'pilot_gestart', 'founding_partner']);

export function routeInbound(x: {
  bounce: boolean;
  /** null = the classifier failed; a human reads it. */
  sentiment: Sentiment | 'bounce' | null;
  /** Their text with our quoted mail stripped. */
  replyOnly: string;
  /** Prospect status before this mail. */
  statusBefore: string;
}): Route {
  if (x.bounce || x.sentiment === 'bounce') return 'bounce';
  if (x.sentiment === null) return 'review';
  if (x.sentiment === 'auto') return 'ignore';
  if (x.sentiment === 'stop') return 'stop';
  if (
    x.sentiment === 'afwijzing' &&
    !hasQuestion(x.replyOnly) &&
    LADDER.includes(x.statusBefore) &&
    !CONVERSATION_STARTED.has(x.statusBefore)
  ) {
    return 'auto_rejection';
  }
  return 'review';
}
