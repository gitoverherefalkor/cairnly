import {
  Users,
  Swords,
  Layers,
  Lightbulb,
  Sparkles,
  Brain,
  TrendingUp,
  Sprout,
  ArrowUpRight,
  Mountain,
  Compass,
  Scale,
  Puzzle,
  ListChecks,
  ThumbsUp,
  AlertTriangle,
  Briefcase,
  Bot,
  Target,
  Eye,
  Signpost,
  Gauge,
  UserCheck,
  GraduationCap,
  Telescope,
  Footprints,
  type LucideIcon,
} from 'lucide-react';

// Map of sub-section subheader text → icon component.
// The agent's prompts produce these exact h5 strings on the personality
// sections (approach / strengths / development / values) and the career
// sections (top careers, runner-ups, outside-the-box, dream jobs), so an
// exact-match dictionary is reliable. Anything not in the map renders
// without an icon — no decorative noise on unmatched headers.
//
// Match is case-insensitive, trimmed, and apostrophe-normalised; keep
// punctuation in keys so the lookup stays obvious. Update here when a
// prompt's subheaders change.
const ICON_MAP: Record<string, LucideIcon> = {
  // approach
  'personality and interaction style': Users,
  'your conflict style': Swords,
  'impact in different environments': Layers,

  // strengths
  'identifying your core strengths': Sparkles,
  'how you think': Brain,
  'leveraging strengths in your career': TrendingUp,

  // development
  'understanding potential growth areas': Sprout,
  'implications for your growth': ArrowUpRight,
  'your growth edge': Mountain,

  // values
  'identifying your core values': Compass,
  'values in career decisions': Scale,

  // shared closer across all four personality sections
  'key insight': Lightbulb,

  // top careers (runner-ups reuse this same subset of subheaders)
  'why this role fits you': Puzzle,
  "what you'll actually do": ListChecks,
  'what works for you': ThumbsUp,
  'the reality check': AlertTriangle,
  'the practical stuff': Briefcase,
  'how ai will impact this role': Bot,
  'alignment with your ambitions': Target,

  // outside-the-box careers
  'overview': Eye,
  'why this might be a fit': Puzzle,
  'path type & reality': Signpost,
  'ai impact on this role': Bot,

  // dream jobs ('overview' shared with outside-the-box, above)
  'feasibility rating': Gauge,
  'personality fit': UserCheck,
  'credentials & experience': GraduationCap,
  'industry outlook & future trends': Telescope,
  'steps for pursuing this role': Footprints,
};

export function iconForSubsection(title: string): LucideIcon | null {
  if (!title) return null;
  const key = title
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'") // curly → straight apostrophes
    .replace(/\s+/g, ' ');
  return ICON_MAP[key] ?? null;
}
