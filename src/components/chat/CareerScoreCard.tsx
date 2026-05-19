import React from 'react';

// AI Impact rating scale, ordered low → high.
// Current prompt produces: "Safe", "Augmented", "Transforming", "At Risk"
// (with parenthetical labels like "(Low Impact)", "(Severe Impact)").
// Older messages used: "Supporting", "Moderate", "Substantial",
// "Low", "High". Aliases below normalize both eras into the new 4-level scale.
const AI_IMPACT_LEVELS = ['Safe', 'Augmented', 'Transforming', 'At Risk'] as const;
type AIImpactLevel = typeof AI_IMPACT_LEVELS[number];

const AI_IMPACT_ALIASES: Record<string, AIImpactLevel> = {
  // current scale
  safe: 'Safe',
  augmented: 'Augmented',
  transforming: 'Transforming',
  'at risk': 'At Risk',
  'at-risk': 'At Risk',
  atrisk: 'At Risk',
  // legacy aliases — older reports used different labels for the same idea
  minimal: 'Safe',
  supporting: 'Safe',
  low: 'Safe',
  moderate: 'Augmented',
  medium: 'Augmented',
  substantial: 'Transforming',
  high: 'Transforming',
  transformative: 'Transforming',
  severe: 'At Risk',
};

// Per-level color tokens. Driven by the user-facing meaning:
//   Safe        → teal/green   (neutral / positive)
//   Augmented   → blue         (productive collaboration with AI)
//   Transforming→ amber/orange (significant disruption, but not threatening)
//   At Risk     → red          (job security genuinely threatened)
const AI_IMPACT_STYLES: Record<AIImpactLevel, { dot: string; text: string; ring: string; tint: string }> = {
  Safe:         { dot: 'bg-emerald-500', text: 'text-emerald-700', ring: 'border-emerald-500/30', tint: 'bg-emerald-50' },
  Augmented:    { dot: 'bg-sky-500',     text: 'text-sky-700',     ring: 'border-sky-500/30',     tint: 'bg-sky-50' },
  Transforming: { dot: 'bg-amber-500',   text: 'text-amber-700',   ring: 'border-amber-500/30',   tint: 'bg-amber-50' },
  'At Risk':    { dot: 'bg-red-500',     text: 'text-red-700',     ring: 'border-red-500/30',     tint: 'bg-red-50' },
};

// Pull an AI Impact rating out of free-text section content.
// Production phrasings the prompt produces:
//   "**Safe** (Low Impact)"
//   "**Augmented** (Moderate Impact)"
//   "**Transforming** (High Impact)"
//   "**At Risk** (Severe Impact)"
//   "AI Impact: Augmented"
//   "Rating: Safe"
//   "carries a Moderate AI impact rating"        (legacy single-label)
//   "carries a Low to Moderate AI impact rating" (legacy range — pick higher)
const LABEL_GROUP =
  '(safe|augmented|transforming|at\\s*risk|minimal|supporting|moderate|substantial|low|high|severe|transformative)';

// Tier order — used to pick the higher-impact label when a range like
// "Low to Moderate" produces two matches.
const IMPACT_TIER: Record<AIImpactLevel, number> = {
  Safe: 0,
  Augmented: 1,
  Transforming: 2,
  'At Risk': 3,
};

function aliasFor(raw: string): AIImpactLevel | null {
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  return AI_IMPACT_ALIASES[key] ?? null;
}

