// Per-section identity for the printed report: which icon, which eyebrow.
//
// The icons are the SAME ones the chat sidebar uses (SECTION_ICONS in
// ReportSidebar.tsx), re-keyed from the sidebar's own ids to `section_type`,
// which is what the print pipeline actually has in hand. Keeping the two in
// step matters: a reader who saw a Trophy next to their top match in the chat
// should see a Trophy next to it on paper.

import {
  ClipboardList,
  Compass,
  Zap,
  TrendingUp,
  Heart,
  Trophy,
  Award,
  Lightbulb,
  Sparkles,
  MessageSquareQuote,
  type LucideIcon,
} from 'lucide-react';
import type { CareerSlot } from '@/components/dashboard/CareerSlotIcon';
import type { PrintLang } from './printIntros';

const SECTION_ICONS: Record<string, LucideIcon> = {
  exec_summary: ClipboardList,
  approach: Compass,
  personality_team: Compass,
  strengths: Zap,
  development: TrendingUp,
  values: Heart,
  top_career_1: Trophy,
  top_career_2: Trophy,
  top_career_3: Trophy,
  runner_ups: Award,
  outside_box: Lightbulb,
  dream_jobs: Sparkles,
  // The coach conversation, summarised. MessageSquareQuote is the closest
  // match to the cream chat glyph the chip uses.
  chat_highlights: MessageSquareQuote,
};

export function iconForSection(sectionType: string): LucideIcon | null {
  return SECTION_ICONS[sectionType] ?? null;
}

// The eyebrow carries information the title cannot: a role name alone does not
// tell the reader whether they are looking at the #1 match or a runner-up.
const EYEBROW: Record<PrintLang, Record<string, string>> = {
  en: {
    exec_summary: 'Overview',
    approach: 'About you',
    personality_team: 'About you',
    strengths: 'About you',
    development: 'About you',
    values: 'About you',
    top_career_1: 'Top match · 01',
    top_career_2: 'Top match · 02',
    top_career_3: 'Top match · 03',
    runner_ups: 'Also worth a look',
    outside_box: 'Outside the box',
    dream_jobs: 'Your dream jobs',
    chat_highlights: 'From your conversation',
  },
  nl: {
    exec_summary: 'Overzicht',
    approach: 'Over jou',
    personality_team: 'Over jou',
    strengths: 'Over jou',
    development: 'Over jou',
    values: 'Over jou',
    top_career_1: 'Topmatch · 01',
    top_career_2: 'Topmatch · 02',
    top_career_3: 'Topmatch · 03',
    runner_ups: 'Ook interessant',
    outside_box: 'Outside the box',
    dream_jobs: 'Je droombanen',
    chat_highlights: 'Uit je gesprek',
  },
};

export function eyebrowFor(sectionType: string, lang: PrintLang): string | null {
  return EYEBROW[lang][sectionType] ?? null;
}

// ─── Anchors ────────────────────────────────────────────────────────────────
// Chromium turns same-document hrefs into real GoTo annotations in the PDF, so
// the contents page can be clickable. Both sides must derive the id the same
// way, hence one function rather than two string templates.
export function anchorFor(sectionType: string): string {
  return `sec-${sectionType}`;
}

// ─── Multi-row groups ───────────────────────────────────────────────────────
// runner_ups, outside_box and dream_jobs arrive as SEVERAL rows sharing one
// section_type, each row a separate role. They need a group heading that owns
// the intro, otherwise the intro reads as if it belonged to the first role.
export const GROUP_TYPES = ['runner_ups', 'outside_box', 'dream_jobs'] as const;

export function isGroupType(sectionType: string): boolean {
  return (GROUP_TYPES as readonly string[]).includes(sectionType);
}

/** Heading for a multi-row group. Distinct from the eyebrow: the eyebrow labels
 *  an individual role, this names the set. */
const GROUP_TITLE: Record<PrintLang, Record<string, string>> = {
  en: {
    runner_ups: 'Runner-up careers',
    outside_box: 'Outside-the-box careers',
    dream_jobs: 'Your dream jobs',
  },
  nl: {
    runner_ups: 'Runner-up loopbanen',
    outside_box: 'Outside-the-box loopbanen',
    dream_jobs: 'Je droombanen',
  },
};

