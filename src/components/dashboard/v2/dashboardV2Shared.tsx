// Shared primitives for the v2 dashboard redesign (handoff: Cairnly Dashboard v2).
// Ported from the design prototype's dashboard-shared.jsx — recreated as typed
// React components wired to the production asset paths under /public/dashboard.

import React from 'react';
import { Bot, Route, Gauge, Coins } from 'lucide-react';
import { type MoveLevel, MOVE_COLOR, moveLegend } from '@/lib/moveScale';

// ---------- Brand palette ----------
// Mirrors the --cairnly-* tokens in src/index.css. Kept as a local constant
// because the dark-glass cards need precise rgba values that aren't in the
// Tailwind theme.
export const PALETTE = {
  canvas: '#213F4F',
  canvasDeep: '#122E3B',
  cream: '#ECE4D2',
  creamLight: '#F5EFE2',
  tan: '#C9B690',
  teal: '#27A1A1',
  tealBright: '#2ABFBF',
  tealDeep: '#1F8282',
  blue: '#3989AF',
  gold: '#D4A024',
  goldWarm: '#E3B04D',
  goldBright: '#EFBE48',
  ink: '#122E3B',
  inkMuted: '#4B6373',
  inkSoft: '#6B7F8B',
} as const;

export const FONT_DISPLAY = "'Poppins', sans-serif";
export const FONT_BODY = "'Inter', sans-serif";

// Asset paths (copied from the handoff bundle into /public/dashboard).
// LakeBackground now uses the water-and-cairn shot from /public/images — the
// original lake-reflection asset was retired but the dashboard wants water,
// not the dry mountain trail.
export const LAKE_BG_URL = '/images/live/trail_over_water.png';
export const CAIRN_TRAIL_URL = '/dashboard/cairn_trail_landscape.jpg';
export const LOGO_INVERTED_URL = '/logos/cairnly_logo_wordmark_inverted.png';
export const LOGO_WORDMARK_URL = '/logos/cairnly_logo_wordmark.png';

// ---------- AI impact ----------
// extractAIImpact (src/components/chat/CareerScoreCard.tsx) returns these five
// clinical labels. Colors match the IMPACT_COLOR map used across the chat cards.
export type AIImpactLevel = 'Minimal' | 'Moderate' | 'High' | 'Severe' | 'Critical';

export const AI_IMPACT_COLOR: Record<AIImpactLevel, string> = {
  Minimal: '#10b981',  // emerald
  Moderate: '#0ea5e9', // sky
  High: '#f59e0b',     // amber
  Severe: '#f97316',   // orange
  Critical: '#ef4444', // red
};

// Plain-English meaning of each clinical level — shown as a hover tooltip
// on the pill so the user understands what the label implies for their role.
export const AI_IMPACT_MEANING: Record<AIImpactLevel, string> = {
  Minimal: "The rare exception. Hands-on or human-presence work AI can't take over.",
  Moderate: 'Healthy augmentation. AI handles routine work; your judgment stays essential.',
  High: 'The role reshapes. Much of the day-to-day shifts to directing and checking AI.',
  Severe: 'Teams shrink. Most of the role automates into fewer, AI-leveraged people.',
  Critical: 'Pivot needed. Core deliverables are largely automatable today.',
};

// ---------- Move (reskilling effort to enter the role) ----------
// 4-level scale, colors, and legend live in @/lib/moveScale (shared with the
// chat badge + share card). Set by WF4 per career (metadata.move). MoveLevel is
// re-exported so existing importers of this module keep working.
export type { MoveLevel } from '@/lib/moveScale';

// ---------- Career match shape ----------
export interface CareerMatch {
  rank: number;
  title: string;
  shape: string | null;
  matchPct: number;
  aiImpact: AIImpactLevel | null;
  move?: MoveLevel | null;
  // Region-calibrated AI salary estimate (compact range string, e.g.
  // "€60k–€120k"), shown as a muted "est." pill. Absent on reports generated
  // before WF4 wrote it into metadata — the pill is simply skipped then.
  salary?: string | null;
  teaser?: string;
  alignment?: string;
}

