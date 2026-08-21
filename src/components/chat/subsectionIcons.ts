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
  Crown,
  Telescope,
  Footprints,
  ShieldCheck,
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

  // executive summary (WF7). Reaches the dashboard and the printed report but
  // not the chat, since WF7 runs after the conversation ends. English only —
  // the NL entries elsewhere in this map were copied verbatim from the live
  // prompts, and WF7's Dutch subheader list has not been pinned the same way,
  // so guessing keys here would just add lines that never match.
  'professional identity': UserCheck,
  'key strengths & growth areas': Sparkles,
  'key strengths and growth areas': Sparkles,
  'career direction': Signpost,
  'path forward': Footprints,

  // top careers (runner-ups reuse this same subset of subheaders)
  'why this role fits you': Puzzle,
  "what you'll actually do": ListChecks,
  'what works for you': ThumbsUp,
  'the reality check': AlertTriangle,
  'the practical stuff': Briefcase,
  'how ai will impact this role': Bot,
  'future-proof skills': ShieldCheck,
  'alignment with your ambitions': Target,

  // outside-the-box careers
  'overview': Eye,
  'why this might be a fit': Puzzle,
  'path type & reality': Signpost,
  'ai impact on this role': Bot,

  // dream jobs ('overview' shared with outside-the-box, above)
  'feasibility rating': Gauge,
  'personality & energy fit': UserCheck,
  'the executive version suggestion': Crown,
  'industry outlook & regional trends': Telescope,
  'steps for pursuing this role': Footprints,

  // ── Dutch subheaders ────────────────────────────────────────────────
  // These mirror the pinned heading translations in
  // supabase/functions/_shared/headingPins.ts, which translate-section
  // enforces on every Dutch report — so an exact-match dictionary stays
  // reliable. The original entries were copied verbatim from the old live
  // n8n prompt tables; the pins reuse those exact strings and complete the
  // set (top-3/runner-up careers, exec summary) the old prompts never
  // pinned. A vitest drift test (src/lib/headingPins.test.ts) keeps this
  // map and the pins in sync. Purely additive: English lookups untouched.

  // approach → Jouw aanpak begrijpen
  'persoonlijkheid en interactiestijl': Users,
  'je conflictstijl': Swords,
  'impact in verschillende omgevingen': Layers,

  // strengths → Sterke punten en hoe je ze ontwikkelt
  'je kernkwaliteiten in kaart': Sparkles,
  'hoe je denkt': Brain,
  'je sterke punten benutten in je loopbaan': TrendingUp,

  // development → Ontwikkelpunten
  'inzicht in je groeigebieden': Sprout,
  'wat dit betekent voor je groei': ArrowUpRight,
  'je volgende groeistap': Mountain,

  // values → Aansluiten bij je waarden
  'je kernwaarden in kaart': Compass,
  'waarden in loopbaankeuzes': Scale,

  // shared closer across all four personality sections
  'belangrijkste inzicht': Lightbulb,

  // executive summary (WF7)
  'professionele identiteit': UserCheck,
  'sterke punten & groeigebieden': Sparkles,
  loopbaanrichting: Signpost,
  'de weg vooruit': Footprints,

  // top careers (runner-ups reuse this same subset of subheaders)
  'waarom deze rol bij je past': Puzzle,
  'wat je daadwerkelijk gaat doen': ListChecks,
  'wat voor jou werkt': ThumbsUp,
  'de realiteitscheck': AlertTriangle,
  'de praktische kant': Briefcase,
  'toekomstbestendige vaardigheden': ShieldCheck,
  'aansluiting bij je ambities': Target,

  // outside-the-box careers
  overzicht: Eye,
  'waarom dit bij je past': Puzzle,
  'type pad & realiteit': Signpost,
  'ai-impact op deze rol': Bot,

  // dream jobs ('overzicht' shared with outside-the-box, above)
  haalbaarheidsscore: Gauge,
  'aansluiting op persoonlijkheid en energie': UserCheck,
  'de executive-versie': Crown,
  'sectorvooruitzichten en regionale trends': Telescope,
  'stappen om deze rol na te streven': Footprints,
};

export function iconForSubsection(title: string): LucideIcon | null {
  if (!title) return null;
  const key = title
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'") // curly → straight apostrophes
    .replace(/["“”]/g, '') // drop decorative double-quotes (e.g. The "Executive Version" Suggestion)
    .replace(/\s+/g, ' ');
  return ICON_MAP[key] ?? null;
}