export function groupTitleFor(sectionType: string, lang: PrintLang): string | null {
  return GROUP_TITLE[lang][sectionType] ?? null;
}

// ─── Section photography ────────────────────────────────────────────────────
// The dashboard gives each About-You section an atmospheric photo chip
// (SECTION_VISUALS in dashboardV2Shared). Career sections have none — the
// dashboard uses icon glyphs for those — so this map covers the five that do.
//
// These are same-origin JPEGs, which the CSP permits. They were left out of the
// first print pass only because readiness gated on document.fonts.ready and
// not on image decode, so a photo could silently miss the snapshot. ReportPrint
// now awaits img.decode() for every image, which closes that hole.
const SECTION_PHOTO_KEY: Record<string, string> = {
  exec_summary: 'summary',
  approach: 'approach',
  personality_team: 'approach',
  strengths: 'strengths',
  development: 'development',
  values: 'values',
};

export function photoKeyFor(sectionType: string): string | null {
  return SECTION_PHOTO_KEY[sectionType] ?? null;
}

// Print-sized copies of the section photographs, under /report/sections.
//
// The dashboard's originals are 600x400 at 27-87KB each and the printed chip
// draws them at 44px, so every PDF was embedding roughly 12x more pixels than
// it could show. The 220px variants are still ~5x the drawn size, which is
// ample for print, and together with the downsized wordmark they take about
// 900KB off the file. The dashboard keeps the full-size originals.
const PRINT_PHOTO_SRC: Record<string, string> = {
  summary: '/report/sections/exec_summ.jpg',
  approach: '/report/sections/approach_vis.jpg',
  strengths: '/report/sections/strenghts_you.jpg',
  development: '/report/sections/development-tilted-stone.jpg',
  values: '/report/sections/values_vis.jpg',
};

export function printPhotoSrc(visualKey: string): string | null {
  return PRINT_PHOTO_SRC[visualKey] ?? null;
}

// ─── Career slot glyphs ─────────────────────────────────────────────────────
// Career sections have no photograph — the dashboard gives them one of six
// "wayfinder" glyphs on a cream chip instead (CareerSlotIcon). Same mapping
// here, so the printed report and the dashboard accordion mark a role the same
// way. The glyphs are inline SVG with pinned brand colours, so unlike the
// section photos they carry no loading risk at all.
const CAREER_SLOT: Record<string, CareerSlot> = {
  top_career_1: 'primary',
  top_career_2: 'second',
  top_career_3: 'third',
  runner_ups: 'runnerups',
  outside_box: 'outside',
  dream_jobs: 'dream',
};

export function careerSlotFor(sectionType: string): CareerSlot | null {
  return CAREER_SLOT[sectionType] ?? null;
}

// ─── Standalone chip images ─────────────────────────────────────────────────
// Sections whose chip is a supplied asset rather than a section photo or a
// career glyph. chat_highlights uses the dashboard's cream chat icon, so the
// summarised conversation is marked the same way on paper as on screen.
//
// This is a print-sized copy with a space-free name. The dashboard's original is
// `chat section_icon_cream.png` — 1254px and 906KB for a chip drawn at 44px, and
// a raw space in an `src` is the kind of thing that works until it does not.
//
// These assets are COMPLETE TILES: cream ground and tan border are painted into
// the image. PrintChip must not wrap them in its own tile, or the border prints
// twice.
const CHIP_IMAGE: Record<string, string> = {
  chat_highlights: '/report/chat-chip.png',
};

export function chipImageFor(sectionType: string): string | null {
  return CHIP_IMAGE[sectionType] ?? null;
}

// ─── Page breaks ────────────────────────────────────────────────────────────
// Major sections open a fresh page. The four personality sections deliberately
// do NOT: they run one to two pages each, and breaking before every one of them
// would leave a trail of half-empty pages for no gain.
//
// Anything NOT in this set and not a personality section still breaks — that is
// how the trailing sections a report may carry (chat_highlights today, whatever
// WF adds tomorrow) get their own page without needing to be listed here.
const NO_BREAK_TYPES = new Set([
  'approach',
  'personality_team',
  'strengths',
  'development',
  'values',
]);

export function breaksPage(sectionType: string): boolean {
  return !NO_BREAK_TYPES.has(sectionType);
}