export function extractAIImpact(body: string): AIImpactLevel | null {
  if (!body) return null;
  const text = body.replace(/<[^>]+>/g, ' '); // strip any inline html tags

  // First pass: high-precision patterns that nail a specific phrasing.
  const patterns: RegExp[] = [
    new RegExp(`\\*\\*${LABEL_GROUP}\\*\\*\\s*\\((?:low|moderate|high|severe)\\s*impact\\)`, 'i'),
    new RegExp(`(?:rating)\\s*[:\\-]\\s*${LABEL_GROUP}`, 'i'),
    new RegExp(`carries?\\s+a\\s+${LABEL_GROUP}\\s+ai\\s*impact`, 'i'),
    new RegExp(`\\*\\*${LABEL_GROUP}:`, 'i'),
    new RegExp(`(?:ai\\s*impact[^.\\n]{0,40}?)${LABEL_GROUP}`, 'i'),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const level = aliasFor(m[1]);
      if (level) return level;
    }
  }

  // Fallback: find any "AI impact" mention and scan up to ~60 chars on each
  // side for a label word. Catches ranges like "Low to Moderate AI impact"
  // and other paraphrased forms. When multiple labels show up in the window,
  // pick the highest-tier one (more conservative read for the user).
  const contextMatch = text.match(/(.{0,60})ai\s*impact(.{0,60})/i);
  if (contextMatch) {
    const window = `${contextMatch[1]} ${contextMatch[2]}`;
    const labelRegex = new RegExp(`\\b${LABEL_GROUP}\\b`, 'gi');
    let best: AIImpactLevel | null = null;
    let m: RegExpExecArray | null;
    while ((m = labelRegex.exec(window)) !== null) {
      const level = aliasFor(m[1]);
      if (level && (!best || IMPACT_TIER[level] > IMPACT_TIER[best])) {
        best = level;
      }
    }
    if (best) return best;
  }

  return null;
}

// Detect when a paragraph LEADS with an AI-impact rating, e.g.
// "Transforming (High Impact): ...". Used to surface a severity badge at the
// top of the "How AI will impact this role" section. Deliberately strict —
// only the section's own opening line should match.
export function leadingAIImpactLevel(text: string): AIImpactLevel | null {
  if (!text) return null;
  const m = text
    .trim()
    .match(/^(safe|augmented|transforming|at\s*risk)\s*\([^)]*impact[^)]*\)\s*:/i);
  if (!m) return null;
  return aliasFor(m[1]);
}

// Compact pill showing match score 0-100 with a teal progress bar.
// All recommended jobs pass the suitability filter, so no warning colors —
// the bar fill itself communicates how strong the match is.
const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const safe = Math.max(0, Math.min(100, score));

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-atlas-teal/30 bg-white px-3 py-1.5 shadow-sm">
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
        Match
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-base font-bold text-atlas-teal leading-none">{safe}</span>
        <span className="text-[10px] text-gray-400 leading-none">/100</span>
      </div>
      <div className="h-1.5 w-14 bg-emerald-50 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-atlas-teal to-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
};

// 4-step badge: dots colored by impact level, only the active level's dot
// shows that level's color (others stay neutral). The label color also
// shifts so the pill instantly reads as "fine" vs "watch out".
export const AIImpactBadge: React.FC<{ level: AIImpactLevel }> = ({ level }) => {
  const idx = AI_IMPACT_LEVELS.indexOf(level);
  if (idx < 0) return null;
  const style = AI_IMPACT_STYLES[level];

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-full border ${style.ring} ${style.tint} px-3 py-1.5 shadow-sm`}
    >
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
        AI Impact
      </span>
      <span className={`text-xs font-semibold ${style.text}`}>{level}</span>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {AI_IMPACT_LEVELS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === idx ? style.dot : 'bg-gray-200'}`}
          />
        ))}
      </div>
    </div>
  );
};

// ── Feasibility rating (dream jobs) ──────────────────────────────────
// Scale from the dream-job prompt: Low | Low - Moderate | Moderate |
// Moderate - High | High. Coloured as a red → green ramp (low feasibility
// reads as a warning, high feasibility as positive).
const FEASIBILITY_LEVELS = [
  'Low',
  'Low - Moderate',
  'Moderate',
  'Moderate - High',
  'High',
] as const;
type FeasibilityLevel = (typeof FEASIBILITY_LEVELS)[number];

const FEASIBILITY_STYLES: Record<
  FeasibilityLevel,
  { dot: string; text: string; ring: string; tint: string }
