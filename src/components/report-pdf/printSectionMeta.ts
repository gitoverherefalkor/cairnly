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
  type LucideIcon,
} from 'lucide-react';
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
  },
};

export function eyebrowFor(sectionType: string, lang: PrintLang): string | null {
  return EYEBROW[lang][sectionType] ?? null;
}
