import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DISPLAY_CURRENCY,
  ENCORE_PRICE,
  PRO_PRICE,
  STARTER_PRICE,
  STARTER_PRICE_ANCHOR,
  getProPricing,
} from "./pricing";

/**
 * The browser and the edge functions run in different runtimes and cannot share
 * a module, so the pricing constants exist twice. These tests read the edge
 * function copy — the one that actually charges the card — and fail if the two
 * ever disagree. Without this, the site can advertise one price while Stripe
 * charges another, and nothing would catch it.
 */
const EDGE_PRICING = readFileSync(
  resolve(process.cwd(), "supabase/functions/_shared/pricing.ts"),
  "utf8"
);

const edgeNumber = (name: string): number => {
  const match = EDGE_PRICING.match(new RegExp(`export const ${name} = (\\d+)`));
  if (!match) throw new Error(`${name} not found in the edge function pricing file`);
  return Number(match[1]);
};

describe("pricing stays in sync with the edge function", () => {
  it.each([
    ["PRO_PRICE", PRO_PRICE],
    ["STARTER_PRICE", STARTER_PRICE],
    ["STARTER_PRICE_ANCHOR", STARTER_PRICE_ANCHOR],
    ["ENCORE_PRICE", ENCORE_PRICE],
  ])("%s matches", (name, frontendValue) => {
    expect(edgeNumber(name)).toBe(frontendValue);
  });

  it("displays the currency the checkout actually charges", () => {
    // create-checkout hardcodes `currency: "eur"` on every Stripe session. If
    // the site ever advertises another currency, buyers see one price and get
    // billed in another.
    const checkout = readFileSync(
      resolve(process.cwd(), "supabase/functions/create-checkout/index.ts"),
      "utf8"
    );
    expect(checkout).toContain('currency: "eur"');
    expect(DISPLAY_CURRENCY).toBe("EUR");
  });
});

describe("the pro assessment is a single flat price", () => {
  it("charges 59 euros", () => {
    expect(PRO_PRICE).toBe(59);
    expect(getProPricing().core).toBe(59);
  });

  /**
   * The €39 introductory price was retired on 2026-09-16. Nothing may quote a
   * struck-through "was" price for the pro assessment: with no higher price
   * ever charged, an anchor would be an invented discount.
   */
  it("exposes no strike-through anchor", () => {
    expect(getProPricing()).not.toHaveProperty("anchor");
  });

  it("leaves no intro-price machinery behind in either copy", () => {
    const frontend = readFileSync(resolve(process.cwd(), "src/lib/pricing.ts"), "utf8");
    for (const gone of [
      "PRO_PRICE_INTRO",
      "PRO_PRICE_ANCHOR",
      "PRICE_SWITCH_AT",
      "isIntroPriceActive",
      "introPriceTimeLeft",
    ]) {
      expect(frontend).not.toContain(`export const ${gone}`);
      expect(EDGE_PRICING).not.toContain(`export const ${gone}`);
    }
  });
});

describe("the other flavors are untouched by the pro price", () => {
  it("keeps starter at its own price and anchor", () => {
    expect(STARTER_PRICE).toBe(39);
    expect(STARTER_PRICE_ANCHOR).toBe(79);
  });

  it("keeps encore at its own price", () => {
    expect(ENCORE_PRICE).toBe(79);
  });
});
