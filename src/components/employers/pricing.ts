/**
 * Every price /employers states, in one place, in both currencies.
 *
 * UK visitors see pounds, everyone else euros (useEmployerCurrency). The copy
 * in public/locales/{en,nl}/employers.json only holds {{placeholders}}; the
 * numbers come from here, so the hero pill, the comparison rows, the pricing
 * line, the worked examples and the tier table cannot drift apart.
 *
 * Per person, ex VAT. GBP tiers approved by Sjoerd on 2026-10-16. The /partners
 * ladder (public/locales/{en,nl}/partners.json) stays euro-only on purpose:
 * that page sells to Dutch bureaus. Change a euro tier here, change it there.
 *
 * Nothing here is charged: employer seats are invoiced by hand. These numbers
 * are what the invoice will say.
 */

export type EmployerCurrency = 'EUR' | 'GBP';

export interface EmployerTier {
  /** Smallest group this price applies to. */
  min: number;
  /** Largest group, or null for "and up". */
  max: number | null;
  price: Record<EmployerCurrency, number>;
}

export const EMPLOYER_TIERS: readonly EmployerTier[] = [
  { min: 1, max: 9, price: { EUR: 44, GBP: 39 } },
  { min: 10, max: 24, price: { EUR: 38, GBP: 33 } },
  { min: 25, max: 49, price: { EUR: 33, GBP: 29 } },
  { min: 50, max: 99, price: { EUR: 29, GBP: 25 } },
  { min: 100, max: 249, price: { EUR: 24, GBP: 21 } },
  { min: 250, max: null, price: { EUR: 20, GBP: 17 } },
];

/**
 * What the buyer pays elsewhere, per person (comparison rows). The pound
 * figures are the euro ones at about 0.85, rounded to a clean step: market
 * ranges, not quotes, so they don't need to track the exchange rate.
 */
export const ALTERNATIVE_COSTS: Record<'coach' | 'outplacement', Record<EmployerCurrency, [number, number]>> = {
  coach: { EUR: [500, 2750], GBP: [425, 2350] },
  outplacement: { EUR: [3000, 6000], GBP: [2550, 5100] },
};

/** The two worked examples under the pricing line. */
export const EXAMPLE_TEAM_SIZE = 40;
export const EXAMPLE_COMPANY_SIZE = 250;

const SYMBOL: Record<EmployerCurrency, string> = { EUR: '€', GBP: '£' };

/**
 * "€1,320" / "€1.320" / "£1,160": symbol straight before the number, grouped
 * the page language's way. Not Intl's currency style, which puts a space after
 * the symbol in Dutch ("€ 1.320") and would change how the page has always read.
 */
export function formatMoney(amount: number, currency: EmployerCurrency, lang: string): string {
  const grouped = new Intl.NumberFormat(lang.startsWith('nl') ? 'nl-NL' : 'en-GB', { maximumFractionDigits: 0 }).format(amount);
  return `${SYMBOL[currency]}${grouped}`;
}

/** Price per person for a group of `n`. */
export function priceFor(n: number, currency: EmployerCurrency): number {
  const tier = EMPLOYER_TIERS.find((t) => n >= t.min && (t.max === null || n <= t.max)) ?? EMPLOYER_TIERS[0];
  return tier.price[currency];
}

export const lowestPrice = (c: EmployerCurrency) => EMPLOYER_TIERS[EMPLOYER_TIERS.length - 1].price[c];
export const highestPrice = (c: EmployerCurrency) => EMPLOYER_TIERS[0].price[c];
/** Group size where the lowest price starts (250). */
export const lowestPriceFrom = () => EMPLOYER_TIERS[EMPLOYER_TIERS.length - 1].min;

/**
 * Which currency to show. An explicit ?currency=gbp|eur wins (outreach links
 * to UK companies pin pounds, and it makes testing easy), then the visitor's
 * country: GB is pounds, anything else or unknown is euros.
 */
export function pickCurrency(urlParam: string | null | undefined, country: string | null | undefined): EmployerCurrency {
  const forced = (urlParam ?? '').trim().toLowerCase();
  if (forced === 'gbp') return 'GBP';
  if (forced === 'eur') return 'EUR';
  return country === 'GB' ? 'GBP' : 'EUR';
}

/** Every value the employers copy interpolates, for one currency and language. */
export function priceVars(currency: EmployerCurrency, lang: string, range: (from: string, to: string) => string) {
  const m = (n: number) => formatMoney(n, currency, lang);
  const [coachLo, coachHi] = ALTERNATIVE_COSTS.coach[currency];
  const [outLo, outHi] = ALTERNATIVE_COSTS.outplacement[currency];
  const teamPrice = priceFor(EXAMPLE_TEAM_SIZE, currency);
  const companyPrice = priceFor(EXAMPLE_COMPANY_SIZE, currency);
  return {
    minPrice: m(lowestPrice(currency)),
    maxPrice: m(highestPrice(currency)),
    minPriceFrom: lowestPriceFrom(),
    coachRange: range(m(coachLo), m(coachHi)),
    outplacementRange: range(m(outLo), m(outHi)),
    cairnlyRange: range(m(lowestPrice(currency)), m(highestPrice(currency))),
    teamSize: EXAMPLE_TEAM_SIZE,
    teamPrice: m(teamPrice),
    teamTotal: m(teamPrice * EXAMPLE_TEAM_SIZE),
    companySize: EXAMPLE_COMPANY_SIZE,
    companyTotal: m(companyPrice * EXAMPLE_COMPANY_SIZE),
  };
}
