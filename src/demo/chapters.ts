// Chapter navigation for the demo replay: which message delivers which report
// section, folded into the three chapters the sticky bar shows.
//
// Mirrors the heading matching ChatMessage does at render time (ALL_SECTIONS
// alt-titles first, then the report's own career titles), so the chapter a
// message lands in here is the section the chat itself would detect.
import { ALL_SECTIONS } from '@/components/chat/ReportSidebar';
import { sectionTitleCandidates, type TranslatableSection } from '@/lib/sectionText';
import type { DemoMessage } from './types';

export type DemoChapterId = 'personality' | 'careers' | 'dreams';

export interface DemoChapter {
  id: DemoChapterId;
  // First transcript message that delivers a section of this chapter, or
  // null when the transcript never reached the chapter.
  firstMessageId: string | null;
  sectionIndexes: number[];
}

// Canonical ALL_SECTIONS indexes per chapter (0 = the hidden exec summary).
const CHAPTER_RANGES: Record<DemoChapterId, [number, number]> = {
  personality: [1, 4],
  careers: [5, 9],
  dreams: [10, 10],
};
export const CHAPTER_ORDER: DemoChapterId[] = ['personality', 'careers', 'dreams'];

// Career sections carry the career's own title as heading, so they are
// resolved through report_sections.section_type instead of a fixed title.
const SECTION_TYPE_TO_INDEX: Record<string, number> = {
  top_career_1: 5,
  top_career_2: 6,
  top_career_3: 7,
  runner_ups: 8,
  outside_box: 9,
  dream_jobs: 10,
};

type SectionLike = TranslatableSection & { section_type: string };

// Same normalisation as ChatMessage's title matcher, hyphen folding included
// ("HR-adviseur" in the delivered heading vs "HR Adviseur" in the re-translated
// section title must still be the same career).
function normalize(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/[-‐-―]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function indexFromAltTitles(heading: string): number {
  const n = normalize(heading);
  if (!n) return -1;
  return ALL_SECTIONS.findIndex((section) => {
    if (n.includes(section.title.toLowerCase())) return true;
    if (section.altTitles.some((alt) => n.includes(alt.toLowerCase()))) return true;
    return n.includes(section.id.replace(/-/g, ' '));
  });
}

function indexFromSections(heading: string, sections: SectionLike[]): number {
  const n = normalize(heading);
  if (!n) return -1;
  for (const s of sections) {
    const idx = SECTION_TYPE_TO_INDEX[s.section_type];
    if (idx == null) continue;
    for (const candidate of sectionTitleCandidates(s)) {
      const c = normalize(candidate);
      if (!c) continue;
      if (c === n || n.includes(c) || c.includes(n)) return idx;
    }
  }
  return -1;
}

/** Canonical section index (ALL_SECTIONS) a bot message delivers, or -1. */
export function detectSectionIndex(content: string, sections: SectionLike[]): number {
  const headings = [...content.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1]);
  for (const heading of headings) {
    const viaAlt = indexFromAltTitles(heading);
    if (viaAlt >= 0) return viaAlt;
    const viaSections = indexFromSections(heading, sections);
    if (viaSections >= 0) return viaSections;
  }
  return -1;
}

/** message id → section index, for every bot message that delivers one. */
export function sectionIndexByMessage(
  messages: DemoMessage[],
  sections: SectionLike[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) {
    if (m.sender !== 'bot') continue;
    const idx = detectSectionIndex(m.content, sections);
    if (idx >= 0) out[m.id] = idx;
  }
  return out;
}

export function chapterOfSection(index: number): DemoChapterId | null {
  for (const id of CHAPTER_ORDER) {
    const [lo, hi] = CHAPTER_RANGES[id];
    if (index >= lo && index <= hi) return id;
  }
  return null;
}

export function buildChapters(messages: DemoMessage[], sections: SectionLike[]): DemoChapter[] {
  const byMessage = sectionIndexByMessage(messages, sections);
  return CHAPTER_ORDER.map((id) => {
    const [lo, hi] = CHAPTER_RANGES[id];
    let firstMessageId: string | null = null;
    const sectionIndexes: number[] = [];
    for (const m of messages) {
      const idx = byMessage[m.id];
      if (idx == null || idx < lo || idx > hi) continue;
      if (firstMessageId === null) firstMessageId = m.id;
      if (!sectionIndexes.includes(idx)) sectionIndexes.push(idx);
    }
    return { id, firstMessageId, sectionIndexes };
  });
}
