/**
 * The partners pre-chat's offer card, computed in code, never by the model.
 *
 * Two answers decide what is on the card: the client group (is there an offer
 * at all) and the yearly volume (pilot or free credits first). The payment
 * model decides which money line the card and the pitch carry. Every number
 * comes from PARTNER_TIERS below.
 *
 * Pure TypeScript, no Deno imports: vitest runs partnerOffer.test.ts against
 * it, including a drift check against the price rows on /partners
 * (public/locales/{en,nl}/partners.json → pricing.rows). Change a price there
 * and here together, or that test fails.
 */

import { PRO_PRICE } from './pricing.ts';

/** One rung of the credit ladder on /partners. `max: null` = "and up". */
export interface PartnerTier {
  min: number;
  max: number | null;
  /** Euro per credit, excluding VAT. */
  price: number;
}

export const PARTNER_TIERS: readonly PartnerTier[] = [
  { min: 1, max: 9, price: 44 },
  { min: 10, max: 24, price: 38 },
  { min: 25, max: 49, price: 33 },
  { min: 50, max: 99, price: 29 },
  { min: 100, max: 249, price: 24 },
  { min: 250, max: null, price: 20 },
];

/** The free pilot: credits per agency (the /partners pilot copy says the same). */
export const PILOT_CREDITS = 10;
/** Free credits a practitioner gets to try it on themselves, minted by hand. */
export const FREE_CREDITS = 3;

// Answer keys. The chips carry localized labels; these are what the server
// stores and reasons with.
export const CLIENT_GROUPS = ['office', 'leadership', 'mixed', 'not_fit'] as const;
export const PAYMENT_MODELS = ['fixed_fee', 'hourly', 'client_pays', 'mixed'] as const;
export const VOLUME_BANDS = ['lt10', '10_49', '50_199', '200_plus'] as const;

export type ClientGroup = (typeof CLIENT_GROUPS)[number];
export type PaymentModel = (typeof PAYMENT_MODELS)[number];
export type VolumeBand = (typeof VOLUME_BANDS)[number];

export type OfferAction = 'pilot_call' | 'free_credits' | 'call';

export interface PartnerOffer {
  /**
   * pilot   = book 20 minutes about the pilot first, free credits second
   * credits = free credits first, a call second
   * none    = the client group is outside what Cairnly fits; no offer
   * consumer = the visitor is a job seeker, not a practitioner
   */
  kind: 'pilot' | 'credits' | 'none' | 'consumer';
  /** mixed = offer as for office clients, with the limit named on the card. */
  fit: 'office' | 'mixed' | 'not_fit';
  clientGroup: ClientGroup | null;
  payment: PaymentModel | null;
  volume: VolumeBand | null;
  primary: OfferAction | null;
  secondary: OfferAction | null;
  /** The call as a quiet text link rather than a button (solo coaches under 10 a year). */
  quietCall: boolean;
  /** The ladder rows that matter at this volume (one or two). */
  tiers: PartnerTier[];
  /** Fixed fee: what a typical order would cost, per trajectory. */
  example: { credits: number; total: number; perCredit: number } | null;
  /** Pass-on payment models: the consumer price against the credit price. */
  passOn: { consumerPrice: number; creditFrom: number; creditTo: number } | null;
  pilotCredits: number;
  freeCredits: number;
}

/** The tier a given number of credits falls in. */
export function tierFor(credits: number): PartnerTier {
  return PARTNER_TIERS.find((t) => credits >= t.min && (t.max === null || credits <= t.max)) ?? PARTNER_TIERS[0];
}

const TIER_ROWS_BY_VOLUME: Record<VolumeBand, number[]> = {
  lt10: [1],
  '10_49': [10, 25],
  '50_199': [50, 100],
  '200_plus': [100, 250],
};

/** A typical order at this volume, for the fixed-fee example line. */
const EXAMPLE_CREDITS: Record<VolumeBand, number> = {
  lt10: 5,
  '10_49': 25,
  '50_199': 100,
  '200_plus': 250,
};

/** Volumes at which an agency decides with its advisers, so the pilot leads. */
const PILOT_VOLUMES: readonly VolumeBand[] = ['50_199', '200_plus'];

export function buildPartnerOffer(input: {
  clientGroup: ClientGroup | null;
  payment: PaymentModel | null;
  volume: VolumeBand | null;
  jobSeeker?: boolean;
  pilotSlotsLeft: number;
}): PartnerOffer {
  const { clientGroup, payment, volume } = input;
  const base = {
    clientGroup,
    payment,
    volume,
    quietCall: false,
    tiers: [] as PartnerTier[],
    example: null,
    passOn: null,
    pilotCredits: PILOT_CREDITS,
    freeCredits: FREE_CREDITS,
  };

  if (input.jobSeeker) {
    return { ...base, kind: 'consumer', fit: 'office', primary: null, secondary: null };
  }
  if (clientGroup === 'not_fit') {
    return { ...base, kind: 'none', fit: 'not_fit', primary: null, secondary: null };
  }

  const fit = clientGroup === 'mixed' ? 'mixed' : 'office';
  const pilot = volume !== null && PILOT_VOLUMES.includes(volume) && input.pilotSlotsLeft > 0;
  const tiers = (volume ? TIER_ROWS_BY_VOLUME[volume] : [1, 10]).map(tierFor);

  const example =
    payment === 'fixed_fee' && volume
      ? (() => {
          const credits = EXAMPLE_CREDITS[volume];
          const perCredit = tierFor(credits).price;
          return { credits, total: credits * perCredit, perCredit };
        })()
      : null;

  const passOn =
    payment && payment !== 'fixed_fee'
      ? {
          consumerPrice: PRO_PRICE,
          creditFrom: Math.min(...tiers.map((t) => t.price)),
          creditTo: Math.max(...tiers.map((t) => t.price)),
        }
      : null;

  return {
    ...base,
    kind: pilot ? 'pilot' : 'credits',
    fit,
    primary: pilot ? 'pilot_call' : 'free_credits',
    secondary: pilot ? 'free_credits' : 'call',
    // A solo coach with a handful of clients is often just exploring: the call
    // stays available, but as a quiet link rather than a second button.
    quietCall: !pilot && volume === 'lt10',
    tiers,
    example,
    passOn,
  };
}
