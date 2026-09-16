/**
 * Pricing source of truth for the marketing site.
 *
 * Stripe handles localized checkout (locale + currency are passed in the
 * create-checkout edge function). This file is for *display*, so the price the
 * user sees matches what they'll pay.
 *
 * ⚠️ The constants below mirror supabase/functions/_shared/pricing.ts, which is
 * what actually charges the card. Vite and Deno cannot import from the same
 * module, so the values live in two places and pricing.test.ts fails the build
 * if they drift apart. Change a number here, change it there too.
 */

/**
 * Every flavor is charged in euros — create-checkout hardcodes
 * `currency: "eur"` on the Stripe session regardless of the buyer's language.
 * Display therefore follows the charge: an English visitor seeing "$59" and
 * then being billed €59 at Stripe is a mismatch at the worst possible moment.
 */
export const DISPLAY_CURRENCY = "EUR";

/**
 * Pro assessment (cairnly.io). One price, no introductory rate and no
 * strike-through anchor: the €39 intro price and its 15 October 2026 deadline
 * were retired on 2026-09-16, along with the countdown that announced them
 * (src/unused/landing/PriceCountdown.tsx).
 */
export const PRO_PRICE = 59;

/** Starter keeps its own price — it is not part of the pro assessment. */
export const STARTER_PRICE = 39;
export const STARTER_PRICE_ANCHOR = 79;

/** Encore has always been priced on its own, with no strike-through anchor. */
export const ENCORE_PRICE = 79;

/** Display pricing for the pro assessment. */
export const getProPricing = () => ({
  currency: DISPLAY_CURRENCY,
  core: PRO_PRICE,
});

/** Display pricing for the starter flavor. */
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
