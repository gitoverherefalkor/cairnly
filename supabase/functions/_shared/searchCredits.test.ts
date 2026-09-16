import { describe, it, expect } from 'vitest';
import { decideSearchCharge, FREE_SEARCH_LIMIT } from './searchCredits';

describe('decideSearchCharge', () => {
  it('serves a cache hit without charging, even at the limit', () => {
    const d = decideSearchCharge({ cacheHit: true, unlimited: false, chargedCount: FREE_SEARCH_LIMIT });
    expect(d).toEqual({ allow: true, charge: false, log: 'cached' });
  });

  it('serves a cache hit without charging for an unlimited user', () => {
    const d = decideSearchCharge({ cacheHit: true, unlimited: true, chargedCount: 0 });
    expect(d).toEqual({ allow: true, charge: false, log: 'cached' });
  });

  it('charges an unlimited user but never blocks them', () => {
    const d = decideSearchCharge({ cacheHit: false, unlimited: true, chargedCount: 999 });
    expect(d).toEqual({ allow: true, charge: true, log: 'charged' });
  });

  it('charges a free-tier user below the limit', () => {
    const d = decideSearchCharge({ cacheHit: false, unlimited: false, chargedCount: 0 });
    expect(d).toEqual({ allow: true, charge: true, log: 'charged' });
  });

  it('allows the very last free search', () => {
    const d = decideSearchCharge({
      cacheHit: false, unlimited: false, chargedCount: FREE_SEARCH_LIMIT - 1,
    });
    expect(d.allow).toBe(true);
    expect(d.charge).toBe(true);
  });

  it('blocks a free-tier user who has used the limit', () => {
    const d = decideSearchCharge({
      cacheHit: false, unlimited: false, chargedCount: FREE_SEARCH_LIMIT,
    });
    expect(d).toEqual({ allow: false, charge: false, log: null });
  });

  it('blocks a free-tier user somehow over the limit', () => {
    const d = decideSearchCharge({
      cacheHit: false, unlimited: false, chargedCount: FREE_SEARCH_LIMIT + 3,
    });
    expect(d.allow).toBe(false);
  });

  it('has a free limit of 4', () => {
    expect(FREE_SEARCH_LIMIT).toBe(4);
  });
});
