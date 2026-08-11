import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COUNTDOWN_VISIBLE_DAYS,
  DISPLAY_CURRENCY,
  ENCORE_PRICE,
  PRICE_SWITCH_AT,
  PRO_PRICE_ANCHOR,
  PRO_PRICE_INTRO,
  PRO_PRICE_REGULAR,
  STARTER_PRICE,
  STARTER_PRICE_ANCHOR,
  getProPricing,
  introPriceTimeLeft,
  isIntroPriceActive,
  proPriceAt,
  shouldShowCountdown,
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
    ["PRO_PRICE_INTRO", PRO_PRICE_INTRO],
    ["PRO_PRICE_REGULAR", PRO_PRICE_REGULAR],
    ["PRO_PRICE_ANCHOR", PRO_PRICE_ANCHOR],
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

  it("switches at the same moment", () => {
    const match = EDGE_PRICING.match(/PRICE_SWITCH_AT = new Date\("([^"]+)"\)/);
    expect(match).not.toBeNull();
    expect(new Date(match![1]).getTime()).toBe(PRICE_SWITCH_AT.getTime());
  });
});

describe("the pro price flips on the switch date", () => {
  const dayBefore = new Date(PRICE_SWITCH_AT.getTime() - 1000);
  const theMoment = new Date(PRICE_SWITCH_AT.getTime());
  const dayAfter = new Date(PRICE_SWITCH_AT.getTime() + 24 * 60 * 60 * 1000);

  it("charges the intro price right up to the deadline", () => {
    expect(proPriceAt(dayBefore)).toBe(39);
    expect(isIntroPriceActive(dayBefore)).toBe(true);
  });

  it("charges the regular price from the deadline onwards", () => {
    expect(proPriceAt(theMoment)).toBe(59);
    expect(proPriceAt(dayAfter)).toBe(59);
    expect(isIntroPriceActive(theMoment)).toBe(false);
  });

  it("drops the strike-through anchor once the intro price ends", () => {
    expect(getProPricing(dayBefore).anchor).toBe(69);
    expect(getProPricing(dayAfter).anchor).toBeNull();
  });

  it("keeps the deadline in Amsterdam time", () => {
    // 15 Oct 2026 00:00 CEST is 14 Oct 22:00 UTC. If summer time were applied
    // wrongly this would land an hour off and the price would flip early.
    expect(PRICE_SWITCH_AT.toISOString()).toBe("2026-10-14T22:00:00.000Z");
  });
});

describe("the countdown only runs in its window", () => {
  const daysBefore = (n: number) =>
    new Date(PRICE_SWITCH_AT.getTime() - n * 24 * 60 * 60 * 1000);

  it("stays hidden while the deadline is far away", () => {
    expect(shouldShowCountdown(daysBefore(COUNTDOWN_VISIBLE_DAYS + 1))).toBe(false);
  });

  it("appears inside the visible window", () => {
    expect(shouldShowCountdown(daysBefore(COUNTDOWN_VISIBLE_DAYS - 1))).toBe(true);
    expect(shouldShowCountdown(daysBefore(1))).toBe(true);
  });

  it("disappears once the deadline passes", () => {
    expect(shouldShowCountdown(new Date(PRICE_SWITCH_AT.getTime()))).toBe(false);
    expect(introPriceTimeLeft(new Date(PRICE_SWITCH_AT.getTime()))).toBeNull();
  });

  it("reports whole days and hours left", () => {
    const now = new Date(PRICE_SWITCH_AT.getTime() - (6 * 24 + 14) * 60 * 60 * 1000);
    expect(introPriceTimeLeft(now)).toEqual({ days: 6, hours: 14 });
  });
});
