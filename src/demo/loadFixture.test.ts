import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtureJson from './fixtures/marloes.nl.json';
import curation from './fixtures/marloes.nl.curation.json';
import { applyCuration, chooseFixture } from './loadFixture';
import type { DemoCuration, DemoFixture } from './types';

const fixture = fixtureJson as unknown as DemoFixture;

// The annotation text lives in the demo locale files, keyed by the curation
// key. A key without strings renders as raw "annotations.x.title" on the
// live page, so check both languages here.
const localeAnnotations = (lang: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), `public/locales/${lang}/demo.json`), 'utf8'),
  ).annotations as Record<string, Record<string, string>>;

describe('demo fixture (Marloes, nl)', () => {
  it('is a complete, finished session', () => {
    expect(fixture.persona.language).toBe('nl');
    expect(fixture.persona.reportStatus).toBe('completed');
    expect(fixture.messages.length).toBeGreaterThan(20);
    expect(fixture.messages[0].sender).toBe('user');
    expect(fixture.savedMessageIds.length).toBeGreaterThan(0);
    // Everything the rich cards need: the three top careers with fit scores,
    // and comparisons (with Dutch text) on careers 2 and 3.
    for (const type of ['top_career_1', 'top_career_2', 'top_career_3']) {
      const s = fixture.sections.find((x) => x.section_type === type);
      expect(s?.metadata?.fit_scores, type).toBeTruthy();
    }
    for (const type of ['top_career_2', 'top_career_3']) {
      const s = fixture.sections.find((x) => x.section_type === type)!;
      expect(s.metadata?.comparison?.explanation).toBeTruthy();
      expect(s.content_i18n?.nl?.comparison?.explanation).toBeTruthy();
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
    for (const id of fixture.savedMessageIds) expect(ids.has(id), `saved ${id}`).toBe(true);
    for (const a of (curation as DemoCuration).annotations ?? []) {
      expect(ids.has(a.messageId), `annotation ${a.key}`).toBe(true);
    }
    for (const id of (curation as DemoCuration).hiddenMessageIds ?? []) {
      expect(ids.has(id), `hidden ${id}`).toBe(true);
    }
  });

  it('has the turns the career-card pills jump to (Move pill, Ask about this role)', () => {
    // DemoReplay routes a Move-pill click to the persona's own feasibility
    // question and an "Ask about this role" click to her [Over …] turn. If a
    // re-exported walkthrough lacks them, those pills would click into
    // nothing; better to know here than on the live page.
    const users = fixture.messages.filter((m) => m.sender === 'user');
    expect(users.some((m) => /^(hoe realistisch is de overstap|how realistic is the move)/i.test(m.content))).toBe(true);
    expect(users.some((m) => /^\[(over|about)\s+.+?\]/i.test(m.content))).toBe(true);
  });

  it('every annotation key has eyebrow, title, body and legend in nl and en', () => {
    const nl = localeAnnotations('nl');
    const en = localeAnnotations('en');
    for (const a of (curation as DemoCuration).annotations ?? []) {
      for (const field of ['eyebrow', 'title', 'body', 'legend']) {
        expect(nl[a.key]?.[field], `nl annotations.${a.key}.${field}`).toBeTruthy();
        expect(en[a.key]?.[field], `en annotations.${a.key}.${field}`).toBeTruthy();
      }
    }
  });

  it('applyCuration drops hidden turns and nothing else', () => {
    const [first, second] = fixture.messages;
    const curated = applyCuration(fixture, { hiddenMessageIds: [second.id] });
    expect(curated.messages.length).toBe(fixture.messages.length - 1);
    expect(curated.messages[0].id).toBe(first.id);
    expect(curated.messages.some((m) => m.id === second.id)).toBe(false);
    expect(applyCuration(fixture, {})).toBe(fixture);
  });

  it('chooseFixture serves Marloes to Dutch visitors and flags the fallback for others', () => {
    expect(chooseFixture('nl').isFallback).toBe(false);
    expect(chooseFixture('nl-NL').isFallback).toBe(false);
    expect(chooseFixture('en').isFallback).toBe(true);
    expect(chooseFixture(undefined).isFallback).toBe(true);
    expect(chooseFixture('en').language).toBe('nl');
  });
});
