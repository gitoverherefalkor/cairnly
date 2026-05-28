/**
 * Pricing source of truth — keyed by currency.
 *
 * Stripe handles localized checkout (locale + currency are passed in create-checkout edge function).
 * This file is for *display* on the marketing site so the price the user sees matches what they'll pay.
 *
 * To change a price: edit here, then verify Stripe products mirror it.
 */

import i18n from "@/i18n";

export type Currency = "eur" | "usd";

export const PRICING: Record<Currency, { core: number; original: number }> = {
  eur: { core: 39, original: 79 },
  usd: { core: 39, original: 79 },
};

/** Pick currency from language (NL/DE → EUR, everything else → USD). */
export const currencyForLanguage = (lang: string): Currency => {
  if (lang.startsWith("nl") || lang.startsWith("de")) return "eur";
  return "usd";
};

/** Current pricing based on the active i18n language. */
export const getCurrentPricing = () => {
  const currency = currencyForLanguage(i18n.language);
  return { ...PRICING[currency], currency };
};
