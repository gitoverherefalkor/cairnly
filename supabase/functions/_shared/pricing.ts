/**
 * Pricing source of truth for the edge functions.
 *
 * Everything that charges or quotes a price derives it from here, so the
 * checkout, the receipt and the intake chat can never disagree about what the
 * assessment costs.
 *
 * ⚠️ src/lib/pricing.ts mirrors these values for the browser — Vite and Deno
 * cannot import from the same module. src/lib/pricing.test.ts reads this file
 * and fails if the two drift apart. Change a number here, change it there too.
 */

/**
 * Pro assessment (cairnly.io). One price, no introductory rate and no
 * strike-through anchor: the €39 intro price and its 15 October 2026 deadline
 * were retired on 2026-09-16, along with the countdown that announced them.
 */
export const PRO_PRICE = 59;

/**
 * Starter (cairnly.io/starter) is priced on its own — starters on the job
 * market carry less budget.
 */
export const STARTER_PRICE = 39;
export const STARTER_PRICE_ANCHOR = 79;

/** Encore (cairnly.io/encore) has always been priced on its own, no anchor. */
export const ENCORE_PRICE = 79;

/** Amount in cents for Stripe, which takes no fractional units. */
export const toCents = (amount: number): number => Math.round(amount * 100);