// ---------- SECTION_VISUALS ----------
// Per-section photographic identity. Each report section gets an atmospheric
// chip with a role-matched color tint.
export interface SectionVisual {
  src: string;
  position: string;
  hue: string;
}

// About-You row visuals — refreshed set. Career-suggestion rows use the
// CareerSlotIcon set instead, so they don't need photo entries here.
export const SECTION_VISUALS: Record<string, SectionVisual> = {
  summary: { src: '/dashboard/sections/exec_summ.jpg', position: 'center 60%', hue: 'rgba(33,63,79,0.30)' },
  approach: { src: '/dashboard/sections/approach_vis.jpg', position: 'center center', hue: 'rgba(33,63,79,0.35)' },
  strengths: { src: '/dashboard/sections/strenghts_you.jpg', position: 'center center', hue: 'rgba(212,160,36,0.20)' },
  development: { src: '/dashboard/sections/development-tilted-stone.jpg', position: 'center center', hue: 'rgba(33,63,79,0.40)' },
  values: { src: '/dashboard/sections/values_vis.jpg', position: 'center center', hue: 'rgba(31,130,130,0.25)' },
};

// ---------- LakeBackground ----------
// Fixed full-bleed lake photo with a teal-navy gradient overlay. `intensity`
// controls overlay opacity — heavier = content forward.
type Intensity = 'light' | 'normal' | 'heavy';

const OVERLAYS: Record<Intensity, string> = {
  light: 'linear-gradient(180deg, rgba(33,63,79,0.40) 0%, rgba(18,46,59,0.62) 100%)',
  normal: 'linear-gradient(180deg, rgba(33,63,79,0.55) 0%, rgba(18,46,59,0.78) 60%, rgba(18,46,59,0.90) 100%)',
  heavy: 'linear-gradient(180deg, rgba(33,63,79,0.72) 0%, rgba(18,46,59,0.90) 50%, #122E3B 100%)',
};

