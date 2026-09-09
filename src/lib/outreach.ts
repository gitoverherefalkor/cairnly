// Outreach tab helpers: status vocabulary and the default row order.
//
// The status list mirrors the check constraint on outreach_prospects.status
// (and supabase/functions/_shared/outreach.ts, which Vite cannot import).

export const OUTREACH_STATUSES = [
  'nog_niet_benaderd',
  'verzonden',
  'opvolging_1',
  'opvolging_2',
  'gesprek_gepland',
  'gesprek_gevoerd',
  'pilot_afgesproken',
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
  gesprek_gepland: 'Gesprek gepland',
  gesprek_gevoerd: 'Gesprek gevoerd',
  pilot_afgesproken: 'Pilot afgesproken',
  pilot_gestart: 'Pilot gestart',
  founding_partner: 'Founding partner',
  afgewezen: 'Afgewezen',
  geen_fit: 'Geen fit',
};

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
  kliks_totaal: number;
  kliks_uniek_dagen: number;
  eerste_klik: string | null;
  laatste_klik: string | null;
  bot_kliks: number;
}

/**
 * "Warm": someone opened the demo but the pipeline says we have not followed
 * up yet. These go to the top of the table, that is the whole reason to
 * open the tab.
 */
export function isWarm(p: Pick<OutreachProspect, 'kliks_totaal' | 'status'>): boolean {
  return p.kliks_totaal > 0 && (p.status === 'nog_niet_benaderd' || p.status === 'verzonden');
}

/**
 * Default order: warm rows first, then most recent click first (rows without
 * a click last), then tier A before B before C, then name for stability.
 */
export function compareProspects(a: OutreachProspect, b: OutreachProspect): number {
  const warm = Number(isWarm(b)) - Number(isWarm(a));
  if (warm !== 0) return warm;

  const at = a.laatste_klik ? Date.parse(a.laatste_klik) : -Infinity;
  const bt = b.laatste_klik ? Date.parse(b.laatste_klik) : -Infinity;
  if (at !== bt) return bt - at;

  const tier = (a.tier ?? 'Z').localeCompare(b.tier ?? 'Z');
  if (tier !== 0) return tier;

  return (a.naam ?? '').localeCompare(b.naam ?? '', 'nl');
}
