import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EMPLOYER_TIERS, formatMoney, pickCurrency, priceFor, priceVars, type EmployerCurrency,
} from './pricing';

const range = (sep: string) => (from: string, to: string) => `${from} ${sep} ${to}`;
const locale = (lang: string, ns: string) => JSON.parse(readFileSync(`public/locales/${lang}/${ns}.json`, 'utf8'));

describe('currency choice', () => {
  it('pins by URL, else pounds for GB only', () => {
    expect(pickCurrency('gbp', 'NL')).toBe('GBP');
    expect(pickCurrency('EUR', 'GB')).toBe('EUR');
    expect(pickCurrency(null, 'GB')).toBe('GBP');
    expect(pickCurrency(null, 'IE')).toBe('EUR');
    expect(pickCurrency(null, null)).toBe('EUR');
    expect(pickCurrency('usd', 'GB')).toBe('GBP');
  });
});

describe('formatting', () => {
  it('puts the symbol straight before the number, grouped per language', () => {
    expect(formatMoney(1320, 'EUR', 'en')).toBe('€1,320');
    expect(formatMoney(1320, 'EUR', 'nl')).toBe('€1.320');
    expect(formatMoney(4250, 'GBP', 'en')).toBe('£4,250');
  });
});

describe('tiers', () => {
  it('are the approved prices', () => {
    expect(EMPLOYER_TIERS.map((t) => t.price.EUR)).toEqual([44, 38, 33, 29, 24, 20]);
    expect(EMPLOYER_TIERS.map((t) => t.price.GBP)).toEqual([39, 33, 29, 25, 21, 17]);
    expect(priceFor(40, 'EUR')).toBe(33);
    expect(priceFor(250, 'GBP')).toBe(17);
    expect(priceFor(9, 'EUR')).toBe(44);
  });

  it('match the euro ladder on /partners', () => {
    for (const lang of ['en', 'nl']) {
      const rows = locale(lang, 'partners').pricing.rows as { price: string }[];
      expect(rows.map((r) => Number(r.price.replace(/\D/g, '')))).toEqual(EMPLOYER_TIERS.map((t) => t.price.EUR));
    }
  });
});

describe('page values', () => {
  const vars = (c: EmployerCurrency, lang: string) => priceVars(c, lang, range(lang === 'nl' ? 'tot' : 'to'));

  it('are what the page said before, in euros', () => {
    const en = vars('EUR', 'en');
    expect(en.minPrice).toBe('€20');
    expect(en.coachRange).toBe('€500 to €2,750');
    expect(en.outplacementRange).toBe('€3,000 to €6,000');
    expect(en.cairnlyRange).toBe('€20 to €44');
    expect([en.teamPrice, en.teamTotal, en.companyTotal]).toEqual(['€33', '€1,320', '€5,000']);
    expect(vars('EUR', 'nl').outplacementRange).toBe('€3.000 tot €6.000');
  });

  it('add up in pounds', () => {
    const gb = vars('GBP', 'en');
    expect(gb.cairnlyRange).toBe('£17 to £39');
    expect([gb.teamPrice, gb.teamTotal, gb.companyTotal]).toEqual(['£29', '£1,160', '£4,250']);
  });
});

describe('copy', () => {
  it('states no hard-coded Cairnly price on /employers', () => {
    for (const lang of ['en', 'nl']) {
      const e = locale(lang, 'employers');
      const priced = [...e.hero.pills, ...e.pricing.compare.map((r: { price: string }) => r.price), e.pricing.pricingBody, e.pricing.examples];
      for (const s of priced) expect(s).not.toMatch(/[€£]\s?\d|\d+\s?euro/);
      expect(e.pricing.range).toContain('{{from}}');
      expect(e.pricing.tierRange).toContain('{{max}}');
      expect(e.pricing.tierFrom).toContain('{{min}}');
    }
  });
});
