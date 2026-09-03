// Which frozen session /demo shows, and the hand-written overlay on top.
import type { DemoCuration, DemoFixture } from './types';
import marcelCuration from './fixtures/marcel.nl.curation.json';
import emmaCuration from './fixtures/emma.en.curation.json';

export type DemoPersonaId = 'marcel' | 'emma';

export interface DemoFixtureChoice {
  personaId: DemoPersonaId;
  // Language of the conversation in the fixture.
  language: string;
  // The persona's first name, for the sentences around the transcript
  // ("This is the conversation as Emma had it"). Known before the lazy
  // fixture chunk arrives, so the intro never renders with a blank.
  firstName: string;
  // True when the visitor's language has no persona of its own and gets
  // another language's session with a note.
  isFallback: boolean;
  // The transcript is ~180 KB, so it is a lazy chunk of its own: only the
  // demo page pays for it, and only once the page is actually opened.
  load: () => Promise<DemoFixture>;
  curation: DemoCuration;
}

interface PersonaEntry {
  language: string;
  firstName: string;
  load: () => Promise<DemoFixture>;
  curation: DemoCuration;
}

/**
 * One persona per site language (docs/handoff/demo-replay-plan.md):
 * Marcel for Dutch visitors, Emma for English ones. Adding a persona = a
 * new fixture pair (json + curation.json), an entry here, and its strings
 * under `personas.<id>` and `annotations.<id>` in both demo locale files.
 */
const PERSONAS: Record<DemoPersonaId, PersonaEntry> = {
  marcel: {
    language: 'nl',
    firstName: 'Marcel',
    load: () =>
      import('./fixtures/marcel.nl.json').then((m) => m.default as unknown as DemoFixture),
    curation: marcelCuration as DemoCuration,
  },
  emma: {
    language: 'en',
    firstName: 'Emma',
    load: () => import('./fixtures/emma.en.json').then((m) => m.default as unknown as DemoFixture),
    curation: emmaCuration as DemoCuration,
  },
};

/** The persona whose session was held in this language, else the English one. */
export function personaForLanguage(lang: string | undefined): DemoPersonaId {
  const short = (lang || 'en').slice(0, 2).toLowerCase();
  const hit = (Object.keys(PERSONAS) as DemoPersonaId[]).find((id) => PERSONAS[id].language === short);
  return hit ?? 'emma';
}

/** True for the persona ids the demo knows; anything else is ignored. */
export function isDemoPersonaId(value: unknown): value is DemoPersonaId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PERSONAS, value);
}

/**
 * The persona to show. `personaOverride` (the `?persona=` parameter the
 * homepage entry points set) wins over the language pick, so a Dutch
 * visitor can read Emma's session and an English one Marcel's; the
 * fallback note then says the conversation is in the other language.
 */
export function chooseFixture(lang: string | undefined, personaOverride?: string | null): DemoFixtureChoice {
  const short = (lang || 'en').slice(0, 2).toLowerCase();
  const personaId = isDemoPersonaId(personaOverride) ? personaOverride : personaForLanguage(short);
  const persona = PERSONAS[personaId];
  return {
    personaId,
    language: persona.language,
    firstName: persona.firstName,
    isFallback: short !== persona.language,
    load: persona.load,
    curation: persona.curation,
  };
}

/** Drop the turns the curation file hides. Everything else passes through. */
export function applyCuration(fixture: DemoFixture, curation: DemoCuration): DemoFixture {
  const hidden = new Set(curation.hiddenMessageIds ?? []);
  if (hidden.size === 0) return fixture;
  return { ...fixture, messages: fixture.messages.filter((m) => !hidden.has(m.id)) };
}
