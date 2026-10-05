import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARTNER_TIERS, PILOT_CREDITS, buildPartnerOffer, tierFor } from './partnerOffer.ts';

/**
 * The offer card quotes prices from PARTNER_TIERS; /partners shows them from
 * the locale files. Two copies of one ladder, so this fails the moment they
 * disagree in either language.
 */
function pageRows(lang: 'en' | 'nl'): Array<{ min: number; max: number | null; price: number }> {
  const json = JSON.parse(readFileSync(resolve(process.cwd(), `public/locales/${lang}/partners.json`), 'utf8'));
  return (json.pricing.rows as Array<{ credits: string; price: string }>).map((row) => {
    const nums = (row.credits.match(/\d+/g) ?? []).map(Number);
    const price = Number(row.price.match(/\d+/)?.[0]);
    return { min: nums[0], max: nums.length > 1 ? nums[1] : null, price };
  });
}

describe('partner tiers match the /partners price rows', () => {
  it.each(['en', 'nl'] as const)('%s', (lang) => {
    expect(pageRows(lang)).toEqual(PARTNER_TIERS.map((t) => ({ ...t })));
  });

  it('the pilot copy says the same number of credits', () => {
    for (const lang of ['en', 'nl']) {
      const json = JSON.parse(readFileSync(resolve(process.cwd(), `public/locales/${lang}/partners.json`), 'utf8'));
      expect(json.pilot.bodyBeforeEmail).toContain(`${PILOT_CREDITS} credits`);
    }
  });
});

describe('tierFor', () => {
  it('finds the rung, including the open top', () => {
    expect(tierFor(1).price).toBe(44);
    expect(tierFor(9).price).toBe(44);
    expect(tierFor(10).price).toBe(38);
    expect(tierFor(100).price).toBe(24);
    expect(tierFor(5000).price).toBe(20);
  });
});

describe('buildPartnerOffer', () => {
  const base = { clientGroup: 'office', payment: 'fixed_fee', volume: '50_199', pilotSlotsLeft: 3 } as const;

  it('an agency with office clients at 50+ a year gets the pilot first', () => {
    const o = buildPartnerOffer(base);
    expect(o.kind).toBe('pilot');
    expect(o.primary).toBe('pilot_call');
    expect(o.secondary).toBe('free_credits');
    expect(o.tiers.map((t) => t.price)).toEqual([29, 24]);
    expect(o.example).toEqual({ credits: 100, total: 2400, perCredit: 24 });
    expect(o.passOn).toBeNull();
  });

  it('no pilot slots left means free credits first', () => {
    const o = buildPartnerOffer({ ...base, pilotSlotsLeft: 0 });
    expect(o.kind).toBe('credits');
    expect(o.primary).toBe('free_credits');
    expect(o.secondary).toBe('call');
  });

  it('under 50 a year gets free credits first, with the pass-on line', () => {
    const o = buildPartnerOffer({ clientGroup: 'office', payment: 'client_pays', volume: '10_49', pilotSlotsLeft: 3 });
    expect(o.kind).toBe('credits');
    expect(o.tiers.map((t) => t.price)).toEqual([38, 33]);
    expect(o.passOn).toEqual({ consumerPrice: 59, creditFrom: 33, creditTo: 38 });
    expect(o.example).toBeNull();
    expect(o.quietCall).toBe(false);
  });

  it('a solo under 10 a year gets the call as a quiet link', () => {
    const o = buildPartnerOffer({ clientGroup: 'mixed', payment: 'hourly', volume: 'lt10', pilotSlotsLeft: 3 });
    expect(o.fit).toBe('mixed');
    expect(o.quietCall).toBe(true);
    expect(o.tiers.map((t) => t.price)).toEqual([44]);
    expect(o.passOn).toEqual({ consumerPrice: 59, creditFrom: 44, creditTo: 44 });
  });

  it('healthcare, education or production clients get no offer', () => {
    const o = buildPartnerOffer({ ...base, clientGroup: 'not_fit' });
    expect(o.kind).toBe('none');
    expect(o.primary).toBeNull();
    expect(o.secondary).toBeNull();
  });

  it('a job seeker is sent to the consumer assessment', () => {
    expect(buildPartnerOffer({ ...base, jobSeeker: true }).kind).toBe('consumer');
  });

  it('unknown answers still give a sane credits offer', () => {
    const o = buildPartnerOffer({ clientGroup: null, payment: null, volume: null, pilotSlotsLeft: 3 });
    expect(o.kind).toBe('credits');
    expect(o.tiers.map((t) => t.price)).toEqual([44, 38]);
  });
});