export const LakeBackground: React.FC<{ intensity?: Intensity; children: React.ReactNode }> = ({
  intensity = 'normal',
  children,
}) => (
  <div style={{ position: 'relative', minHeight: '100vh', background: PALETTE.canvasDeep }}>
    {/* Background image lives in its own viewport-fixed layer so the lake
        doesn't visibly "zoom" when the page height changes (an accordion
        opening grew the parent and `background-size: cover` was scaling
        the image up to match). Position-fixed locks the layer to the
        viewport — page can grow, image stays the same size. */}
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundImage: `${OVERLAYS[intensity]}, url(${LAKE_BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        pointerEvents: 'none',
      }}
    />
    <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
  </div>
);

// ---------- Eyebrow ----------
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  subtle?: boolean;
  color?: string;
}> = ({ children, subtle = false, color }) => (
  <span
    style={{
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: subtle ? 10 : 11,
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color: color ?? (subtle ? 'rgba(212,160,36,0.7)' : PALETTE.goldBright),
    }}
  >
    {children}
  </span>
);

// ---------- AIImpactPill ----------
export const AIImpactPill: React.FC<{ label: AIImpactLevel }> = ({ label }) => {
  const color = AI_IMPACT_COLOR[label];
  return (
    <span
      title={AI_IMPACT_MEANING[label]}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 9999,
        background: `${color}1a`,
        color,
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      <Bot size={11} color={color} /> AI · {label}
    </span>
  );
};

// ---------- MatchPill ----------
// Match score as a pill, styled to sit in the same row as the AI + Move pills.
// Gold treatment so the match % still leads the trio (it's the primary metric).
export const MatchPill: React.FC<{ pct: number }> = ({ pct }) => {
  const color = '#EFBE48'; // PALETTE.goldBright
  return (
    <span
      title={`${pct}% fit against your profile`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 9999,
        background: `${color}1a`,
        color,
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      <Gauge size={11} color={color} /> Match · {pct}%
    </span>
  );
};

// ---------- MovePill ----------
// Reskilling-effort pill shown beside the AI impact pill on top-3 career cards.
export const MovePill: React.FC<{ level: MoveLevel }> = ({ level }) => {
  const color = MOVE_COLOR[level];
  return (
    <span
      title={moveLegend(level)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 9999,
        background: `${color}1a`,
        color,
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      <Route size={11} color={color} /> {level}
    </span>
  );
};

// ---------- SalaryPill ----------
// AI-estimated salary range for the role, in the region's currency. Muted grey
// and prefixed "est." on purpose: it's an estimate, not a sourced figure, so it
// sits quieter than the Match pill and never reads as a hard number. Real posted
// ranges live in Find Open Roles.
function compactRange(s: string): string {
  return s
    .replace(/(\d+),?000\b/g, '$1k')       // 60,000 / 60000 -> 60k
    .replace(/\s*(?:-|–|—|to)\s*/gi, '–')  // any separator -> en dash
    .trim();
}

export const SalaryPill: React.FC<{ range: string }> = ({ range }) => {
  const color = '#6B7F8B'; // muted slate-grey — supporting info, not a headline
  return (
    <span
      title="AI-estimated range for your region. See real posted ranges in Find Open Roles."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 9999,
        background: 'rgba(107,127,139,0.10)',
        color,
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        border: '1px solid rgba(107,127,139,0.24)',
        whiteSpace: 'nowrap',
      }}
    >
      <Coins size={11} color={color} /> est. {compactRange(range)}
    </span>
  );
};

// ---------- SectionPhoto ----------
// Photographic chip with a brand-aligned color tint (multiply).
export const SectionPhoto: React.FC<{
  src?: string;
  position?: string;
  hue?: string;
  size?: number;
  radius?: number;
}> = ({ src, position = 'center center', hue = 'rgba(33,63,79,0.45)', size = 84, radius = 12 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius,
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      boxShadow: '0 4px 10px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.06)',
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${src || LAKE_BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: position,
        filter: 'saturate(0.92)',
      }}
    />
    <div style={{ position: 'absolute', inset: 0, background: hue, mixBlendMode: 'multiply' }} />
  </div>
);

// ---------- CairnGlyph ----------
// Small SVG of stacked stones — a per-section anchor mark with 8 arrangements.
type GlyphKind =
  | 'foundation'
  | 'angled'
  | 'tall'
  | 'offset'
  | 'halo'
  | 'capstone'
  | 'pair'
  | 'scattered'
  | 'distant';

export const CairnGlyph: React.FC<{
  kind?: GlyphKind;
  size?: number;
  color?: string;
  accent?: string;
}> = ({ kind = 'foundation', size = 56, color = '#ECE4D2', accent = '#D4A024' }) => {
  const base = {
    stroke: color,
    strokeWidth: 1.4,
    fill: 'rgba(236,228,210,0.18)',
    strokeLinejoin: 'round' as const,
  };
  const accentStone = { stroke: accent, strokeWidth: 1.6, fill: 'rgba(212,160,36,0.30)' };

  const arrangements: Record<GlyphKind, React.ReactNode> = {
    foundation: (
      <>
        <ellipse cx={size / 2} cy={size - 12} rx={size * 0.32} ry={size * 0.1} {...base} />
        <ellipse cx={size / 2 - 2} cy={size - 22} rx={size * 0.22} ry={size * 0.08} {...base} />
        <ellipse cx={size / 2} cy={size - 30} rx={size * 0.12} ry={size * 0.06} {...accentStone} />
      </>
    ),
    angled: (
      <>
        <ellipse cx={size / 2 - 8} cy={size - 12} rx={size * 0.2} ry={size * 0.075} {...base} />
        <ellipse cx={size / 2 - 2} cy={size - 22} rx={size * 0.17} ry={size * 0.07} {...base} transform={`rotate(-8 ${size / 2} ${size - 22})`} />
        <ellipse cx={size / 2 + 6} cy={size - 32} rx={size * 0.14} ry={size * 0.06} {...base} transform={`rotate(-14 ${size / 2 + 6} ${size - 32})`} />
        <circle cx={size / 2 + 11} cy={size - 40} r={3} fill={accent} opacity="0.85" />
      </>
    ),
    tall: (
      <>
        <ellipse cx={size / 2} cy={size - 11} rx={size * 0.28} ry={size * 0.085} {...base} />
        <ellipse cx={size / 2} cy={size - 21} rx={size * 0.22} ry={size * 0.075} {...base} />
        <ellipse cx={size / 2} cy={size - 30} rx={size * 0.18} ry={size * 0.065} {...base} />
        <ellipse cx={size / 2} cy={size - 38} rx={size * 0.14} ry={size * 0.055} {...base} />
        <circle cx={size / 2} cy={size - 46} r={3.5} fill={accent} />
      </>
    ),
    offset: (
      <>
        <ellipse cx={size / 2} cy={size - 12} rx={size * 0.28} ry={size * 0.085} {...base} />
        <ellipse cx={size / 2 + 4} cy={size - 22} rx={size * 0.2} ry={size * 0.07} {...base} transform={`rotate(6 ${size / 2 + 4} ${size - 22})`} />
        <ellipse cx={size / 2 - 6} cy={size - 31} rx={size * 0.15} ry={size * 0.06} {...base} transform={`rotate(-10 ${size / 2 - 6} ${size - 31})`} />
      </>
    ),
    halo: (
      <>
        <circle cx={size / 2} cy={size / 2 + 2} r={4} fill={accent} opacity="0.9" />
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const r = size * 0.3;
          const cx = size / 2 + Math.cos((deg * Math.PI) / 180) * r;
          const cy = size / 2 + 2 + Math.sin((deg * Math.PI) / 180) * r;
          return <circle key={deg} cx={cx} cy={cy} r={2.5} fill={color} opacity="0.7" />;
        })}
      </>
    ),
    capstone: (
      <>
        <ellipse cx={size / 2} cy={size - 11} rx={size * 0.3} ry={size * 0.085} {...base} />
        <ellipse cx={size / 2} cy={size - 22} rx={size * 0.22} ry={size * 0.07} {...base} />
        <circle cx={size / 2 - 8} cy={size - 32} r={4} fill={accent} />
        <circle cx={size / 2} cy={size - 34} r={4.5} fill={accent} />
        <circle cx={size / 2 + 8} cy={size - 32} r={4} fill={accent} />
      </>
    ),
    pair: (
      <>
        <ellipse cx={size / 2 - 11} cy={size - 12} rx={size * 0.16} ry={size * 0.06} {...base} />
        <ellipse cx={size / 2 - 11} cy={size - 21} rx={size * 0.12} ry={size * 0.05} {...base} />
        <circle cx={size / 2 - 11} cy={size - 28} r={2.5} fill={accent} />
        <ellipse cx={size / 2 + 11} cy={size - 12} rx={size * 0.16} ry={size * 0.06} {...base} />
        <ellipse cx={size / 2 + 11} cy={size - 21} rx={size * 0.12} ry={size * 0.05} {...base} />
        <circle cx={size / 2 + 11} cy={size - 28} r={2.5} fill={accent} />
      </>
    ),
    scattered: (
      <>
        <ellipse cx={size / 2 - 14} cy={size - 12} rx={6} ry={3} {...base} />
        <ellipse cx={size / 2 + 12} cy={size - 12} rx={5} ry={2.5} {...base} />
        <ellipse cx={size / 2 - 4} cy={size - 20} rx={5} ry={2.5} {...base} transform={`rotate(15 ${size / 2 - 4} ${size - 20})`} />
        <ellipse cx={size / 2 + 8} cy={size - 26} rx={4} ry={2} {...base} transform={`rotate(-12 ${size / 2 + 8} ${size - 26})`} />
        <circle cx={size / 2 + 2} cy={size - 32} r={2.5} fill={accent} opacity="0.7" />
      </>
    ),
    distant: (
      <>
        <line x1={4} y1={size - 16} x2={size - 4} y2={size - 16} stroke={color} strokeWidth="0.8" opacity="0.4" />
        <ellipse cx={size / 2} cy={size - 18} rx={size * 0.12} ry={size * 0.045} {...base} />
        <ellipse cx={size / 2} cy={size - 25} rx={size * 0.08} ry={size * 0.035} {...base} />
        <circle cx={size / 2} cy={size - 31} r={2.5} fill={accent} />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {arrangements[kind]}
    </svg>
  );
};

// ---------- Text helpers ----------
export function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// First `count` sentences of a (possibly HTML) body, cleaned up.
export function firstSentences(raw: string, count = 2): string {
  const text = stripHtml(raw || '');
  if (!text) return '';
  const parts = text.match(/[^.!?]+[.!?]+/g);
  if (!parts) return text;
  return parts.slice(0, count).join(' ').trim();
}

// Pull up to `max` bullet items out of a section body. Handles <li> tags and
// markdown-style "- " / "• " lines. Returns [] when none are found — callers
// hide the block rather than fabricate bullets.
export function extractBullets(raw: string, max = 3): string[] {
  if (!raw) return [];
  const items: string[] = [];

  const liMatches = raw.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
  if (liMatches) {
    for (const li of liMatches) {
      const clean = stripHtml(li);
      if (clean) items.push(clean);
    }
  }

  if (items.length === 0) {
    const lines = stripHtml(raw)
      .split(/\n|(?=•)|(?:^|\s)[-–]\s/)
      .map((l) => l.replace(/^[•\-–]\s*/, '').trim())
      .filter(Boolean);
    // Only treat as a bullet list when the body actually has bullet markers.
    if (/<li|•|(?:^|\n)\s*[-–]\s/.test(raw)) {
      items.push(...lines);
    }
  }

  return items.filter((i) => i.length > 3 && i.length < 200).slice(0, max);
}

// ---------- Subsection extraction ----------
// Find the content under a specific heading in a section body. Career bodies
// use <h3>/<h4>/<h5> tags like "Why this role fits you" or "Why this might be
// a fit". Returns the HTML between that heading and the next heading of the
// same-or-higher level. Pattern match is case-insensitive and loose so the
// caller can pass a few variants in one call.
export function extractSubsectionContent(
  body: string,
  headingPatterns: string[],
): string | null {
  if (!body || headingPatterns.length === 0) return null;
  const patterns = headingPatterns.map((p) => p.toLowerCase().trim());
  // Walk through all heading tags and find the first whose text matches.
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches: { level: number; text: string; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(body)) !== null) {
    matches.push({
      level: Number(m[1]),
      text: stripHtml(m[2]).toLowerCase(),
      index: m.index,
      length: m[0].length,
    });
  }
  if (matches.length === 0) return null;
  const hitIdx = matches.findIndex((h) => patterns.some((p) => h.text.includes(p)));
  if (hitIdx === -1) return null;
  const hit = matches[hitIdx];
  const start = hit.index + hit.length;
  // End at the next heading of the same-or-higher level (i.e. lower or equal
  // numeric level — <h3> ends at the next <h2>/<h3>, not the next <h4>).
  const next = matches.slice(hitIdx + 1).find((h) => h.level <= hit.level);
  const end = next ? next.index : body.length;
  return body.slice(start, end);
}

// A sentence that opens with a back-reference ("That's the thread running
// through your career.", "Not just products, but functions and teams.") reads
// as broken the moment it is lifted out of the body, because the thing it
// points at isn't on the share card or in the pull quote. Reject those.
// Dutch entries are limited to unambiguous connectives — "het" and "ze" are
// left out because they open perfectly good sentences as often as not.
const BACKREF_OPENERS =
  /^(?:that|this|these|those|it|they|such|both|either|neither|but|and|so|yet|nor|because|which|instead|also|still|again|meanwhile|however|moreover|therefore|not just|not only|dat|dit|die|deze|maar|dus|daarom|daardoor|daarnaast|bovendien|toch|niet alleen)\b/i;

// Leading list/quote/rule punctuation left over from the model's markdown
// ("--- A Director at a mid-size firm leads…"). Strip before judging.
const LEADING_JUNK = /^[\s\-–—*_>#•]+/;

// The sentence splitter cuts on the first '.', which lands inside quoted
// survey answers and leaves the quote hanging open ("…calling it "the best 3
// year project of my career."). An odd number of double quotes means exactly
// that, so drop the candidate and try the next sentence.
function hasUnbalancedQuotes(s: string): boolean {
  return ((s.match(/["“”]/g) || []).length % 2) === 1;
}

// Report prose occasionally cites the survey question it drew on ("the
// flexible schedule [2g] and family time [1n] you've said is essential").
// Fine inline, meaningless on a share card.
const SURVEY_REF = /\[\d+[a-z]\]/i;

// A negation with no positive half ("Your competitive edge is not your
// financial expertise.") states what the reader isn't and stops; the payoff is
// in the next sentence. Detected only when the sentence has no comma, since a
// comma is what carries the completed form ("…isn't creativity, it's structured
// empathy" / "You are drawn to construction, not maintenance").
const DANGLING_NEGATION = /\b(?:is|are|was|were)n['’]?t\b|\b(?:is|are|was|were)\s+not\b|['’](?:s|re)\s+not\b/i;

/** Close up the space HTML stripping leaves in front of punctuation. Tag
 *  boundaries inside a sentence ("…exist yet<strong>:</strong> not just…")
 *  flatten to "…exist yet : not just…", which reads as a typo in a pull
 *  quote. */
function tidyQuote(s: string): string {
  return s.replace(/\s+([,;:.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

/** Some older bodies carry no HTML headings at all: the subsection header is a
 *  bare short line followed by a blank line. stripHtml collapses that into the
 *  first sentence ("Je kernkwaliteiten in kaart Je denkt in grote lijnen."), so
 *  drop leading header-ish lines before flattening. A line ending in sentence
 *  punctuation is prose, not a header — stop there. */
function dropPlainTextHeadings(raw: string): string {
  let out = raw;
  for (let i = 0; i < 3; i++) {
    const m = out.match(/^\s*([^\n<]{1,80}?)[ \t]*\n\s*\n/);
    if (!m || /[.!?:;]$/.test(m[1].trim())) break;
    out = out.slice(m[0].length);
  }
  return out;
}

// Pick sentences usable as shareable quotes from a section body. Strips a
// known section-title prefix from the front when provided (otherwise the
// first "quote" ends up being literally the section heading bleeding into
// sentence 1, e.g. "Identifying Your Core Strengths You build things.").
// Returns 30-220 char sentences, deduped, capped at `max`.
export function pickShareSentences(
  body: string,
  sectionTitleToStrip: string | null = null,
  max = 4,
): string[] {
  // Drop subheaders first — otherwise stripHtml flattens them into the
  // following sentence (e.g. "Personality and Interaction Style You think…")
  // and the subheader bleeds into the shareable quote. All six levels, not
  // just <h5>: report bodies mostly use <h5> today but the career sections
  // have carried <h3>/<h4> in the past.
  let text = stripHtml(
    dropPlainTextHeadings(body || '').replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' '),
  );
  if (!text) return [];
  if (sectionTitleToStrip) {
    const title = stripHtml(sectionTitleToStrip).trim();
    if (title) {
      // Case-insensitive prefix strip when the body starts with the title.
      const re = new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:.\\-]?\\s*`, 'i');
      text = text.replace(re, '');
    }
  }
  const parts = (text.match(/[^.!?]+[.!?]+/g) || [text]).map((p) =>
    tidyQuote(p.replace(LEADING_JUNK, '')),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    let s = parts[i];
    // Pull the completing sentence in when this one only says what isn't true.
    if (DANGLING_NEGATION.test(s) && !s.includes(',') && parts[i + 1]) {
      const joined = `${s} ${parts[i + 1]}`;
      if (joined.length <= 220) {
        s = joined;
        i++; // consumed, so it doesn't reappear as its own candidate
      }
    }
    if (s.length < 30 || s.length > 220) continue;
    // Must read as the start of a sentence, and must stand on its own.
    if (!/^[\p{Lu}"'(]/u.test(s)) continue;
    if (BACKREF_OPENERS.test(s)) continue;
    if (hasUnbalancedQuotes(s)) continue;
    if (SURVEY_REF.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

// Every report section has one subsection that IS its punchline, and it is
// never the top of the body. Careers open with a neutral "what this role is"
// overview (quoting that yields "A Technical Writer turns complex software
// features into clear guides", a dictionary entry nobody would share), while
// the personality sections put the payoff under "Key Insight". Anchor the
// quote hunt on that subsection and the derived line stops being an accident.
//
// Heading coverage measured against all 28 live reports: "Key Insight" in
// 27/28 personality sections, "Why this role fits you" in 28/28 top careers,
// "Why this might be a fit" in 81/84 outside-the-box. Anything unmatched
// (including a Dutch report whose headings aren't HTML at all) falls through
// to the whole body, i.e. the previous behaviour.
// Each entry is a list of heading groups tried in order, so a section whose
// best subsection yields nothing usable drops to its next-best rather than
// straight back to the neutral overview at the top of the body.
const KEY_INSIGHT = ['key insight', 'kerninzicht', 'belangrijkste inzicht'];
const WHY_FITS = ['why this role fits you', 'why this fits you', 'waarom deze rol bij je past'];
const ALIGNMENT = ['alignment with your ambitions', 'aansluiting bij je ambities'];

export const SHARE_QUOTE_ANCHORS: Record<string, string[][]> = {
  strengths: [KEY_INSIGHT],
  values: [KEY_INSIGHT],
  approach: [KEY_INSIGHT],
  personality_team: [KEY_INSIGHT],
  development: [KEY_INSIGHT],
  exec_summary: [['professional identity', 'professionele identiteit']],
  executive_summary: [['professional identity', 'professionele identiteit']],
  top_career_1: [WHY_FITS, ALIGNMENT],
  top_career_2: [WHY_FITS, ALIGNMENT],
  top_career_3: [WHY_FITS, ALIGNMENT],
  runner_ups: [WHY_FITS, ALIGNMENT],
  dream_jobs: [WHY_FITS, ALIGNMENT],
  outside_box: [['why this might be a fit', 'why this could be a fit', 'why this role fits you'], ALIGNMENT],
};

/** Share-quote candidates for a section, best first. Works down the section's
 *  anchor subsections, then tops up from the rest of the body so the share
 *  card's carousel still has alternatives to cycle through. */
export function pickSectionShareQuotes(
  sectionType: string,
  content: string,
  sectionTitleToStrip: string | null = null,
  max = 4,
): string[] {
  const out: string[] = [];
  const add = (candidates: string[]) => {
    for (const s of candidates) {
      if (out.length >= max) return;
      if (!out.includes(s)) out.push(s);
    }
  };
  for (const group of SHARE_QUOTE_ANCHORS[sectionType] ?? []) {
    if (out.length >= max) break;
    // No title to strip: the anchored slice starts after its own heading.
    const anchored = extractSubsectionContent(content, group);
    if (anchored) add(pickShareSentences(anchored, null, max));
  }
  if (out.length < max) add(pickShareSentences(content, sectionTitleToStrip, max * 2));
  return out;
}