> = {
  Low:               { dot: 'bg-red-500',     text: 'text-red-700',     ring: 'border-red-500/30',     tint: 'bg-red-50' },
  'Low - Moderate':  { dot: 'bg-orange-500',  text: 'text-orange-700',  ring: 'border-orange-500/30',  tint: 'bg-orange-50' },
  Moderate:          { dot: 'bg-amber-500',   text: 'text-amber-700',   ring: 'border-amber-500/30',   tint: 'bg-amber-50' },
  'Moderate - High': { dot: 'bg-lime-600',    text: 'text-lime-700',    ring: 'border-lime-600/30',    tint: 'bg-lime-50' },
  High:              { dot: 'bg-emerald-500', text: 'text-emerald-700', ring: 'border-emerald-500/30', tint: 'bg-emerald-50' },
};

// Detect when a paragraph LEADS with a feasibility rating, e.g.
// "Low - Moderate: ...". Two-word ranges are matched before the single
// words so "Low - Moderate" isn't truncated to "Low".
export function leadingFeasibilityLevel(text: string): FeasibilityLevel | null {
  if (!text) return null;
  const m = text
    .trim()
    .match(/^(low\s*[-–]\s*moderate|moderate\s*[-–]\s*high|low|moderate|high)\s*:/i);
  if (!m) return null;
  const norm = m[1].toLowerCase().replace(/\s*[-–]\s*/g, ' - ').replace(/\s+/g, ' ').trim();
  return FEASIBILITY_LEVELS.find((l) => l.toLowerCase() === norm) ?? null;
}

// Pull the dream-job feasibility rating out of section content. The body
// carries a "Feasibility Rating" subheader followed by e.g. "Low - Moderate: …".
// Returns null for non-dream careers (no feasibility section).
export function extractFeasibility(body: string): FeasibilityLevel | null {
  if (!body) return null;
  // Strip HTML tags AND markdown emphasis markers, so a bolded rating like
  // "**Low** - Moderate" reads as plain "Low - Moderate" and hyphenated
  // ranges still match.
  const text = body.replace(/<[^>]+>/g, ' ').replace(/[*_]/g, '');
  const idx = text.search(/feasibility\s*rating/i);
  if (idx < 0) return null;
  const after = text.slice(idx).replace(/^feasibility\s*rating[\s:.]*/i, '');
  return leadingFeasibilityLevel(after);
}

// 5-step badge mirroring AIImpactBadge — the active level's dot carries its
// colour, the rest stay neutral; the label colour shifts with feasibility.
export const FeasibilityBadge: React.FC<{ level: FeasibilityLevel }> = ({ level }) => {
  const idx = FEASIBILITY_LEVELS.indexOf(level);
  if (idx < 0) return null;
  const style = FEASIBILITY_STYLES[level];

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-full border ${style.ring} ${style.tint} px-3 py-1.5 shadow-sm`}
    >
      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
        Feasibility
      </span>
      <span className={`text-xs font-semibold ${style.text}`}>{level}</span>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {FEASIBILITY_LEVELS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === idx ? style.dot : 'bg-gray-200'}`}
          />
        ))}
      </div>
    </div>
  );
};

interface CareerScoreCardProps {
  score?: number | null;
  aiImpact?: AIImpactLevel | null;
  feasibility?: FeasibilityLevel | null;
}

// Renders score + AI impact + feasibility in a single row above a career
// section heading. Renders nothing if no value is available, so prose-only
// careers stay clean.
export const CareerScoreCard: React.FC<CareerScoreCardProps> = ({
  score,
  aiImpact,
  feasibility,
}) => {
  if (score == null && !aiImpact && !feasibility) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-2 mt-1">
      {score != null && <ScoreGauge score={score} />}
      {aiImpact && <AIImpactBadge level={aiImpact} />}
      {feasibility && <FeasibilityBadge level={feasibility} />}
    </div>
  );
};
