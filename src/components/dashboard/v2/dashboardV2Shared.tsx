// Shared primitives for the v2 dashboard redesign (handoff: Cairnly Dashboard v2).
// Ported from the design prototype's dashboard-shared.jsx — recreated as typed
// React components wired to the production asset paths under /public/dashboard.

import React from 'react';
import { Shield, Route } from 'lucide-react';
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
export const LAKE_BG_URL = '/images/trail_over_water.png';
export const CAIRN_TRAIL_URL = '/dashboard/cairn_trail_landscape.jpg';
export const LOGO_INVERTED_URL = '/dashboard/cairnly_logo_wordmark_inverted.png';
export const LOGO_WORDMARK_URL = '/dashboard/cairnly_logo_wordmark.png';

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

// ---------- Career match shape (no salary — omitted per product decision) ----------
export interface CareerMatch {
  rank: number;
  title: string;
  shape: string | null;
  matchPct: number;
  aiImpact: AIImpactLevel | null;
  move?: MoveLevel | null;
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
      <Shield size={11} color={color} /> AI · {label}
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
  // Drop <h5> subheaders first — otherwise stripHtml flattens them into the
  // following sentence (e.g. "Personality and Interaction Style You think…")
  // and the subheader bleeds into the shareable quote.
  let text = stripHtml((body || '').replace(/<h5[^>]*>[\s\S]*?<\/h5>/gi, ' '));
  if (!text) return [];
  if (sectionTitleToStrip) {
    const title = stripHtml(sectionTitleToStrip).trim();
    if (title) {
      // Case-insensitive prefix strip when the body starts with the title.
      const re = new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:.\\-]?\\s*`, 'i');
      text = text.replace(re, '');
    }
  }
  const parts = text.match(/[^.!?]+[.!?]+/g) || [text];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const s = raw.trim().replace(/\s+/g, ' ');
    if (s.length < 30 || s.length > 220) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
