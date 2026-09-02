import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import marloesJson from './fixtures/marloes.nl.json';
import marloesCuration from './fixtures/marloes.nl.curation.json';
import emmaJson from './fixtures/emma.en.json';
import emmaCuration from './fixtures/emma.en.curation.json';
import { applyCuration, chooseFixture, personaForLanguage, type DemoPersonaId } from './loadFixture';
import type { DemoCuration, DemoFixture } from './types';

// The annotation text lives in the demo locale files, keyed by persona and
// curation key. A key without strings renders as raw "annotations.x.y.title"
// on the live page, so check both languages here.
const localeAnnotations = (lang: string, personaId: string) =>
  (
    JSON.parse(readFileSync(resolve(process.cwd(), `public/locales/${lang}/demo.json`), 'utf8'))
      .annotations as Record<string, Record<string, Record<string, string>>>
  )[personaId] ?? {};
const localePersona = (lang: string, personaId: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public/locales/${lang}/demo.json`), 'utf8'))
    .personas?.[personaId] as Record<string, string> | undefined;

const PERSONAS: Array<{
  id: DemoPersonaId;
  lang: string;
  fixture: DemoFixture;
  curation: DemoCuration;
}> = [
  { id: 'marloes', lang: 'nl', fixture: marloesJson as unknown as DemoFixture, curation: marloesCuration as DemoCuration },
  { id: 'emma', lang: 'en', fixture: emmaJson as unknown as DemoFixture, curation: emmaCuration as DemoCuration },
];

describe.each(PERSONAS)('demo fixture ($id, $lang)', ({ id, lang, fixture, curation }) => {
  it('is a complete, finished session', () => {
    expect(fixture.persona.language).toBe(lang);
    expect(fixture.persona.reportStatus).toBe('completed');
    expect(fixture.messages.length).toBeGreaterThan(20);
    expect(fixture.messages[0].sender).toBe('user');
    expect(fixture.savedMessageIds.length).toBeGreaterThan(0);
    // Everything the rich cards need: the three top careers with fit scores,
    // and comparisons on careers 2 and 3 (translated for a non-English
    // session; English is the canonical text, so nothing to translate).
    for (const type of ['top_career_1', 'top_career_2', 'top_career_3']) {
      const s = fixture.sections.find((x) => x.section_type === type);
      expect(s?.metadata?.fit_scores, type).toBeTruthy();
    }
    for (const type of ['top_career_2', 'top_career_3']) {
      const s = fixture.sections.find((x) => x.section_type === type)!;
      expect(s.metadata?.comparison?.explanation).toBeTruthy();
      if (lang !== 'en') expect(s.content_i18n?.[lang]?.comparison?.explanation).toBeTruthy();
    }
    expect(fixture.sections.some((s) => s.section_type === 'init_summary')).toBe(false);
    expect(fixture.sections.some((s) => s.section_type === 'chat_highlights')).toBe(true);
  });

  it('holds objects, not JSON strings, in the jsonb columns', () => {
    for (const s of fixture.sections) {
      expect(typeof s.metadata === 'object').toBe(true);
      expect(typeof s.content_i18n === 'object').toBe(true);
    }
    for (const m of fixture.messages) {
      expect(m.metadata === null || m.metadata === undefined || typeof m.metadata === 'object').toBe(true);
    }
  });

  it('every saved id and every annotation anchor exists in the transcript', () => {
    const ids = new Set(fixture.messages.map((m) => m.id));
    for (const msgId of fixture.savedMessageIds) expect(ids.has(msgId), `saved ${msgId}`).toBe(true);
    for (const a of curation.annotations ?? []) {
      expect(ids.has(a.messageId), `annotation ${a.key}`).toBe(true);
    }
    for (const msgId of curation.hiddenMessageIds ?? []) {
      expect(ids.has(msgId), `hidden ${msgId}`).toBe(true);
    }
  });

  it('has the turns the career-card pills jump to (Move pill, Ask about this role)', () => {
    // DemoReplay routes a Move-pill click to the persona's own feasibility
    // question and an "Ask about this role" click to her [Over …]/[About …]
    // turn. If a re-exported walkthrough lacks them, those pills would click
    // into nothing; better to know here than on the live page.
    const users = fixture.messages.filter((m) => m.sender === 'user');
    expect(users.some((m) => /^(hoe realistisch is de overstap|how realistic is the move)/i.test(m.content))).toBe(true);
    expect(users.some((m) => /^\[(over|about)\s+.+?\]/i.test(m.content))).toBe(true);
  });

  it('has the quick-reply labels the annotations point at', () => {
    const keys = new Set(fixture.messages.map((m) => m.metadata?.quick_reply).filter(Boolean));
    expect(keys.has('differently')).toBe(true);
    expect(keys.has('somethingElse')).toBe(true);
  });

  it('every annotation key has eyebrow, title, body and legend in nl and en', () => {
    const nl = localeAnnotations('nl', id);
    const en = localeAnnotations('en', id);
    expect((curation.annotations ?? []).length).toBeGreaterThan(0);
    for (const a of curation.annotations ?? []) {
      for (const field of ['eyebrow', 'title', 'body', 'legend']) {
        expect(nl[a.key]?.[field], `nl annotations.${id}.${a.key}.${field}`).toBeTruthy();
        expect(en[a.key]?.[field], `en annotations.${id}.${a.key}.${field}`).toBeTruthy();
      }
    }
    expect(localePersona('nl', id)?.tagline, `nl personas.${id}.tagline`).toBeTruthy();
    expect(localePersona('en', id)?.tagline, `en personas.${id}.tagline`).toBeTruthy();
  });

  it('applyCuration drops hidden turns and nothing else', () => {
    const [first, second] = fixture.messages;
    const curated = applyCuration(fixture, { hiddenMessageIds: [second.id] });
    expect(curated.messages.length).toBe(fixture.messages.length - 1);
    expect(curated.messages[0].id).toBe(first.id);
    expect(curated.messages.some((m) => m.id === second.id)).toBe(false);
    expect(applyCuration(fixture, {})).toBe(fixture);
  });
});

describe('chooseFixture', () => {
  it('serves Marloes to Dutch visitors and Emma to everyone else', () => {
    expect(chooseFixture('nl').personaId).toBe('marloes');
    expect(chooseFixture('nl-NL').personaId).toBe('marloes');
    expect(chooseFixture('en').personaId).toBe('emma');
    expect(chooseFixture('en-GB').personaId).toBe('emma');
    expect(chooseFixture(undefined).personaId).toBe('emma');
    expect(personaForLanguage('de')).toBe('emma');
  });

  it('flags the fallback only when the visitor language has no session of its own', () => {
    expect(chooseFixture('nl').isFallback).toBe(false);
    expect(chooseFixture('en').isFallback).toBe(false);
    expect(chooseFixture('de').isFallback).toBe(true);
    expect(chooseFixture('de').language).toBe('en');
    expect(chooseFixture('nl').firstName).toBe('Marloes');
    expect(chooseFixture('en').firstName).toBe('Emma');
  });
});
