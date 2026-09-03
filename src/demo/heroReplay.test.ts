import { describe, expect, it } from 'vitest';
import emma from './fixtures/emma.en.json';
import marcel from './fixtures/marcel.nl.json';
import { HERO_REPLAY, excerptText } from './heroReplay';
import type { DemoFixture } from './types';

const FIXTURES: Record<string, DemoFixture> = {
  emma: emma as unknown as DemoFixture,
  marcel: marcel as unknown as DemoFixture,
};

describe('HERO_REPLAY', () => {
  for (const [persona, ids] of Object.entries(HERO_REPLAY)) {
    it(`${persona}: every id exists in the fixture, opens with the visitor and alternates`, () => {
      const byId = new Map(FIXTURES[persona].messages.map((m) => [m.id, m]));
      const senders = ids.map((id) => {
        const m = byId.get(id);
        expect(m, `${persona} ${id} missing from fixture`).toBeDefined();
        return m!.sender;
      });
      expect(senders[0]).toBe('user');
      senders.forEach((s, i) => {
        if (i > 0) expect(s, `position ${i} repeats the sender`).not.toBe(senders[i - 1]);
      });
      expect(ids.length).toBeGreaterThanOrEqual(4);
    });
  }
});

describe('excerptText', () => {
  it('keeps only the first paragraph and strips markdown', () => {
    const text = "Let's talk about your **strengths** - what sets you apart.\n\n---\n\n### Strengths\n\nBody";
    expect(excerptText(text)).toBe("Let's talk about your strengths - what sets you apart.");
  });

  it('cuts on a word boundary with an ellipsis', () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const out = excerptText(long, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith('…')).toBe(true);
    expect(out.slice(0, -1)).toMatch(/word\d+$/);
  });

  it('leaves short text alone', () => {
    expect(excerptText('hmm, maybe.')).toBe('hmm, maybe.');
  });
});
