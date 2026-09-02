// Which frozen session /demo shows, and the hand-written overlay on top.
import type { DemoCuration, DemoFixture } from './types';
import marloesCuration from './fixtures/marloes.nl.curation.json';

export type DemoPersonaId = 'marloes';

export interface DemoFixtureChoice {
  personaId: DemoPersonaId;
  // Language of the conversation in the fixture.
  language: string;
  // True when the visitor's language has no persona of its own yet and gets
  // another language's session with a note.
  isFallback: boolean;
  // The transcript is ~180 KB, so it is a lazy chunk of its own: only the
  // demo page pays for it, and only once the page is actually opened.
  load: () => Promise<DemoFixture>;
  curation: DemoCuration;
}

/**
 * Phase 1: one persona, Marloes (Dutch). English visitors see her session
 * with a "this demo is in Dutch" note until the English persona (phase 2 in
 * docs/handoff/demo-replay-plan.md) exists. Adding a persona = a new fixture
 * pair (json + curation.json) and a branch here.
 */
export function chooseFixture(lang: string | undefined): DemoFixtureChoice {
  const short = (lang || 'en').slice(0, 2).toLowerCase();
  return {
    personaId: 'marloes',
    language: 'nl',
    isFallback: short !== 'nl',
    load: () =>
      import('./fixtures/marloes.nl.json').then(
        (m) => m.default as unknown as DemoFixture,
      ),
    curation: marloesCuration as DemoCuration,
  };
}

/** Drop the turns the curation file hides. Everything else passes through. */
export function applyCuration(fixture: DemoFixture, curation: DemoCuration): DemoFixture {
  const hidden = new Set(curation.hiddenMessageIds ?? []);
  if (hidden.size === 0) return fixture;
  return { ...fixture, messages: fixture.messages.filter((m) => !hidden.has(m.id)) };
}
