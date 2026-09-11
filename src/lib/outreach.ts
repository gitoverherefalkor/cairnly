// Outreach tab helpers: status vocabulary and the default row order.
//
// The status list mirrors the check constraint on outreach_prospects.status
// (and supabase/functions/_shared/outreach.ts, which Vite cannot import).

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

export const STATUS_LABELS: Record<OutreachStatus, string> = {
  nog_niet_benaderd: 'Nog niet benaderd',
  verzonden: 'Verzonden',
  opvolging_1: 'Opvolging 1',
  opvolging_2: 'Opvolging 2',
  gereageerd: 'Gereageerd',
  gesprek_gepland: 'Gesprek gepland',
  gesprek_gevoerd: 'Gesprek gevoerd',
  pilot_afgesproken: 'Pilot afgesproken',
  partner_aangemaakt: 'Partner aangemaakt',
  codes_gemint: 'Codes gemint',
  pilot_gestart: 'Pilot gestart',
  founding_partner: 'Founding partner',
  afgewezen: 'Afgewezen',
  geen_fit: 'Geen fit',
};

export type MailSentiment = 'positief' | 'code' | 'vraag' | 'later' | 'afwijzing' | 'auto' | 'overig';

export const SENTIMENT_LABELS: Record<MailSentiment, string> = {
  positief: 'Positief',
  code: 'Wil code',
  vraag: 'Vraag',
  later: 'Later',
  afwijzing: 'Afwijzing',
  auto: 'Auto-reply',
  overig: 'Overig',
};

/** One row of outreach_mails, as the tab shows it. */
export interface OutreachMail {
  id: string;
  direction: 'in' | 'out';
  kind: 'eerste' | 'opvolging' | 'antwoord' | 'reactie';
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  snippet: string | null;
  sent_at: string;
  sentiment: MailSentiment | null;
  samenvatting: string | null;
  draft_id: string | null;
  status_voor: string | null;
  status_na: string | null;
}

export interface OutreachProspect {
  slug: string;
  naam: string | null;
  tier: 'A' | 'B' | 'C' | null;
  categorie: string | null;
  contactpersoon: string | null;
  plaats: string | null;
  campaign: string | null;
  to_email: string | null;
  status: OutreachStatus;
  notities: string | null;
  updated_at: string;
  /** When the mail actually went out. Null for anything not sent yet. */
  verzonden_op: string | null;
  /** Every non-bot click, scanner hits included. */
  kliks_totaal: number;
  kliks_uniek_dagen: number;
  eerste_klik: string | null;
  laatste_klik: string | null;
  bot_kliks: number;
  /** Non-bot clicks inside 2 minutes of verzonden_op: mail scanner shaped. */
  kliks_verdacht: number;
  /** The rest. This is the number the tab shows and sorts on. */
  kliks_bevestigd: number;
  dagen_bevestigd: number;
  eerste_bevestigde_klik: string | null;
  laatste_bevestigde_klik: string | null;
  /** Phase 3: partner hand-off. */
  partner_slug: string | null;
  partner_naam: string | null;
  codes_issued: number;
  codes_claimed: number;
  /** Phase 3: mail log, newest first, capped. */
  mails: OutreachMail[];
  laatste_mail_op: string | null;
  laatste_mail_richting: 'in' | 'out' | null;
  laatste_sentiment: MailSentiment | null;
  laatste_samenvatting: string | null;
  /** The newest mail is theirs and a Gmail draft is waiting for it. */
  concept_klaar: boolean;
  /** The newest mail is theirs (not an auto-reply): Sjoerd is up. */
  needs_reply: boolean;
}

/**
 * "Warm": someone opened the demo but the pipeline says we have not followed
 * up yet. These go to the top of the table, that is the whole reason to
 * open the tab.
 *
 * Counts CONFIRMED clicks only. The first three clicks of the bureaus-sep26
 * batch landed under 90 seconds after their mail went out, which is a link
 * scanner rather than a reader; letting those float to the top would send
 * Sjoerd chasing bureaus that never opened anything.
 */
export function isWarm(p: Pick<OutreachProspect, 'kliks_bevestigd' | 'status'>): boolean {
  return p.kliks_bevestigd > 0 && (p.status === 'nog_niet_benaderd' || p.status === 'verzonden');
}

/**
 * Default order: bureaus waiting for OUR reply first (their mail is the newest
 * thing in the thread), then warm rows, then most recent confirmed click first
 * (rows without one last), then tier A before B before C, then name.
 */
export function compareProspects(a: OutreachProspect, b: OutreachProspect): number {
  const reply = Number(Boolean(b.needs_reply)) - Number(Boolean(a.needs_reply));
  if (reply !== 0) return reply;

  const warm = Number(isWarm(b)) - Number(isWarm(a));
  if (warm !== 0) return warm;

  const at = a.laatste_bevestigde_klik ? Date.parse(a.laatste_bevestigde_klik) : -Infinity;
  const bt = b.laatste_bevestigde_klik ? Date.parse(b.laatste_bevestigde_klik) : -Infinity;
  if (at !== bt) return bt - at;

  const tier = (a.tier ?? 'Z').localeCompare(b.tier ?? 'Z');
  if (tier !== 0) return tier;

  return (a.naam ?? '').localeCompare(b.naam ?? '', 'nl');
}
