import { describe, it, expect } from 'vitest';
import { compareProspects, isWarm, type OutreachProspect } from './outreach';

const base: OutreachProspect = {
  slug: 'x',
  naam: 'X',
  tier: 'B',
  categorie: 'DO',
  contactpersoon: null,
  plaats: null,
  campaign: 'bureaus-sep26',
  to_email: null,
  status: 'nog_niet_benaderd',
  notities: null,
  updated_at: '2026-09-09T10:00:00Z',
  kliks_totaal: 0,
  kliks_uniek_dagen: 0,
  eerste_klik: null,
  laatste_klik: null,
  bot_kliks: 0,
};

const make = (over: Partial<OutreachProspect>): OutreachProspect => ({ ...base, ...over });

describe('isWarm', () => {
  it('needs a real click and an early status', () => {
    expect(isWarm(make({ kliks_totaal: 1, status: 'verzonden' }))).toBe(true);
    expect(isWarm(make({ kliks_totaal: 1, status: 'nog_niet_benaderd' }))).toBe(true);
    expect(isWarm(make({ kliks_totaal: 1, status: 'gesprek_gepland' }))).toBe(false);
    expect(isWarm(make({ kliks_totaal: 0, status: 'verzonden' }))).toBe(false);
  });
});

describe('compareProspects', () => {
  it('puts warm rows first, then latest click, then tier, then name', () => {
    const rows = [
      make({ slug: 'a-noclick', naam: 'Alpha', tier: 'A' }),
      make({ slug: 'c-noclick', naam: 'Charlie', tier: 'C' }),
      make({ slug: 'followed-up', naam: 'Followed', tier: 'C', status: 'gesprek_gepland', kliks_totaal: 3, laatste_klik: '2026-09-09T09:00:00Z' }),
      make({ slug: 'warm-old', naam: 'Warm old', tier: 'B', status: 'verzonden', kliks_totaal: 1, laatste_klik: '2026-09-07T09:00:00Z' }),
      make({ slug: 'warm-new', naam: 'Warm new', tier: 'C', status: 'verzonden', kliks_totaal: 1, laatste_klik: '2026-09-08T09:00:00Z' }),
      make({ slug: 'b-noclick', naam: 'Bravo', tier: 'B' }),
    ];
    const order = [...rows].sort(compareProspects).map((r) => r.slug);
    expect(order).toEqual(['warm-new', 'warm-old', 'followed-up', 'a-noclick', 'b-noclick', 'c-noclick']);
  });

  it('bot-only clicks do not make a row warm', () => {
    const botOnly = make({ slug: 'bots', status: 'verzonden', kliks_totaal: 0, bot_kliks: 4 });
    const quiet = make({ slug: 'quiet', tier: 'A' });
    expect([botOnly, quiet].sort(compareProspects).map((r) => r.slug)).toEqual(['quiet', 'bots']);
  });
});
