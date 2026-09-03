// Which frozen session /demo shows, and the hand-written overlay on top.
import type { DemoCuration, DemoFixture, DemoTranslation } from './types';
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
  // Pass the visitor's UI language: when a translation of the session into
  // that language exists, it is overlaid (fixture.translatedTo is set).
  load: (uiLanguage?: string) => Promise<DemoFixture>;
  curation: DemoCuration;
  // Languages the persona's PDF exists in (public/demo/cairnly-demo-<id>-<lang>.pdf).
  pdfLanguages: string[];
}

interface PersonaEntry {
  language: string;
  firstName: string;
  load: () => Promise<DemoFixture>;
  curation: DemoCuration;
  // Demo-layer translations of the session, by target language.
  translations: Record<string, () => Promise<DemoTranslation>>;
  pdfLanguages: string[];
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
    translations: {
      en: () =>
        import('./fixtures/marcel.nl.messages.en.json').then((m) => m.default as unknown as DemoTranslation),
    },
    pdfLanguages: ['nl', 'en'],
  },
  emma: {
    language: 'en',
    firstName: 'Emma',
    load: () => import('./fixtures/emma.en.json').then((m) => m.default as unknown as DemoFixture),
    curation: emmaCuration as DemoCuration,
    translations: {
      nl: () =>
        import('./fixtures/emma.en.messages.nl.json').then((m) => m.default as unknown as DemoTranslation),
    },
    pdfLanguages: ['en', 'nl'],
  },
};

/**
 * Overlay a demo-layer translation on a fixture: every message the sidecar
 * knows gets its translated text; the Keep rows (whose content equals a
 * message's) follow; chat_highlights gets the translation as its
 * content_i18n entry for the target language, which is where the section
 * accessors already look. Messages the sidecar misses keep the original.
 */
export function applyTranslation(fixture: DemoFixture, translation: DemoTranslation): DemoFixture {
  const to = translation.meta.to;
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const byOriginal = new Map<string, string>();
  const messages = fixture.messages.map((m) => {
    const text = translation.messages[m.id];
    if (!text) return m;
    byOriginal.set(norm(m.content), text);
    return { ...m, content: text };
  });
  const savedResponses = fixture.savedResponses?.map((r) => {
    const text = byOriginal.get(norm(r.content));
    return text ? { ...r, content: text } : r;
  });
  const sections = fixture.sections.map((s) => {
    const t = translation.sections[s.section_type];
    if (!t) return s;
    const i18n = s.content_i18n && typeof s.content_i18n === 'object' ? s.content_i18n : {};
    return { ...s, content_i18n: { ...i18n, [to]: { ...(i18n[to] ?? {}), title: t.title, content: t.content } } };
  });
  return { ...fixture, translatedTo: to, messages, savedResponses, sections };
}

/** The language to serve a persona's PDF in: the UI language when that PDF exists, else the session's. */
export function demoPdfLanguage(personaId: DemoPersonaId, uiLanguage: string | undefined): string {
  const persona = PERSONAS[personaId];
  const short = (uiLanguage || persona.language).slice(0, 2).toLowerCase();
  return persona.pdfLanguages.includes(short) ? short : persona.language;
}

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
    load: async (uiLanguage?: string) => {
      const fixture = await persona.load();
      const ui = (uiLanguage || short).slice(0, 2).toLowerCase();
      const translation = ui !== persona.language ? persona.translations[ui] : undefined;
      return translation ? applyTranslation(fixture, await translation()) : fixture;
    },
    curation: persona.curation,
    pdfLanguages: persona.pdfLanguages,
  };
}

/** Drop the turns the curation file hides. Everything else passes through. */
export function applyCuration(fixture: DemoFixture, curation: DemoCuration): DemoFixture {
  const hidden = new Set(curation.hiddenMessageIds ?? []);
  if (hidden.size === 0) return fixture;
  return { ...fixture, messages: fixture.messages.filter((m) => !hidden.has(m.id)) };
}

/** The language a persona's session was held in (the homepage cards label it). */
export function demoSessionLanguage(personaId: DemoPersonaId): string {
  return PERSONAS[personaId].language;
}
