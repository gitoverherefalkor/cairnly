/**
 * Pricing source of truth for the marketing site.
 *
 * Stripe handles localized checkout (locale + currency are passed in the
 * create-checkout edge function). This file is for *display*, so the price the
 * user sees matches what they'll pay.
 *
 * The pro assessment runs on an introductory price until PRICE_SWITCH_AT and
 * moves to the regular price on its own — no deploy needed on the day.
 *
 * ⚠️ The constants below mirror supabase/functions/_shared/pricing.ts, which is
 * what actually charges the card. Vite and Deno cannot import from the same
 * module, so the values live in two places and pricing.test.ts fails the build
 * if they drift apart. Change a number here, change it there too.
 */

/**
 * Every flavor is charged in euros — create-checkout hardcodes
 * `currency: "eur"` on the Stripe session regardless of the buyer's language.
 * Display therefore follows the charge: an English visitor seeing "$39" and
 * then being billed €39 at Stripe is a mismatch at the worst possible moment.
 */
export const DISPLAY_CURRENCY = "EUR";

/**
 * The moment the introductory price expires: 15 October 2026, 23:59 Amsterdam,
 * so the whole of the 15th still gets the intro price. October 15 falls inside
 * CEST (summer time ends October 25), so the offset is +02:00.
 */
export const PRICE_SWITCH_AT = new Date("2026-10-15T23:59:00+02:00");

/** Pro assessment (cairnly.io) — introductory price, then the regular price. */
export const PRO_PRICE_INTRO = 39;
export const PRO_PRICE_REGULAR = 59;

/**
 * Anchor shown struck through while the introductory price runs. Matches
 * PRO_PRICE_REGULAR on purpose — it's the same price the assessment reverts
 * to once the intro window ends, not an inflated reference number, so the
 * strike-through and the "then €59" line next to it never disagree.
 */
export const PRO_PRICE_ANCHOR = 59;

/** Starter keeps its own price — the increase is for the pro assessment only. */
export const STARTER_PRICE = 39;
export const STARTER_PRICE_ANCHOR = 79;

/** Encore has always been priced on its own, with no strike-through anchor. */
export const ENCORE_PRICE = 79;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** The pro price in effect at `now`. */
export const proPriceAt = (now: Date = new Date()): number =>
  now >= PRICE_SWITCH_AT ? PRO_PRICE_REGULAR : PRO_PRICE_INTRO;

/** True while the introductory price is still running. */
export const isIntroPriceActive = (now: Date = new Date()): boolean =>
  now < PRICE_SWITCH_AT;

/**
 * Whole days and hours left on the introductory price, or null once it has
 * expired. Hours are the smallest unit on purpose — a seconds counter reads as
 * an infomercial to the audience that buys this.
 */
export const introPriceTimeLeft = (
  now: Date = new Date()
): { days: number; hours: number } | null => {
  const remaining = PRICE_SWITCH_AT.getTime() - now.getTime();
  if (remaining <= 0) return null;
  return {
    days: Math.floor(remaining / MS_PER_DAY),
    hours: Math.floor((remaining % MS_PER_DAY) / MS_PER_HOUR),
  };
};

/**
 * Display pricing for the pro assessment. `anchor` is null once the intro
 * price ends, which is the signal to stop rendering the strike-through.
 */
export const getProPricing = (now: Date = new Date()) => {
  const isIntro = isIntroPriceActive(now);
  return {
    currency: DISPLAY_CURRENCY,
    core: proPriceAt(now),
    anchor: isIntro ? PRO_PRICE_ANCHOR : null,
    isIntro,
  };
};

/** Display pricing for the starter flavor — fixed, not part of the increase. */
export const getStarterPricing = () => ({
  currency: DISPLAY_CURRENCY,
  core: STARTER_PRICE,
  anchor: STARTER_PRICE_ANCHOR,
});

/** Display pricing for the encore flavor — fixed, no anchor. */
export const getEncorePricing = () => ({
  currency: DISPLAY_CURRENCY,
  core: ENCORE_PRICE,
});
