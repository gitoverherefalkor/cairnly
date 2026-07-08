// V4 — the signed-in dashboard for a user whose assessment is complete and
// coach conversation is done. Ported from the handoff prototype (v4-final.jsx)
// and wired to live Supabase data.
//
// Section order: Welcome · Hero match + #2/#3 · More paths · Profile at a
// glance · Unlock toolkit · Share promo · Full report accordion.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { formatDate } from '@/lib/format';
import { Activity, ArrowRight, BookOpen, Briefcase, CheckCircle2, ChevronRight, Clock, Coins, FileText, FilePlus, Loader2, Lock, Map as MapIcon, Sparkles } from 'lucide-react';
import type { ReportSection } from '@/hooks/useReportSections';
import type { ResolvedFeature, ResolvedUnlockStep } from '@/hooks/useReferralStatus';
import { useCustomResumeList } from '@/components/custom-resume/hooks/useCustomResumeList';
import { useCoverLetterList } from '@/components/cover-letter/hooks/useCoverLetterList';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { extractAIImpact, type AIImpactLevel } from '@/components/chat/CareerScoreCard';
import { CareerSlotIcon, type CareerSlot } from '@/components/dashboard/CareerSlotIcon';
import { CareerComparisonRadar, type RadarCareer } from '@/components/career/CareerComparisonRadar';
import { DashboardAppNav } from './DashboardAppNav';
import { V4SavedResponses } from './V4SavedResponses';
import { V4ChartBanner } from './V4ChartBanner';
import { V4PersonalityRadarSVG, type RadarAxis } from './V4PersonalityRadarSVG';
import { V4CareerMapSVG, V4CareerMapLegend, type CareerPoint } from './V4CareerMapSVG';
import { V4CompareRadarSVG, V4CompareLegend, type CompareCareer } from './V4CompareRadarSVG';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
  Eyebrow,
  AIImpactPill,
  MovePill,
  MatchPill,
  type MoveLevel,
  SectionPhoto,
  SECTION_VISUALS,
  stripHtml,
  firstSentences,
  extractSubsectionContent,
  type CareerMatch,
} from './dashboardV2Shared';

// Convert the HTML tags the AI sometimes emits into Markdown so the accordion
// can render through one pipeline. Same shape as the chat / ExpandedSectionView
// converter — kept local to avoid pulling in the old report component graph.
function htmlToMarkdown(text: string): string {
  let r = text;
  // Headings need a leading blank line (so they break out of any preceding
  // paragraph) and a trailing blank line (so what follows is parsed as a new
  // block, e.g. a list).
  r = r.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n');
  r = r.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n\n#### $1\n\n');
  r = r.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n\n##### $1\n\n');
  r = r.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  r = r.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  r = r.replace(/<br\s*\/?>/gi, '\n');
  r = r.replace(/<p[^>]*>/gi, '\n\n').replace(/<\/p>/gi, '\n\n');
  // Lists: wrap each list block in blank lines, end every <li> with a newline
  // so react-markdown groups them into a single list.
  r = r.replace(/<ul[^>]*>/gi, '\n\n').replace(/<\/ul>/gi, '\n\n');
  r = r.replace(/<ol[^>]*>/gi, '\n\n').replace(/<\/ol>/gi, '\n\n');
  r = r.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  // Collapse runs of 3+ blank lines back to 2 so the output stays clean.
  r = r.replace(/\n{3,}/g, '\n\n');
  return r;
}

interface DashboardV4Props {
  firstName: string;
  country: string | null;
  reportId: string;
  reportGeneratedAt: string | null;
  sections: ReportSection[];
  // Async executive-summary state. WF7 writes the exec summary a few seconds
  // after chat wrap-up, so on first dashboard load it may not exist yet.
  // 'pending' = generating, 'arrived' = just landed (offer an Open button),
  // 'timedout' = took too long, null = nothing to show (already present).
  execSummaryStatus?: 'pending' | 'arrived' | 'timedout' | null;
  onOpenExecSummary?: () => void;
  referralCode: string | null;
  referralCount: number;
  features: ResolvedFeature[];
  ladder: ResolvedUnlockStep[];
  onNavigate: (route: string) => void;
  onProfile: () => void;
  onSignOut: () => void;
  onInvite: () => void;
  onOpenShareCard: () => void;
}

// ── Career extraction ─────────────────────────────────────────
function getMatch(
  sections: ReportSection[],
  type: string,
  rank: number,
  withDetail: boolean,
): CareerMatch | null {
  const s = sections.find((x) => x.section_type === type);
  if (!s) return null;
  const score = s.score != null ? Number(s.score) : NaN;
  if (!Number.isFinite(score)) return null;
  // Prefer the dedicated "Overview" subsection (one to two plain-English
  // sentences defining the role). Legacy reports without an Overview block
  // fall back to the opening sentences of the body.
  const overviewHtml = extractSubsectionContent(s.content || '', ['Overview']);
  const teaser = overviewHtml
    ? firstSentences(overviewHtml, 2)
    : firstSentences(s.content || '', 2);
  // Hero card supporting copy: first two sentences of the "Alignment with
  // your ambitions" section. Prose, not bullets — fits compactly under the
  // Overview without restating it.
  const alignmentHtml = withDetail
    ? extractSubsectionContent(s.content || '', ['Alignment with your ambitions'])
    : null;
  const alignment = alignmentHtml ? firstSentences(alignmentHtml, 2) : undefined;
  return {
    rank,
    title: stripHtml(s.title || 'Career match'),
    shape: s.company_size_type ? stripHtml(s.company_size_type) : null,
    matchPct: Math.round(score),
    aiImpact: extractAIImpact(s.content || ''),
    move: (s.metadata?.move as MoveLevel | undefined) ?? null,
    // Teaser shows on all three career cards. Alignment prose only on the Hero.
    teaser,
    alignment,
  };
}

// ── Report accordion model ────────────────────────────────────
interface CareerEntry {
  title: string;
  content: string;
}

interface ReportRow {
  id: string;
  title: string;
  oneLiner: string;
  // Single-section rows carry `content`; multi-career groupings (runners,
  // outside, dream) carry `careers` instead and render as tabs.
  content?: string;
  careers?: CareerEntry[];
  // Photo-chip key into SECTION_VISUALS for About-You rows.
  visualKey?: string;
  // Cairn-glyph slot for Career Suggestion rows — uses CareerSlotIcon on a
  // cream chip instead of a nature photograph.
  careerSlot?: CareerSlot;
  // Career-fit radar payload for top-2 / top-3 (where fit_scores +
  // comparison metadata are present). Plots this career against the
  // higher-ranked ones. Mirrors what the chat shows on each career section.
  comparison?: {
    headline: string;
    careers: RadarCareer[];
  };
}

// Generic, non-personalised descriptors.
const ONE_LINERS: Record<string, string> = {
  summary: 'Who you are professionally and what drives your career.',
  approach: 'How you work, lead, and navigate challenges.',
  strengths: 'What sets you apart and how to use it strategically.',
  development: 'Growth opportunities that will help you reach your goals.',
  values: 'What matters most to you and how it shapes the right fit.',
  'top-1': 'Your strongest match.',
  'top-2': 'Career #2 — a close second.',
  'top-3': 'Career #3 — also a strong fit.',
  runners: 'Strong alternatives worth a second look.',
  outside: 'Unconventional paths aligned with your interests.',
  dream: 'An honest reality check on your ideal career.',
};

const FALLBACK_TITLES: Record<string, string> = {
  summary: 'Executive Summary',
  approach: 'Your Approach',
  strengths: 'Your Strengths',
  development: 'Development Areas',
  values: 'Your (Career) Values',
  runners: 'Runner-up Careers',
  outside: 'Outside-the-Box Careers',
  dream: 'Dream Job Analysis',
};

