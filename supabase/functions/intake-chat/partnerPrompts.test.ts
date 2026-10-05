import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PARTNER_INTENTS,
  PARTNER_INTENT_LABELS,
  PARTNER_OPENER_REPLIES,
  partnerBeatsFor,
  chipAnswers,
  matchChip,
  hasContrast,
} from './partnerPrompts.ts';

const locale = (lang: 'en' | 'nl') =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public/locales/${lang}/partners.json`), 'utf8'));

describe('partner starters', () => {
  // The server gives the instant canned reply only when the text equals the
  // starter line exactly. If the page's seed drifts from the server's, every
  // unedited starter quietly costs a live model call instead.
  it.each(['en', 'nl'] as const)('the %s seed lines on the page match the server', (lang) => {
    const seeds = locale(lang).prechat.seeds;
    for (const intent of PARTNER_INTENTS) {
      expect(seeds[intent]).toBe(PARTNER_INTENT_LABELS[lang][intent]);
    }
  });

  it('every starter has a canned reply in both languages, with no em-dashes', () => {
    for (const lang of ['en', 'nl'] as const) {
      for (const intent of PARTNER_INTENTS) {
        const reply = PARTNER_OPENER_REPLIES[lang][intent as Exclude<typeof intent, 'other'>];
        expect(reply).toBeTruthy();
        expect(reply).not.toContain('—');
        // "about 45 minutes" (decided 2026-10-05), never the old 25 to 40.
        if (intent === 'clients-blank') expect(reply).toContain('45');
      }
    }
  });
});

describe('plans', () => {
  it('two starters skip the question their reply already asked', () => {
    expect(partnerBeatsFor('clients-blank').map((b) => b.key)).toEqual(['clients', 'payment', 'volume']);
    expect(partnerBeatsFor('shorter').map((b) => b.key)).toEqual(['payment', 'clients', 'volume']);
    expect(partnerBeatsFor('validated').map((b) => b.key)).toEqual(['practice', 'clients', 'payment', 'volume']);
    expect(partnerBeatsFor('other')).toHaveLength(4);
  });
});

describe('chip answers', () => {
  it('maps tapped chips in either language', () => {
    expect(matchChip('volume', '50 to 199')).toBe('50_199');
    expect(matchChip('volume', '10 t/m 49')).toBe('10_49');
    expect(matchChip('clients', 'Vooral zorg, onderwijs of productie')).toBe('not_fit');
    expect(matchChip('payment', 'about 120 a year')).toBeNull();
  });

  it('reads answers off the transcript by position', () => {
    // shorter: opener, then payment, clients, volume
    const a = chipAnswers('shorter', [
      'I want shorter trajectories without losing quality.',
      'Fixed fee, the employer pays as part of the settlement.',
      'Office or knowledge work',
      '50 to 199',
    ]);
    expect(a).toEqual({ clientGroup: 'office', payment: null, volume: '50_199' });
  });
});

describe('contrast check', () => {
  it.each([
    'gives session one concrete careers to react to, not a search.',
    'jouw gesprek gaat over keuzes, niet over uitleg.',
    'de matchscore is een gespreksstarter, geen meting.',
    'clients start from a list instead of a blank page.',
    'niet op onderbuik alleen',
    'het is niet een test maar een oriëntatie',
  ])('flags %s', (t) => expect(hasContrast(t)).toBe(true));

  it.each([
    'Your client arrives having already challenged what felt wrong.',
    'Cairnly is geen psychometrisch instrument en geen COTAN-beoordeelde test.',
    'Credits die nooit verlopen: je koopt per volume in.',
    'Three free credits below, so you can run it on yourself first.',
  ])('leaves %s alone', (t) => expect(hasContrast(t)).toBe(false));
});
