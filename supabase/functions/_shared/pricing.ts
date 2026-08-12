/**
 * Pricing source of truth for the edge functions.
 *
 * The pro assessment runs on an introductory price until PRICE_SWITCH_AT, then
 * moves to the regular price on its own. Everything that charges or quotes a
 * price derives it from here, so the checkout, the receipt and the intake chat
 * can never disagree about what the assessment costs.
 *
 * ⚠️ src/lib/pricing.ts mirrors these values for the browser — Vite and Deno
 * cannot import from the same module. src/lib/pricing.test.ts reads this file
 * and fails if the two drift apart. Change a number here, change it there too.
 */

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

/**
 * Starter (cairnly.io/starter) keeps its own price — the increase is for the
 * pro assessment only, since starters on the job market carry less budget.
 */
export const STARTER_PRICE = 39;
export const STARTER_PRICE_ANCHOR = 79;

/** Encore (cairnly.io/encore) has always been priced on its own, no anchor. */
export const ENCORE_PRICE = 79;

/** The pro price in effect at `now`. */
export const proPriceAt = (now: Date = new Date()): number =>
  now >= PRICE_SWITCH_AT ? PRO_PRICE_REGULAR : PRO_PRICE_INTRO;

/** True while the introductory price is still running. */
export const isIntroPriceActive = (now: Date = new Date()): boolean =>
  now < PRICE_SWITCH_AT;

/** Amount in cents for Stripe, which takes no fractional units. */
export const toCents = (amount: number): number => Math.round(amount * 100);