// ── Component ─────────────────────────────────────────────────
export const DashboardV4: React.FC<DashboardV4Props> = ({
  firstName,
  country,
  reportId,
  reportGeneratedAt,
  sections,
  execSummaryStatus = null,
  onOpenExecSummary,
  referralCode,
  referralCount,
  features,
  ladder,
  onNavigate,
  onProfile,
  onSignOut,
  onInvite,
  onOpenShareCard,
}) => {
  const { i18n } = useTranslation();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const accordionRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Deep-link target for the Unlock Toolkit (invite hub). Locked-tool popups
  // on the Jobs page link here via /dashboard?focus=toolkit.
  const toolkitRef = useRef<HTMLDivElement | null>(null);

  // Arriving with ?focus=toolkit (e.g. from a locked-tool popup) scrolls the
  // invite toolkit into view once the dashboard has rendered.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('focus') !== 'toolkit') return;
    const t = setTimeout(() => {
      toolkitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => clearTimeout(t);
  }, []);

  // Open a specific accordion row from elsewhere on the dashboard (Hero,
  // secondary matches, More-paths tiles) and scroll it into view. The
  // requestAnimationFrame wait lets the expanded body lay out first so the
  // scroll lands on the opened row, not its still-collapsed footprint.
  const handleOpenSection = (id: string) => {
    setOpenSection(id);
    requestAnimationFrame(() => {
      const node = accordionRowRefs.current[id];
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const { hero, secondary } = useMemo(() => {
    const hero = getMatch(sections, 'top_career_1', 1, true);
    const second = getMatch(sections, 'top_career_2', 2, false);
    const third = getMatch(sections, 'top_career_3', 3, false);
    return { hero, secondary: [second, third].filter(Boolean) as CareerMatch[] };
  }, [sections]);

  // "More paths" — one tile per group. Each section_type repeats in the DB
  // (one row per career, split by WF4), so we collect ALL matching rows and
  // surface the career titles as a list on the tile. Tile prose used to be
  // the firstSentences of ONE arbitrary section, which mislead readers into
  // thinking the tile represented a single career.
  const paths = useMemo(() => {
    const build = (type: string, fallbackId: string) => {
      const matches = sections.filter((x) => x.section_type === type);
      if (matches.length === 0) return null;
      return {
        title: FALLBACK_TITLES[fallbackId],
        descriptor: ONE_LINERS[fallbackId],
        careers: matches.map((s) => stripHtml(s.title || 'Career')),
      };
    };
    return {
      runners: build('runner_ups', 'runners'),
      outside: build('outside_box', 'outside'),
      dream: build('dream_jobs', 'dream'),
    };
  }, [sections]);

  // Report accordion rows — only rows backed by real sections are shown.
  // /report is gone, so the accordion is the user's report: expanded rows
  // render full sanitized content, not a 3-sentence excerpt.
  const aboutRows = useMemo<ReportRow[]>(() => {
    const map: { id: string; types: string[] }[] = [
      { id: 'summary', types: ['exec_summary', 'executive_summary'] },
      { id: 'approach', types: ['approach', 'personality_team'] },
      { id: 'strengths', types: ['strengths'] },
      { id: 'development', types: ['development'] },
      { id: 'values', types: ['values'] },
    ];
    return map
      .map(({ id, types }) => {
        const s = sections.find((x) => types.includes(x.section_type));
        if (!s) return null;
        return {
          id,
          title: stripHtml(s.title || FALLBACK_TITLES[id]),
          oneLiner: ONE_LINERS[id],
          content: s.content || '',
        };
      })
      .filter(Boolean) as ReportRow[];
  }, [sections]);

  const careerRows = useMemo<ReportRow[]>(() => {
    const rows: ReportRow[] = [];
    // Top 3 — one accordion row per career so hero/secondary "Open" buttons
    // can target the specific career the user clicked.
    const topMap: {
      id: string;
      type: string;
      rank: 1 | 2 | 3;
      slot: CareerSlot;
    }[] = [
      { id: 'top-1', type: 'top_career_1', rank: 1, slot: 'primary' },
      { id: 'top-2', type: 'top_career_2', rank: 2, slot: 'second' },
      { id: 'top-3', type: 'top_career_3', rank: 3, slot: 'third' },
    ];
    // Colors match the chat's CareerComparisonCard so the radar reads
    // identically in both places.
    const RADAR_FOCAL_COLOR = '#0d9488';
    const RADAR_NON_FOCAL: Record<string, string> = {
      top_career_1: '#d97706',
      top_career_2: '#6366f1',
    };
    const TOP_TYPES = ['top_career_1', 'top_career_2', 'top_career_3'];

    for (const { id, type, slot } of topMap) {
      const s = sections.find((x) => x.section_type === type);
      if (!s) continue;

      // Build the comparison radar payload for top-2 and top-3 (where the
      // chat surfaces "How it differs from your other top role(s)").
      let comparison: ReportRow['comparison'];
      const focalIndex = TOP_TYPES.indexOf(type);
      const fit = s.metadata?.fit_scores;
      const cmp = s.metadata?.comparison;
      if (focalIndex >= 1 && fit && cmp) {
        const careersForRadar: RadarCareer[] = [];
        for (let i = 0; i <= focalIndex; i++) {
          const peerType = TOP_TYPES[i];
          const peer = sections.find((x) => x.section_type === peerType);
          const peerFit = peer?.metadata?.fit_scores;
          if (!peer || !peerFit) continue;
          const isFocal = peerType === type;
          careersForRadar.push({
            label: stripHtml(peer.title || `Career ${i + 1}`),
            scores: peerFit,
            color: isFocal ? RADAR_FOCAL_COLOR : RADAR_NON_FOCAL[peerType] ?? '#64748b',
            focal: isFocal,
          });
        }
        if (careersForRadar.length >= 2) {
          comparison = { headline: cmp.headline, careers: careersForRadar };
        }
      }

      rows.push({
        id,
        title: stripHtml(s.title || 'Career match'),
        oneLiner: ONE_LINERS[id],
        content: s.content || '',
        careerSlot: slot,
        comparison,
      });
    }

    // Runner-ups / outside-box / dream — these section_types repeat in the
    // DB (one row per career, split on ---CAREER_SPLIT--- by WF4). Collect
    // all matching sections per group and render as one accordion row with
    // inner tabs, one tab per career.
    const groups: { id: string; type: string; slot: CareerSlot }[] = [
      { id: 'runners', type: 'runner_ups', slot: 'runnerups' },
      { id: 'outside', type: 'outside_box', slot: 'outside' },
      { id: 'dream', type: 'dream_jobs', slot: 'dream' },
    ];
    for (const { id, type, slot } of groups) {
      const matches = sections.filter((x) => x.section_type === type);
      if (matches.length === 0) continue;
      rows.push({
        id,
        title: FALLBACK_TITLES[id],
        oneLiner: ONE_LINERS[id],
        careers: matches.map((s) => ({
          title: stripHtml(s.title || 'Career'),
          content: s.content || '',
        })),
        careerSlot: slot,
      });
    }
    return rows;
  }, [sections]);

  // ── Chart data builders ──────────────────────────────────────
  // Personality radar — read from the `approach` section's structured
  // metadata.personality_scores (5 axes, 1–10).
  const radarAxes = useMemo<RadarAxis[]>(() => {
    const approach = sections.find(
      (s) => s.section_type === 'approach' || s.section_type === 'personality_team',
    );
    const ps = approach?.metadata?.personality_scores;
    if (!ps) return [];
    const map: { key: string; label: string; short: string }[] = [
      { key: 'strategic_depth', label: 'Strategic Depth', short: 'Strategic\nDepth' },
      { key: 'execution_bias', label: 'Execution', short: 'Execution' },
      { key: 'people_intuition', label: 'People Intuition', short: 'People\nIntuition' },
      { key: 'ambiguity_tolerance', label: 'Ambiguity Tolerance', short: 'Ambiguity\nTolerance' },
      { key: 'recognition_pull', label: 'Recognition Pull', short: 'Recognition\nPull' },
    ];
    return map
      .map((m) => {
        const score = ps[m.key];
        if (typeof score !== 'number') return null;
        return { label: m.label, short: m.short, v: score / 10, score };
      })
      .filter(Boolean) as RadarAxis[];
  }, [sections]);

  // Career map points — top 3 colored bubbles + runner-ups as secondaries.
  // x = AI exposure on the clinical 5-level scale, spread across 0..1
  //   (Minimal 0.12 / Moderate 0.35 / High 0.58 / Severe 0.78 / Critical 0.92).
  // y = 1 - match%/100  (top of chart = strongest).
  const careerMapPoints = useMemo<CareerPoint[]>(() => {
    const xFor = (impact: AIImpactLevel | null): number => {
      switch (impact) {
        case 'Minimal':
          return 0.12;
        case 'Moderate':
          return 0.35;
        case 'High':
          return 0.58;
        case 'Severe':
          return 0.78;
        case 'Critical':
          return 0.92;
        default:
          return 0.5;
      }
    };
    const points: CareerPoint[] = [];

    const tops: { type: string; rank: 1 | 2 | 3 }[] = [
      { type: 'top_career_1', rank: 1 },
      { type: 'top_career_2', rank: 2 },
      { type: 'top_career_3', rank: 3 },
    ];
    for (const { type, rank } of tops) {
      const s = sections.find((x) => x.section_type === type);
      if (!s) continue;
      const score = s.score != null ? Number(s.score) : NaN;
      if (!Number.isFinite(score)) continue;
      const impact = extractAIImpact(s.content || '');
      points.push({
        x: xFor(impact),
        y: 1 - score / 100,
        label: stripHtml(s.title || `Career ${rank}`),
        rank,
      });
    }

    // Runner-ups as secondaries — repeating section_type with one career each.
    const runners = sections.filter((x) => x.section_type === 'runner_ups');
    for (const s of runners) {
      const score = s.score != null ? Number(s.score) : NaN;
      if (!Number.isFinite(score)) continue;
      const impact = extractAIImpact(s.content || '');
      points.push({
        x: xFor(impact),
        y: 1 - score / 100,
        label: stripHtml(s.title || 'Runner-up'),
      });
    }

    return points;
  }, [sections]);

  // Comparison radar payloads. Two shapes for two consumers:
  //  - compareCareers: tuple-array form for the front-face V4CompareRadarSVG
  //    (the small at-a-glance preview).
  //  - compareCareersRich: object form for the back-face CareerComparisonRadar
  //    (the larger detail view with per-axis hover tooltips). Colours match
  //    front-face ranking so polygons don't change identity through the flip.
  const RADAR_COLORS: Record<1 | 2 | 3, string> = {
    1: '#d97706', // amber
    2: '#6366f1', // indigo
    3: '#0d9488', // teal
  };
  const compareCareers = useMemo<CompareCareer[]>(() => {
    const out: CompareCareer[] = [];
    const tops: { type: string; rank: 1 | 2 | 3 }[] = [
      { type: 'top_career_1', rank: 1 },
      { type: 'top_career_2', rank: 2 },
      { type: 'top_career_3', rank: 3 },
    ];
    for (const { type, rank } of tops) {
      const s = sections.find((x) => x.section_type === type);
      const f = s?.metadata?.fit_scores;
      if (!s || !f) continue;
      const norm = (n: number) => Math.max(0, Math.min(1, n / 5));
      const tuple: [number, number, number, number, number] = [
        norm(f.autonomy),
        norm(f.stability),
        norm(f.schedule),
        norm(f.pace),
        norm(f.social),
      ];
      out.push({ rank, label: stripHtml(s.title || `Career ${rank}`), scores: tuple });
    }
    return out;
  }, [sections]);

  const compareCareersRich = useMemo<RadarCareer[]>(() => {
    const out: RadarCareer[] = [];
    const tops: { type: string; rank: 1 | 2 | 3 }[] = [
      { type: 'top_career_1', rank: 1 },
      { type: 'top_career_2', rank: 2 },
      { type: 'top_career_3', rank: 3 },
    ];
    for (const { type, rank } of tops) {
      const s = sections.find((x) => x.section_type === type);
      const f = s?.metadata?.fit_scores;
      if (!s || !f) continue;
      out.push({
        label: stripHtml(s.title || `Career ${rank}`),
        scores: f,
        color: RADAR_COLORS[rank],
        focal: rank === 1,
      });
    }
    return out;
  }, [sections]);

  // Personality stat — names only, no numeric value. With a 1–10 integer
  // scale across 5 axes the digits tie too often to be meaningful; the
  // banner instead names the dimension(s) carrying the strongest signal.
  const radarLeadStat = useMemo<{ label: string } | null>(() => {
    if (radarAxes.length === 0) return null;
    const max = Math.max(...radarAxes.map((a) => a.score));
    const leads = radarAxes.filter((a) => Math.abs(a.score - max) < 0.05);

    if (leads.length === radarAxes.length) {
      return { label: `Balanced across all ${radarAxes.length} dimensions.` };
    }
    const names = leads.map((a) => a.label);
    if (leads.length === 1) {
      return { label: `Strongest dimension: ${names[0]}.` };
    }
    if (leads.length === 2) {
      return { label: `Strongest dimensions: ${names[0]} and ${names[1]}.` };
    }
    // 3+ leaders — comma list with Oxford-style "and" on the last item.
    const head = names.slice(0, -1).join(', ');
    const tail = names[names.length - 1];
    return { label: `Strongest dimensions: ${head}, and ${tail}.` };
  }, [radarAxes]);
  const sweetSpotCount = useMemo(
    () => careerMapPoints.filter((p) => p.x <= 0.5 && p.y <= 0.5 && p.rank).length,
    [careerMapPoints],
  );

  const jobsFeature = features.find((f) => f.key === 'jobs');
  const jobsUnlocked = jobsFeature?.unlocked ?? false;

  const resumeFeature = features.find((f) => f.key === 'resume');
  const resumeUnlocked = resumeFeature?.unlocked ?? false;

  // Per-career "Find open roles" navigation. Always lands on the filter page
  // (mode=search) so the user re-runs the search instead of seeing stale prior
  // results that may not even include the role they just clicked. When a
  // careerTitle is provided (per-card click), the filter page pre-selects that
  // career and clears any previous picks for a focused start.
  const handleFindRoles = (careerTitle?: string) => {
    if (!jobsUnlocked) {
      onInvite();
      return;
    }
    const params = new URLSearchParams({ mode: 'search' });
    if (careerTitle) params.set('career', careerTitle);
    onNavigate(`/jobs?${params.toString()}`);
  };

  // Per-career "Tailor CV" navigation. Locked features bounce to the invite
  // modal, same pattern as jobs. The CV page reads `career` from the URL so
  // the picker can pre-select the right role on arrival.
  const handleTailorCV = (careerTitle?: string) => {
    if (!resumeUnlocked) {
      onInvite();
      return;
    }
    const params = new URLSearchParams();
    if (careerTitle) params.set('career', careerTitle);
    const query = params.toString();
    onNavigate(query ? `/custom-resume?${query}` : '/custom-resume');
  };

  const reportDate = reportGeneratedAt
    ? formatDate(reportGeneratedAt, i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <LakeBackground intensity="normal">
      <DashboardAppNav firstName={firstName} onProfile={onProfile} onSignOut={onSignOut} />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '48px 32px 80px' }}>
        {/* ─── Welcome ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 40,
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Eyebrow>YOUR CAREER PROFILE · REPORT READY</Eyebrow>
            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 56,
                letterSpacing: '-0.03em',
                color: '#fff',
                margin: '12px 0 8px 0',
                lineHeight: 1.0,
              }}
            >
              Welcome back, {firstName || 'there'}.
            </h1>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 17,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.75)',
                maxWidth: 600,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Your strongest career matches are below. Open any one for the full breakdown, then find live
              openings when you're ready.
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              alignItems: 'flex-end',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: FONT_BODY,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {reportDate && <span>Report generated · {reportDate}</span>}
            <span>{['Profile', firstName, country].filter(Boolean).join(' · ')}</span>
          </div>
        </div>

        {/* ─── Executive summary status banner (async WF7) ─── */}
        <ExecSummaryBanner status={execSummaryStatus} onOpen={onOpenExecSummary} />

        {/* ─── HERO + secondary stack ─── */}
        {hero && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: secondary.length > 0 ? '1.65fr 1fr' : '1fr',
              gap: 24,
              marginBottom: 24,
            }}
          >
            <HeroMatch
              match={hero}
              onOpenBreakdown={() => handleOpenSection('top-1')}
              onFindRoles={handleFindRoles}
              onTailorCV={handleTailorCV}
              jobsUnlocked={jobsUnlocked}
              resumeUnlocked={resumeUnlocked}
              compareCareers={compareCareers}
              compareCareersRich={compareCareersRich}
            />
            {secondary.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {secondary.map((m) => (
                  <SecondaryMatch
                    key={m.rank}
                    match={m}
                    onOpen={() => handleOpenSection(`top-${m.rank}`)}
                    onFindRoles={handleFindRoles}
                    jobsUnlocked={jobsUnlocked}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Share promo (sits right under the top-3 row) ─── */}
        <SharePromoBlock heroTitle={hero?.title ?? 'Your best-fit career'} heroShape={hero?.shape ?? null} heroPct={hero?.matchPct ?? 0} onGenerate={onOpenShareCard} />

        {/* ─── More paths ─── */}
        {(paths.runners || paths.outside || paths.dream) && (
          <section style={{ marginTop: 16, marginBottom: 48 }}>
            <div style={{ marginBottom: 16 }}>
              <Eyebrow>MORE PATHS WORTH CONSIDERING</Eyebrow>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {paths.runners && (
                <PathsTile
                  slot="runnerups"
                  title={paths.runners.title}
                  descriptor={paths.runners.descriptor}
                  accent={PALETTE.teal}
                  careers={paths.runners.careers}
                  onOpen={() => handleOpenSection('runners')}
                />
              )}
              {paths.outside && (
                <PathsTile
                  slot="outside"
                  title={paths.outside.title}
                  descriptor={paths.outside.descriptor}
                  accent={PALETTE.goldBright}
                  careers={paths.outside.careers}
                  onOpen={() => handleOpenSection('outside')}
                />
              )}
              {paths.dream && (
                <PathsTile
                  slot="dream"
                  title={paths.dream.title}
                  descriptor={paths.dream.descriptor}
                  accent={PALETTE.blue}
                  careers={paths.dream.careers}
                  onOpen={() => handleOpenSection('dream')}
                />
              )}
            </div>
          </section>
        )}

        {/* "Profile at a glance" row removed — the personality radar and
            career map are now full-width banner headers for each report
            group below. */}

        {/* ─── Unlock toolkit ─── */}
        <div ref={toolkitRef} style={{ scrollMarginTop: 16 }}>
          <UnlockToolkit
            referralCode={referralCode}
            referralCount={referralCount}
            ladder={ladder}
            onInvite={onInvite}
            onNavigate={onNavigate}
          />
        </div>

        {/* ─── Full report header ─── */}
        {(aboutRows.length > 0 || careerRows.length > 0) && (
          <div style={{ marginBottom: 20 }}>
            <Eyebrow>YOUR FULL REPORT · REFERENCE</Eyebrow>
            <h3
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: '-0.02em',
                color: '#fff',
                margin: '8px 0 4px 0',
              }}
            >
              Everything you walked through with your coach
            </h3>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 14,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.6)',
                margin: 0,
                maxWidth: 540,
              }}
            >
              Closed by default. You've already been here, so open any section to revisit.
            </p>
          </div>
        )}

        {/* ─── About you — single container, accordion left, chart right ─── */}
        {aboutRows.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div
              style={{
                background: 'rgba(18, 46, 59, 0.62)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 30px 60px -24px rgba(0,0,0,0.5)',
                display: 'grid',
                gridTemplateColumns:
                  radarAxes.length > 0 ? 'minmax(0, 1.4fr) minmax(280px, 1fr)' : '1fr',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ padding: '22px 28px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <Eyebrow>ABOUT YOU · {aboutRows.length} SECTION{aboutRows.length === 1 ? '' : 'S'}</Eyebrow>
                </div>
                {(execSummaryStatus === 'pending' || execSummaryStatus === 'timedout') && (
                  <ExecSummaryPlaceholderRow status={execSummaryStatus} />
                )}
                {aboutRows.map((row, i) => (
                  <ReportAccordionRow
                    key={row.id}
                    row={row}
                    isOpen={openSection === row.id}
                    isLast={i === aboutRows.length - 1}
                    onToggle={() => setOpenSection(openSection === row.id ? null : row.id)}
                    registerRef={(node) => {
                      accordionRowRefs.current[row.id] = node;
                    }}
                  />
                ))}
              </div>

              {radarAxes.length > 0 && (
                <div style={{ padding: 20, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ position: 'sticky', top: 24 }}>
                    <V4ChartBanner
                      layout="vertical"
                      eyebrow="PERSONALITY RADAR"
                      icon={<Activity size={14} />}
                      title="How you actually work"
                      blurb="Your operating profile across five dimensions, built from the assessment and pressure-tested by your coach."
                      meta={`${radarAxes.length} axes`}
                      stat={radarLeadStat ?? undefined}
                      chart={<V4PersonalityRadarSVG axes={radarAxes} />}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Saved coaching responses from the "about you" chapter, tucked under
            its report sections. Renders nothing if none saved. */}
        <V4SavedResponses reportId={reportId} chapter="about-you" />

        {/* ─── Career suggestions — single container, accordion left, map right ─── */}
        {careerRows.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            <div
              style={{
                background: 'rgba(18, 46, 59, 0.62)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 30px 60px -24px rgba(0,0,0,0.5)',
                display: 'grid',
                gridTemplateColumns:
                  careerMapPoints.length > 0 ? 'minmax(0, 1.4fr) minmax(280px, 1fr)' : '1fr',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    padding: '22px 28px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(39,161,161,0.04)',
                  }}
                >
                  <Eyebrow>CAREER SUGGESTIONS · {careerRows.length} SECTION{careerRows.length === 1 ? '' : 'S'}</Eyebrow>
                </div>
                {careerRows.map((row, i) => (
                  <ReportAccordionRow
                    key={row.id}
                    row={row}
                    isOpen={openSection === row.id}
                    isLast={i === careerRows.length - 1}
                    onToggle={() => setOpenSection(openSection === row.id ? null : row.id)}
                    registerRef={(node) => {
                      accordionRowRefs.current[row.id] = node;
                    }}
                  />
                ))}
              </div>

              {careerMapPoints.length > 0 && (
                <div style={{ padding: 20, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ position: 'sticky', top: 24 }}>
                    <V4ChartBanner
                      layout="vertical"
                      eyebrow="CAREER MAP"
                      icon={<MapIcon size={14} />}
                      title="Where the matches sit"
                      blurb="Your top roles plotted by match strength against AI-exposure risk. Sweet spot is top-left; bottom-right is the walk-away zone."
                      stat={
                        sweetSpotCount > 0
                          ? {
                              value: String(sweetSpotCount),
                              label: `top match${sweetSpotCount === 1 ? '' : 'es'} land in the safe-strong quadrant.`,
                            }
                          : undefined
                      }
                      legend={<V4CareerMapLegend points={careerMapPoints} />}
                      chart={<V4CareerMapSVG points={careerMapPoints} />}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Saved coaching responses from the career chapter, under its
            report sections. Renders nothing if none saved. */}
        <V4SavedResponses reportId={reportId} chapter="career" />
      </div>
    </LakeBackground>
  );
};

// ── Hero match (#1) ──────────────────────────────────────────
// Front-facing card with a permanent comparison radar in the bottom-right
// (no flip). Three actions stacked on the left: Why this fits / Find this
// role / Tailor CV to this role. The two right-hand actions gate on their
// respective feature flags and bounce to the invite modal when locked.
const HeroMatch: React.FC<{
  match: CareerMatch;
  jobsUnlocked: boolean;
  resumeUnlocked: boolean;
  onOpenBreakdown: () => void;
  onFindRoles: (careerTitle?: string) => void;
  onTailorCV: (careerTitle?: string) => void;
  compareCareers: CompareCareer[];
  compareCareersRich: RadarCareer[];
}> = ({
  match,
  jobsUnlocked,
  resumeUnlocked,
  onOpenBreakdown,
  onFindRoles,
  onTailorCV,
  compareCareers,
  compareCareersRich,
}) => {
  // Only render the radar when there's something to compare against.
  const showRadar = compareCareers.length >= 2;
  // Hovering the small radar panel flips the WHOLE Hero card to the detail
  // view on the back. The card stays flipped while the mouse is anywhere on
  // it; un-flips when the cursor leaves the card entirely. Scoping the flip
  // trigger to the radar (not the whole card) avoids accidental flips while
  // the user is just reading the alignment text or about to click a button.
  const [flipped, setFlipped] = useState(false);
  return (
    <article
      onMouseLeave={() => setFlipped(false)}
      style={{
        position: 'relative',
        perspective: 1600,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateAreas: '"stack"',
          transformStyle: 'preserve-3d',
          transition: 'transform 650ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── FRONT — the standard Hero card ── */}
        <div
          style={{
            gridArea: 'stack',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            position: 'relative',
            overflow: 'hidden',
            background: 'rgba(18, 46, 59, 0.62)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 28,
            padding: 36,
            boxShadow: '0 40px 80px -28px rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {/* Soft gold glow */}
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 320,
              height: 320,
              background: 'radial-gradient(circle, rgba(212,160,36,0.20) 0%, rgba(212,160,36,0) 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Eyebrow */}
          <Eyebrow>STRONGEST MATCH · CAREER #1</Eyebrow>

          {/* Title + shape */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 44,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                color: '#fff',
                margin: 0,
              }}
            >
              {match.title}
            </h2>
            {match.shape && (
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
                {match.shape}
              </div>
            )}
          </div>

          {/* Metric pills — Match · Readiness · AI risk, in one scannable row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <MatchPill pct={match.matchPct} />
            {match.move && <MovePill level={match.move} />}
            {match.aiImpact && <AIImpactPill label={match.aiImpact} />}
          </div>

          {match.teaser && (
            <p
              style={{
                fontFamily: FONT_BODY,
                fontWeight: 500,
                fontSize: 15.5,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.85)',
                margin: 0,
              }}
            >
              {match.teaser}
            </p>
          )}

          {(match.alignment || showRadar) && (
            <div
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'stretch',
                flexWrap: 'wrap',
                paddingTop: 4,
                marginTop: 'auto',
              }}
            >
              <div
                style={{
                  flex: '1 1 280px',
                  minWidth: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {match.alignment && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Eyebrow>ALIGNMENT WITH YOUR AMBITIONS</Eyebrow>
                    <p
                      style={{
                        fontFamily: FONT_BODY,
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: 'rgba(255,255,255,0.88)',
                        margin: '4px 0 0 0',
                      }}
                    >
                      {match.alignment}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 'auto' }}>
                  <div>
                    <button
                      type="button"
                      onClick={onOpenBreakdown}
                      style={{
                        background: PALETTE.teal,
                        color: '#fff',
                        border: 'none',
                        padding: '12px 20px',
                        borderRadius: 9999,
                        fontFamily: FONT_BODY,
                        fontWeight: 700,
                        fontSize: 14,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        boxShadow: '0 10px 24px -8px rgba(39,161,161,0.55)',
                      }}
                    >
                      Why this fits <ArrowRight size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onFindRoles(match.title)}
                      style={{
                        background: 'transparent',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.22)',
                        padding: '12px 18px',
                        borderRadius: 9999,
                        fontFamily: FONT_BODY,
                        fontWeight: 700,
                        fontSize: 13.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                      }}
                    >
                      {jobsUnlocked ? <Briefcase size={14} /> : <Lock size={14} />}
                      {jobsUnlocked ? 'Find this role' : 'Find this role · locked'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onTailorCV(match.title)}
                      style={{
                        background: 'transparent',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.22)',
                        padding: '12px 18px',
                        borderRadius: 9999,
                        fontFamily: FONT_BODY,
                        fontWeight: 700,
                        fontSize: 13.5,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                      }}
                    >
                      {resumeUnlocked ? <FileText size={14} /> : <Lock size={14} />}
                      {resumeUnlocked ? 'Tailor CV to this role' : 'Tailor CV · locked'}
                    </button>
                  </div>
                </div>
              </div>

              {showRadar && (
                <div
                  onMouseEnter={() => setFlipped(true)}
                  style={{
                    flex: '1 1 280px',
                    minWidth: 240,
                    background:
                      'radial-gradient(circle at 85% 15%, rgba(39,161,161,0.10), transparent 60%),' +
                      'radial-gradient(circle at 12% 90%, rgba(212,160,36,0.08), transparent 55%),' +
                      '#ECE4D2',
                    border: '1px solid rgba(201, 182, 144, 0.5)',
                    borderRadius: 20,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 10.5,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: PALETTE.tealDeep,
                    }}
                  >
                    How it compares · hover for detail
                  </span>
                  <V4CompareRadarSVG careers={compareCareers} focalRank={1} variant="compact" />
                  <V4CompareLegend careers={compareCareers} focalRank={1} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── BACK — full detail view, cream paper, big interactive radar ── */}
        {showRadar && (
          <div
            style={{
              gridArea: 'stack',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background:
                'radial-gradient(circle at 85% 15%, rgba(39,161,161,0.10), transparent 60%),' +
                'radial-gradient(circle at 12% 90%, rgba(212,160,36,0.08), transparent 55%),' +
                '#ECE4D2',
              border: '1px solid rgba(201, 182, 144, 0.5)',
              borderRadius: 28,
              padding: 36,
              boxShadow: '0 40px 80px -28px rgba(0,0,0,0.55)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: PALETTE.tealDeep,
                }}
              >
                HOW IT DIFFERS FROM YOUR OTHER TOP ROLES
              </span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, color: PALETTE.inkSoft }}>
                Hover an axis label to see what it measures
              </span>
            </div>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 13.5,
                fontWeight: 500,
                color: PALETTE.inkMuted,
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              Five axes that shape day-to-day fit. The filled polygon is your strongest match; the outlined
              polygons are your other top roles. Distance from the centre is the score on each axis.
            </p>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 320,
              }}
            >
              <CareerComparisonRadar careers={compareCareersRich} size={520} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {compareCareersRich.map((c, i) => (
                <span
                  key={c.label}
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: c.color,
                  }}
                >
                  {i + 1}. {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

// ── Secondary match (#2 / #3) ─────────────────────────────────
const SecondaryMatch: React.FC<{
  match: CareerMatch;
  onOpen: () => void;
  onFindRoles: (careerTitle?: string) => void;
  jobsUnlocked: boolean;
}> = ({ match, onOpen, onFindRoles, jobsUnlocked }) => (
  <article
    style={{
      background: 'rgba(18, 46, 59, 0.55)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 20,
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      flex: 1,
      boxShadow: '0 24px 50px -22px rgba(0,0,0,0.4)',
    }}
  >
    <Eyebrow>CAREER #{match.rank}</Eyebrow>
    <h3
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 22,
        letterSpacing: '-0.018em',
        lineHeight: 1.18,
        color: '#fff',
        margin: 0,
      }}
    >
      {match.title}
    </h3>
    {match.shape && (
      <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
        {match.shape}
      </div>
    )}
    {/* Metric pills — Match · Readiness · AI risk, in one scannable row */}
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <MatchPill pct={match.matchPct} />
      {match.move && <MovePill level={match.move} />}
      {match.aiImpact && <AIImpactPill label={match.aiImpact} />}
    </div>
    {match.teaser && (
      <p
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: 13.5,
          lineHeight: 1.5,
          color: 'rgba(255,255,255,0.78)',
          margin: 0,
        }}
      >
        {match.teaser}
      </p>
    )}
    <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
      <button
        type="button"
        onClick={onOpen}
        style={{
          flex: 1,
          background: 'rgba(39,161,161,0.16)',
          color: '#fff',
          border: '1px solid rgba(39,161,161,0.32)',
          padding: '8px 12px',
          borderRadius: 9999,
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 12.5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
      >
        Open <ArrowRight size={13} />
      </button>
      <button
        type="button"
        onClick={() => onFindRoles(match.title)}
        style={{
          flex: 1,
          background: 'transparent',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.18)',
          padding: '8px 12px',
          borderRadius: 9999,
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 12.5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
      >
        {jobsUnlocked ? <Briefcase size={13} /> : <Lock size={13} />}
        {jobsUnlocked ? 'Find roles' : 'Find roles · locked'}
      </button>
    </div>
  </article>
);

// ── Paths tile ────────────────────────────────────────────────
const PathsTile: React.FC<{
  slot: CareerSlot;
  title: string;
  descriptor: string;
  accent: string;
  careers: string[];
  onOpen: () => void;
}> = ({ slot, title, descriptor, accent, careers, onOpen }) => (
  <article
    style={{
      background: 'rgba(18, 46, 59, 0.55)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 18,
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      boxShadow: '0 16px 32px -16px rgba(0,0,0,0.4)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div
        style={{
          flexShrink: 0,
          width: 60,
          height: 60,
          borderRadius: 14,
          background: PALETTE.cream,
          border: `1px solid ${PALETTE.tan}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CareerSlotIcon slot={slot} size={36} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: '-0.01em',
            color: '#fff',
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: 13,
            lineHeight: 1.4,
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          {descriptor}
        </span>
      </div>
    </div>

    {careers.length > 0 && (
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flex: 1,
        }}
      >
        {careers.map((c, i) => (
          <li
            key={`${c}-${i}`}
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 500,
              fontSize: 13.5,
              lineHeight: 1.4,
              color: 'rgba(255,255,255,0.82)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: accent, flexShrink: 0 }}>•</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
    )}

    <button
      type="button"
      onClick={onOpen}
      style={{
        background: 'transparent',
        border: 'none',
        color: accent,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 13,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        padding: 0,
        marginTop: 4,
        alignSelf: 'flex-start',
      }}
    >
      See full breakdown <ArrowRight size={14} />
    </button>
  </article>
);

// ── Unlock toolkit ────────────────────────────────────────────
// Icons + CTA labels for the three tool steps (refund steps render a % badge
// instead of an icon, handled inline below).
const TOOL_META: Record<string, { label: string; icon: React.ReactNode }> = {
  jobs: { label: 'Find open roles', icon: <Briefcase size={18} /> },
  resume: { label: 'Tailor your resume', icon: <FileText size={18} /> },
  'cover-letter': { label: 'Generate cover letters', icon: <FilePlus size={18} /> },
};

const UnlockToolkit: React.FC<{
  referralCode: string | null;
  referralCount: number;
  ladder: ResolvedUnlockStep[];
  onInvite: () => void;
  onNavigate: (route: string) => void;
}> = ({ referralCode, referralCount, ladder, onInvite, onNavigate }) => {
  const earned = Math.min(referralCount, 6);
  const fullyRefunded = referralCount >= 6;
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(212,160,36,0.18) 0%, rgba(39,161,161,0.12) 100%)',
          border: '1px solid rgba(212,160,36,0.40)',
          borderRadius: 24,
          padding: 28,
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 240,
            height: 240,
            background: 'radial-gradient(circle, rgba(212,160,36,0.22) 0%, rgba(212,160,36,0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 32,
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div>
            <Eyebrow>JOB-HUNT TOOLKIT · EARN YOUR MONEY BACK</Eyebrow>
            <h3
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: '-0.02em',
                color: '#fff',
                margin: '10px 0 8px 0',
              }}
            >
              Six friends, and your assessment paid for itself.
            </h3>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontWeight: 500,
                fontSize: 14.5,
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.78)',
                margin: 0,
                maxWidth: 540,
              }}
            >
              Your first three friends unlock the job-hunt tools. The next three
              refund your purchase, <em style={{ fontStyle: 'normal', color: PALETTE.goldBright, fontWeight: 700 }}>25% + 25% + 50%</em>, back
              to your card. They get clarity, you get paid back.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 280 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: FONT_BODY,
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>{earned} of 6 friends joined</span>
              <span style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 9999, overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    width: `${(earned / 6) * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${PALETTE.gold} 0%, ${PALETTE.goldBright} 100%)`,
                  }}
                />
              </span>
              {fullyRefunded && (
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: PALETTE.canvasDeep,
                    background: PALETTE.goldBright,
                    padding: '3px 9px',
                    borderRadius: 9999,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  All unlocked 🎉
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div
                style={{
                  background: 'rgba(0,0,0,0.20)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 9999,
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: 1,
                }}
              >
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Code
                </span>
                <span
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 16,
                    fontWeight: 700,
                    color: PALETTE.goldBright,
                    letterSpacing: '0.12em',
                  }}
                >
                  {referralCode ?? '· · ·'}
                </span>
              </div>
              <button
                type="button"
                onClick={onInvite}
                style={{
                  background: PALETTE.gold,
                  color: PALETTE.canvasDeep,
                  border: 'none',
                  padding: '12px 22px',
                  borderRadius: 9999,
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: 13.5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 10px 24px -8px rgba(212,160,36,0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                Invite <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Two compact rows: tools (1–3) on top, refunds (4–6) below. Each row
          flows left-to-right with arrows that light up as steps unlock. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <LadderRow label="Tools" items={ladder.slice(0, 3)} onInvite={onInvite} onNavigate={onNavigate} />
        <LadderRow label="Money back" items={ladder.slice(3, 6)} onInvite={onInvite} onNavigate={onNavigate} />
      </div>
    </section>
  );
};

// One row of the unlock ladder (3 step cards + flow-arrows between them),
// with a small heading above. Cards stay flush with the rest of the dashboard
// width — the label sits above, not beside, so nothing shifts the grid.
const LadderRow: React.FC<{
  label: string;
  items: ResolvedUnlockStep[];
  onInvite: () => void;
  onNavigate: (route: string) => void;
}> = ({ label, items, onInvite, onNavigate }) => (
  <div>
    <div
      style={{
        fontFamily: FONT_BODY,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.45)',
        marginBottom: 8,
        paddingLeft: 2,
      }}
    >
      {label}
    </div>
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
      {items.map((item, i) => (
        <React.Fragment key={`${item.step.kind}-${item.step.requiredReferrals}`}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
            <StepCard item={item} onInvite={onInvite} onNavigate={onNavigate} />
          </div>
          {i < items.length - 1 && <FlowArrow lit={items[i + 1].unlocked} />}
        </React.Fragment>
      ))}
    </div>
  </div>
);

// Gold flow-arrow between unlock cards. Lights up once the card to its RIGHT
// is unlocked, so the trail fills in left-to-right as the user refers friends.
const FlowArrow: React.FC<{ lit: boolean }> = ({ lit }) => (
  <div
    style={{
      flexShrink: 0,
      width: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: lit ? PALETTE.goldBright : 'rgba(255,255,255,0.20)',
      transition: 'color 0.3s ease',
    }}
    aria-hidden
  >
    <ChevronRight size={20} strokeWidth={2.5} />
  </div>
);

const StepCard: React.FC<{
  item: ResolvedUnlockStep;
  onInvite: () => void;
  onNavigate: (route: string) => void;
}> = ({ item, onInvite, onNavigate }) => {
  const { step, unlocked } = item;
  const isTool = step.kind === 'tool';
  const builtYet = isTool ? step.builtYet : true;
  const route = isTool ? step.route : undefined;
  const actionable = isTool && unlocked && builtYet && !!route;

  // Per-tool activity badge (teal, clickable): a simple count + noun that
  // links to where that work lives. All hooks are called unconditionally
  // (rules of hooks) but only the matching one is surfaced for this card.
  const { data: savedResumes } = useCustomResumeList();
  const { savedJobs } = useSavedJobs();
  const { data: coverLetters } = useCoverLetterList();

  let summaryCount = 0;
  let summaryNoun = '';
  let summaryRoute: string | null = null;
  if (isTool && unlocked && builtYet) {
    if (step.featureKey === 'resume') {
      summaryCount = savedResumes?.length ?? 0;
      summaryNoun = summaryCount === 1 ? 'optimized resume' : 'optimized resumes';
      summaryRoute = '/custom-resume';
    } else if (step.featureKey === 'jobs') {
      summaryCount = savedJobs?.length ?? 0;
      summaryNoun = summaryCount === 1 ? 'saved job' : 'saved jobs';
      summaryRoute = '/jobs?mode=saved';
    } else if (step.featureKey === 'cover-letter') {
      summaryCount = coverLetters?.length ?? 0;
      summaryNoun = summaryCount === 1 ? 'custom coverletter' : 'custom coverletters';
      summaryRoute = '/jobs?mode=saved';
    }
  }
  const showSummary = summaryCount > 0 && !!summaryRoute;

  // Status line under the title.
  const statusText = unlocked
    ? builtYet
      ? 'Unlocked!'
      : 'Unlocked · soon'
    : `Friend #${step.requiredReferrals}`;

  // Refund cards get a prominent gold outline + glow so the money tier draws
  // the eye, locked or not. Tool cards keep the quieter teal/tan treatment.
  const isRefund = step.kind === 'refund';
  const border = isRefund
    ? `1.5px solid ${PALETTE.goldBright}`
    : `1px solid ${unlocked ? 'rgba(39,161,161,0.35)' : PALETTE.tan}`;
  const boxShadow = isRefund
    ? '0 14px 28px -16px rgba(0,0,0,0.32), 0 0 0 3px rgba(212,160,36,0.16)'
    : '0 14px 28px -16px rgba(0,0,0,0.32)';

  // Refund cards pulse ONCE the first time they scroll into view, then settle
  // back to the static gold outline. IntersectionObserver fires the CSS class,
  // disconnects after the first trigger so it never repeats this session.
  const cardRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isRefund) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // rootMargin pulls the bottom of the observation zone up by 67% of the
    // viewport, so the card only counts as "in view" once it reaches the top
    // third of the screen — by then the user is looking right at it.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add('refund-pulse');
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -67% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isRefund]);

  return (
    <article
      ref={cardRef}
      style={{
        background: PALETTE.cream,
        borderRadius: 14,
        padding: '11px 12px',
        border,
        boxShadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        minWidth: 0,
        // Refund cards stay full-opacity even when locked — they're the carrot.
        opacity: isRefund ? 1 : unlocked ? 1 : 0.92,
      }}
    >
      {/* Icon / % badge + title + status — single compact header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 12,
            // Tools: gold when unlocked, grey when locked. Refunds: always a
            // teal "money" tint when unlocked, soft gold-tint coin when locked.
            background: isTool
              ? unlocked
                ? 'rgba(212,160,36,0.18)'
                : 'rgba(18,46,59,0.08)'
              : unlocked
                ? 'rgba(39,161,161,0.16)'
                : 'rgba(212,160,36,0.12)',
            color: isTool
              ? unlocked
                ? PALETTE.gold
                : PALETTE.inkSoft
              : unlocked
                ? PALETTE.tealDeep
                : PALETTE.gold,
            border: `1px solid ${
              isTool
                ? unlocked
                  ? 'rgba(212,160,36,0.45)'
                  : 'rgba(18,46,59,0.10)'
                : unlocked
                  ? 'rgba(39,161,161,0.32)'
                  : 'rgba(212,160,36,0.32)'
            }`,
            boxShadow: actionable ? '0 6px 16px -6px rgba(212,160,36,0.45)' : undefined,
          }}
        >
          {isTool ? (
            unlocked ? TOOL_META[step.featureKey].icon : <Lock size={14} />
          ) : (
            // Refund steps: coins icon in both states (the % is in the title;
            // the lock lives in the button below, no need to double up).
            <Coins size={16} />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 13,
              color: PALETTE.canvasDeep,
              lineHeight: 1.15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {step.title}
          </div>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 10,
              color: unlocked ? (isTool ? PALETTE.gold : PALETTE.tealDeep) : PALETTE.inkMuted,
              marginTop: 1,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {statusText}
          </div>
        </div>
      </div>

      {/* Short description — tool cards only; refund cards are self-evident
          and stay shorter to keep the money row tight. */}
      {isTool && (
        <p
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 500,
            fontSize: 11.5,
            color: PALETTE.inkMuted,
            lineHeight: 1.4,
            margin: 0,
            flex: 1,
          }}
        >
          {step.description}
        </p>
      )}

      {/* Per-tool activity badge (teal, clickable) — simple count + noun */}
      {showSummary ? (
        <button
          type="button"
          onClick={() => onNavigate(summaryRoute!)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 8px',
            background: 'rgba(39,161,161,0.10)',
            border: '1px solid rgba(39,161,161,0.28)',
            borderRadius: 9,
            minWidth: 0,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
          title={`View your ${summaryCount} ${summaryNoun}`}
        >
          <BookOpen size={12} color={PALETTE.tealDeep} style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              fontWeight: 600,
              color: PALETTE.canvasDeep,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <strong style={{ fontWeight: 700, color: PALETTE.tealDeep }}>{summaryCount}</strong> {summaryNoun}
          </span>
          <ChevronRight size={12} color={PALETTE.tealDeep} style={{ flexShrink: 0, marginLeft: 'auto' }} />
        </button>
      ) : null}

      {/* CTA — tools get an action / invite button; refunds show a quiet status */}
      {isTool ? (
        <button
          type="button"
          disabled={unlocked && !builtYet}
          onClick={() => {
            if (actionable) onNavigate(route!);
            else if (!unlocked) onInvite();
          }}
          style={{
            marginTop: 'auto',
            background: actionable ? PALETTE.gold : 'transparent',
            color: actionable
              ? PALETTE.canvasDeep
              : unlocked && !builtYet
                ? PALETTE.inkSoft
                : PALETTE.tealDeep,
            border: actionable
              ? '1px solid transparent'
              : `1px solid ${unlocked ? 'rgba(39, 161, 161, 0.45)' : PALETTE.teal}`,
            padding: '8px 10px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: actionable ? 800 : 700,
            fontSize: 11.5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: unlocked && !builtYet ? 'default' : 'pointer',
            boxShadow: actionable ? '0 10px 24px -8px rgba(212,160,36,0.55)' : undefined,
            opacity: unlocked && !builtYet ? 0.7 : 1,
          }}
        >
          {!unlocked && <Lock size={12} />}
          {actionable ? TOOL_META[step.featureKey].label : unlocked ? 'Coming soon' : 'Invite to unlock'}
          {actionable && <ArrowRight size={12} />}
        </button>
      ) : (
        <div
          style={{
            marginTop: 'auto',
            padding: '9px 10px',
            borderRadius: 9999,
            textAlign: 'center',
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 11.5,
            background: unlocked ? 'rgba(39,161,161,0.12)' : 'transparent',
            border: `1px solid ${unlocked ? 'rgba(39,161,161,0.40)' : 'rgba(18,46,59,0.14)'}`,
            color: unlocked ? PALETTE.tealDeep : PALETTE.inkSoft,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {unlocked ? '✓ Refund on its way' : <><Lock size={12} /> Refer friend #{step.requiredReferrals}</>}
        </div>
      )}
    </article>
  );
};

// ── Share promo block ─────────────────────────────────────────
const SharePromoBlock: React.FC<{
  heroTitle: string;
  heroShape: string | null;
  heroPct: number;
  onGenerate: () => void;
}> = ({ heroTitle, heroShape, heroPct, onGenerate }) => (
  <section
    style={{
      marginBottom: 48,
      background: 'rgba(18, 46, 59, 0.55)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderRadius: 24,
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 24px 50px -20px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
    }}
  >
    <div
      style={{
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        justifyContent: 'center',
        // Match the "share to unlock" toolkit element's gold-opacity background.
        background: 'linear-gradient(135deg, rgba(212,160,36,0.18) 0%, rgba(39,161,161,0.12) 100%)',
      }}
    >
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: PALETTE.goldBright,
        }}
      >
        SHAREABLE · LINKEDIN-READY
      </span>
      <h3
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: '-0.025em',
          color: '#fff',
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        Share what surprised you, not what flattered you.
      </h3>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.72)',
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        A short, honest card with one line your coach wrote about you. Cairn metaphor intact. Brings more
        friends to find their path, and unlocks your toolkit.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onGenerate}
          style={{
            background: PALETTE.teal,
            color: '#fff',
            border: 'none',
            padding: '12px 20px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 13.5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            boxShadow: '0 10px 22px -8px rgba(39,161,161,0.5)',
          }}
        >
          <Sparkles size={14} /> Generate share card
        </button>
        <button
          type="button"
          onClick={onGenerate}
          style={{
            background: 'transparent',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.22)',
            padding: '12px 18px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          Customise quote
        </button>
      </div>
    </div>
    <div style={{ position: 'relative', minHeight: 280, background: PALETTE.canvasDeep }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/dashboard/cairn_trail_landscape.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(0.88)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(18,46,59,0.55) 0%, rgba(18,46,59,0.92) 80%, ${PALETTE.canvasDeep} 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          color: '#fff',
        }}
      >
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 9,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: PALETTE.goldBright,
          }}
        >
          BEST-FIT CAREER · MY CAIRNLY MATCH
        </span>
        <h4
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            margin: '10px 0 8px 0',
            color: '#fff',
          }}
        >
          {heroTitle}
        </h4>
        {(heroShape || heroPct > 0) && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
            {[heroShape, heroPct > 0 ? `${heroPct}% match` : null].filter(Boolean).join(' · ')}
          </div>
        )}
        <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 9999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${heroPct}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${PALETTE.teal} 0%, ${PALETTE.goldBright} 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  </section>
);

// ── Executive summary status banner ──────────────────────────
// Surfaces the async WF7 exec-summary state at the top of the dashboard so a
// still-generating summary is never a silent gap. Renders nothing when the
// summary is already present (status null).
const ExecSummaryBanner: React.FC<{
  status: 'pending' | 'arrived' | 'timedout' | null | undefined;
  onOpen?: () => void;
}> = ({ status, onOpen }) => {
  if (!status) return null;

  const config = {
    pending: {
      icon: <Loader2 size={18} className="animate-spin" style={{ color: PALETTE.teal }} />,
      title: 'Putting together your executive summary…',
      body: 'The snapshot of your whole profile is generating now. It will appear here in a moment, no need to refresh.',
    },
    arrived: {
      icon: <CheckCircle2 size={18} style={{ color: PALETTE.teal }} />,
      title: 'Your executive summary is ready.',
      body: 'The high-level read of your career profile is done.',
    },
    timedout: {
      icon: <Clock size={18} style={{ color: '#d4a024' }} />,
      title: 'Your executive summary is taking a little longer than usual.',
      body: 'It is still being generated behind the scenes. Check back in a few minutes. The rest of your report is ready below.',
    },
  }[status];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
        padding: '16px 20px',
        background: 'rgba(18, 46, 59, 0.62)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        boxShadow: '0 20px 40px -24px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex' }}>{config.icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 2 }}>
          {config.title}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>
          {config.body}
        </div>
      </div>
      {status === 'arrived' && onOpen && (
        <button
          type="button"
          onClick={onOpen}
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 18px',
            background: PALETTE.teal,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Open <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
};

// Placeholder shown as the first "About You" accordion row while the exec
// summary is still generating (or timed out), so the slot where it lands is
// never empty. Non-interactive — it swaps for the real row once WF7 writes it.
const ExecSummaryPlaceholderRow: React.FC<{ status: 'pending' | 'timedout' }> = ({ status }) => {
  const pending = status === 'pending';
  return (
    <div
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {pending ? (
        <Loader2 size={18} className="animate-spin" style={{ color: PALETTE.teal, flexShrink: 0 }} />
      ) : (
        <Clock size={18} style={{ color: '#d4a024', flexShrink: 0 }} />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: 'rgba(255,255,255,0.92)' }}>
          Executive summary
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
          {pending
            ? 'Generating your snapshot… this appears automatically.'
            : 'Taking longer than usual. Check back shortly.'}
        </div>
      </div>
    </div>
  );
};

// ── Report accordion row ──────────────────────────────────────
const ReportAccordionRow: React.FC<{
  row: ReportRow;
  isOpen: boolean;
  isLast: boolean;
  onToggle: () => void;
  registerRef: (node: HTMLDivElement | null) => void;
}> = ({ row, isOpen, isLast, onToggle, registerRef }) => {
  const photo = !row.careerSlot ? SECTION_VISUALS[row.visualKey || row.id] : null;
  // Inner-tabs state for multi-career rows (runners, outside, dream).
  const [activeCareer, setActiveCareer] = useState(0);
  return (
    <div
      ref={registerRef}
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
        background: isOpen ? 'rgba(212,160,36,0.06)' : 'transparent',
        transition: 'background 200ms ease',
        scrollMarginTop: 80,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '20px 28px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {row.careerSlot ? (
          <CareerSlotChip slot={row.careerSlot} />
        ) : (
          <SectionPhoto src={photo?.src} position={photo?.position} hue={photo?.hue} size={72} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 19,
              letterSpacing: '-0.01em',
              color: '#fff',
              marginBottom: 4,
            }}
          >
            {row.title}
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 500, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
            {row.oneLiner}
          </div>
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 9999,
            background: isOpen ? PALETTE.goldBright : 'rgba(255,255,255,0.06)',
            color: isOpen ? PALETTE.canvasDeep : 'rgba(255,255,255,0.7)',
            border: `1px solid ${isOpen ? PALETTE.goldBright : 'rgba(255,255,255,0.14)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 200ms ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {isOpen && row.careers && row.careers.length > 0 && (
        <div className="cairnly-accordion-body" style={{ padding: '0 28px 28px 120px', maxWidth: 880 }}>
          <CareerTabs
            careers={row.careers}
            activeIndex={Math.min(activeCareer, row.careers.length - 1)}
            onSelect={setActiveCareer}
          />
          <AccordionContent
            content={row.careers[Math.min(activeCareer, row.careers.length - 1)].content}
          />
        </div>
      )}
      {isOpen && row.content && !row.careers && (
        <div
          className="cairnly-accordion-body"
          style={{ padding: '0 28px 28px 120px', maxWidth: 880 }}
        >
          <AccordionContent content={row.content} />
          {row.comparison && <CareerComparisonPanel comparison={row.comparison} />}
        </div>
      )}
    </div>
  );
};

// Cream paper panel wrapping the chat's CareerComparisonRadar — the radar's
// rings, spokes, and axis labels use light tones that need a cream surface
// behind them to read. Same component the chat uses, no theme overrides.
const CareerComparisonPanel: React.FC<{
  comparison: NonNullable<ReportRow['comparison']>;
}> = ({ comparison }) => {
  const heading =
    comparison.careers.length === 2
      ? 'How it differs from your other top role'
      : 'How it differs from your other top roles';
  return (
    <div
      style={{
        marginTop: 24,
        background: 'rgba(236, 228, 210, 0.94)',
        borderRadius: 20,
        padding: 24,
        border: '1px solid rgba(201, 182, 144, 0.5)',
        boxShadow: '0 18px 36px -16px rgba(0,0,0,0.35)',
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: PALETTE.tealDeep,
          marginBottom: 10,
        }}
      >
        {heading}
      </div>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14.5,
          fontWeight: 500,
          color: PALETTE.ink,
          lineHeight: 1.55,
          margin: '0 0 14px 0',
        }}
      >
        {comparison.headline}
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <CareerComparisonRadar careers={comparison.careers} size={380} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {comparison.careers.map((c, i) => (
          <span
            key={c.label}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              fontWeight: 700,
              color: c.color,
            }}
          >
            {i + 1}. {c.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// Cream chip carrying a cairn-glyph career icon — replaces the nature
// photograph for Career Suggestion rows.
const CareerSlotChip: React.FC<{ slot: CareerSlot }> = ({ slot }) => (
  <div
    style={{
      width: 72,
      height: 72,
      borderRadius: 12,
      flexShrink: 0,
      background: PALETTE.cream,
      border: `1px solid ${PALETTE.tan}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 10px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.4)',
    }}
  >
    <CareerSlotIcon slot={slot} size={44} />
  </div>
);

