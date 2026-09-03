import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyTranslation } from './loadFixture';
import { detectSectionIndex } from './chapters';
import type { DemoFixture, DemoTranslation } from './types';

// Demo-layer translations (scripts/demo-translate-fixture.ts). Each sidecar
// that exists is checked against the chat components' expectations: every
// message translated, section deliveries still resolve to a section (score
// pills, radar), the persona's clicked follow-up option still matches a
// bullet (the check-marked choice card), the Move-pill turn and the scoped
// "[About …]" turn keep the shapes DemoReplay jumps on, and follow-up lists
// keep the escape-hatch phrase the chips are detected by.
const FIXTURES = resolve(process.cwd(), 'src/demo/fixtures');
const read = <T,>(file: string) => JSON.parse(readFileSync(resolve(FIXTURES, file), 'utf8')) as T;

const CASES = [
  { persona: 'marcel', fixture: 'marcel.nl.json', sidecar: 'marcel.nl.messages.en.json' },
  { persona: 'emma', fixture: 'emma.en.json', sidecar: 'emma.en.messages.nl.json' },
].filter((c) => existsSync(resolve(FIXTURES, c.sidecar)));

const ESCAPE: Record<string, RegExp> = {
  en: /something else|let me know|on your mind/i,
  nl: /iets anders|wat je bezighoudt/i,
};
const FEASIBILITY = /^(hoe realistisch is de overstap|how realistic is the move)/i;
const SCOPED = /^\[(over|about)\s+.+?\]/i;
const BULLET = /^\s*-\s*(?:\*\*(.+?)\*\*\s*(.*)|(.+))$/;
const options = (md: string) =>
  /^### /m.test(md)
    ? []
    : md
        .split('\n')
        .map((l) => l.match(BULLET))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => (m[1] !== undefined ? m[1] : m[3] ?? '').trim().replace(/[!?.]+$/, ''));
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

describe.each(CASES)('demo translation sidecar ($sidecar)', ({ fixture: fixtureFile, sidecar: sidecarFile }) => {
  const fixture = read<DemoFixture>(fixtureFile);
  const sidecar = read<DemoTranslation>(sidecarFile);
  const to = sidecar.meta.to;

  it('covers every message and the chat highlights, and names its method', () => {
    for (const m of fixture.messages) {
      expect(sidecar.messages[m.id], `translation for ${m.id}`).toBeTruthy();
      expect(sidecar.meta.methods[m.id], `method for ${m.id}`).toBeTruthy();
      expect(sidecar.messages[m.id]).not.toMatch(/^\[dry\]/);
    }
    expect(sidecar.sections.chat_highlights?.content).toBeTruthy();
    expect(sidecar.meta.from).toBe(fixture.persona.language);
  });

  it('keeps every section delivery resolvable to its section', () => {
    const translated = applyTranslation(fixture, sidecar);
    const before = fixture.messages
      .filter((m) => m.sender === 'bot' && detectSectionIndex(m.content, fixture.sections) >= 0)
      .map((m) => [m.id, detectSectionIndex(m.content, fixture.sections)] as const);
    expect(before.length).toBe(10);
    for (const [id, idx] of before) {
      const after = translated.messages.find((m) => m.id === id)!;
      expect(detectSectionIndex(after.content, translated.sections), `section ${idx} in ${id}`).toBe(idx);
    }
  });

  it('keeps the clicked follow-up option, the Move-pill turn and the scoped turn recognisable', () => {
    const translated = applyTranslation(fixture, sidecar);
    const msgs = translated.messages;
    let optionsChecked = 0;
    for (let i = 1; i < fixture.messages.length; i++) {
      const src = fixture.messages[i];
      const prevSrc = fixture.messages[i - 1];
      if (src.sender !== 'user' || prevSrc.sender !== 'bot') continue;
      const srcOpts = options(prevSrc.content);
      const idx = srcOpts.findIndex((o) => norm(o) === norm(src.content));
      if (idx < 0) continue;
      const tOpts = options(msgs[i - 1].content);
      expect(tOpts.length, `bullets in ${prevSrc.id}`).toBe(srcOpts.length);
      expect(norm(tOpts[idx])).toBe(norm(msgs[i].content));
      expect(msgs[i - 1].content).toMatch(ESCAPE[to]);
      optionsChecked++;
    }
    expect(optionsChecked).toBeGreaterThan(0);
    expect(msgs.some((m) => m.sender === 'user' && FEASIBILITY.test(m.content))).toBe(true);
    expect(msgs.some((m) => m.sender === 'user' && SCOPED.test(m.content))).toBe(true);
  });

  it('carries the Keep rows and the highlights along', () => {
    const translated = applyTranslation(fixture, sidecar);
    expect(translated.translatedTo).toBe(to);
    const texts = new Set(translated.messages.map((m) => norm(m.content)));
    for (const r of translated.savedResponses ?? []) expect(texts.has(norm(r.content)), r.id).toBe(true);
    const hl = translated.sections.find((s) => s.section_type === 'chat_highlights')!;
    expect(hl.content_i18n?.[to]?.content).toBe(sidecar.sections.chat_highlights.content);
  });
});
