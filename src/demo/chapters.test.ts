import { describe, expect, it } from 'vitest';
import marcelJson from './fixtures/marcel.nl.json';
import emmaJson from './fixtures/emma.en.json';
import { buildChapters, chapterOfSection, detectSectionIndex, sectionIndexByMessage } from './chapters';
import type { DemoFixture } from './types';

const FIXTURES = [
  { name: 'Marcel (nl)', lang: 'nl', fixture: marcelJson as unknown as DemoFixture, noHeading: 'Geen kop hier' },
  { name: 'Emma (en)', lang: 'en', fixture: emmaJson as unknown as DemoFixture, noHeading: 'No heading here' },
];

describe.each(FIXTURES)('demo chapter detection (against the frozen $name session)', ({ lang, fixture, noHeading }) => {
  it('finds every delivered section exactly once, in report order', () => {
    const byMessage = sectionIndexByMessage(fixture.messages, fixture.sections);
    const inTranscriptOrder = fixture.messages
      .filter((m) => byMessage[m.id] != null)
      .map((m) => byMessage[m.id]);
    // Sections 1..10: approach, strengths, development, values, career 1-3,
    // runner-ups, outside the box, dream jobs. The exec summary (0) is never
    // delivered in chat.
    expect(inTranscriptOrder).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('does not mistake a follow-up reply for a section delivery', () => {
    const byMessage = sectionIndexByMessage(fixture.messages, fixture.sections);
    const replies = fixture.messages.filter(
      (m) => m.sender === 'bot' && !/^### /m.test(m.content),
    );
    expect(replies.length).toBeGreaterThan(5);
    for (const r of replies) expect(byMessage[r.id]).toBeUndefined();
  });

  it('resolves a career heading through the report sections', () => {
    const career1 = fixture.sections.find((s) => s.section_type === 'top_career_1')!;
    const title = career1.content_i18n?.[lang]?.title ?? career1.title!;
    expect(detectSectionIndex(`### ${title}\n\nbody`, fixture.sections)).toBe(5);
    expect(detectSectionIndex(noHeading, fixture.sections)).toBe(-1);
  });

  it('builds three chapters that each start at a real message', () => {
    const chapters = buildChapters(fixture.messages, fixture.sections);
    expect(chapters.map((c) => c.id)).toEqual(['personality', 'careers', 'dreams']);
    for (const c of chapters) {
      expect(c.firstMessageId).not.toBeNull();
      expect(fixture.messages.some((m) => m.id === c.firstMessageId)).toBe(true);
    }
    expect(chapters[0].sectionIndexes).toEqual([1, 2, 3, 4]);
    expect(chapters[1].sectionIndexes).toEqual([5, 6, 7, 8, 9]);
    expect(chapters[2].sectionIndexes).toEqual([10]);
  });
});

describe('chapterOfSection', () => {
  it('maps section indexes to chapters', () => {
    expect(chapterOfSection(0)).toBeNull();
    expect(chapterOfSection(1)).toBe('personality');
    expect(chapterOfSection(4)).toBe('personality');
    expect(chapterOfSection(5)).toBe('careers');
    expect(chapterOfSection(9)).toBe('careers');
    expect(chapterOfSection(10)).toBe('dreams');
    expect(chapterOfSection(11)).toBeNull();
  });
});