// Horizontal pill tabs shown inside the runner-up / outside-box / dream-jobs
// accordion rows. Each tab is one career.
const CareerTabs: React.FC<{
  careers: CareerEntry[];
  activeIndex: number;
  onSelect: (i: number) => void;
}> = ({ careers, activeIndex, onSelect }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 18,
      paddingBottom: 14,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    {careers.map((c, i) => {
      const active = i === activeIndex;
      return (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          style={{
            background: active ? PALETTE.goldBright : 'rgba(255,255,255,0.04)',
            color: active ? PALETTE.canvasDeep : 'rgba(255,255,255,0.78)',
            border: `1px solid ${active ? PALETTE.goldBright : 'rgba(255,255,255,0.12)'}`,
            padding: '7px 14px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 12.5,
            letterSpacing: '0.005em',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 10,
              opacity: active ? 0.7 : 0.5,
            }}
          >
            {i + 1}
          </span>
          {c.title}
        </button>
      );
    })}
  </div>
);

// Render the section content the same way ExpandedSectionView used to —
// HTML → markdown → DOMPurify → react-markdown. Styled for the dark-glass
// accordion (white type on rgba(18,46,59) background).
const ACCORDION_MD_COMPONENTS = {
  h3: ({ children, ...p }: any) => (
    <h3
      {...p}
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: '-0.015em',
        color: '#fff',
        margin: '18px 0 8px 0',
      }}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...p }: any) => (
    <h4
      {...p}
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: '-0.01em',
        color: '#fff',
        margin: '14px 0 6px 0',
      }}
    >
      {children}
    </h4>
  ),
  h5: ({ children, ...p }: any) => (
    <h5
      {...p}
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: PALETTE.goldBright,
        margin: '14px 0 6px 0',
      }}
    >
      {children}
    </h5>
  ),
  p: ({ children, ...p }: any) => (
    <p
      {...p}
      style={{
        fontFamily: FONT_BODY,
        fontSize: 14.5,
        fontWeight: 500,
        lineHeight: 1.6,
        color: 'rgba(255,255,255,0.85)',
        margin: '0 0 12px 0',
      }}
    >
      {children}
    </p>
  ),
  ul: ({ children, ...p }: any) => (
    <ul
      {...p}
      style={{
        paddingLeft: 22,
        margin: '6px 0 14px 0',
        listStyleType: 'disc',
        listStylePosition: 'outside',
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...p }: any) => (
    <ol
      {...p}
      style={{
        paddingLeft: 22,
        margin: '6px 0 14px 0',
        listStyleType: 'decimal',
        listStylePosition: 'outside',
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...p }: any) => (
    <li
      {...p}
      style={{
        fontFamily: FONT_BODY,
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.55,
        color: 'rgba(255,255,255,0.85)',
        marginBottom: 6,
      }}
    >
      {children}
    </li>
  ),
  strong: ({ children, ...p }: any) => (
    <strong {...p} style={{ color: '#fff', fontWeight: 700 }}>
      {children}
    </strong>
  ),
  em: ({ children, ...p }: any) => (
    <em {...p} style={{ color: 'rgba(255,255,255,0.9)' }}>
      {children}
    </em>
  ),
  a: ({ children, href, ...p }: any) => (
    <a
      {...p}
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      style={{ color: PALETTE.goldBright, textDecoration: 'underline' }}
    >
      {children}
    </a>
  ),
  hr: () => (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid rgba(255,255,255,0.10)',
        margin: '18px 0',
      }}
    />
  ),
};

const AccordionContent: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={ACCORDION_MD_COMPONENTS}>
    {DOMPurify.sanitize(htmlToMarkdown(content))}
  </ReactMarkdown>
);
