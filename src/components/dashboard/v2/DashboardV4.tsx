// V4 — the signed-in dashboard for a user whose assessment is complete and
// coach conversation is done. Ported from the handoff prototype (v4-final.jsx)
// and wired to live Supabase data.
//
// Section order: Welcome · Hero match + #2/#3 · More paths · Profile at a
// glance · Unlock toolkit · Share promo · Full report accordion.

import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Activity, ArrowRight, BookOpen, Briefcase, FileText, FilePlus, Lock, Map as MapIcon, Sparkles } from 'lucide-react';
import type { ReportSection } from '@/hooks/useReportSections';
import type { ResolvedFeature } from '@/hooks/useReferralStatus';
import { useCustomResumeList } from '@/components/custom-resume/hooks/useCustomResumeList';
import { extractAIImpact, type AIImpactLevel } from '@/components/chat/CareerScoreCard';
import { CareerSlotIcon, type CareerSlot } from '@/components/dashboard/CareerSlotIcon';
import { CareerComparisonRadar, type RadarCareer } from '@/components/career/CareerComparisonRadar';
import { DashboardAppNav } from './DashboardAppNav';
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
  reportGeneratedAt: string | null;
  sections: ReportSection[];
  referralCode: string | null;
  referralCount: number;
  features: ResolvedFeature[];
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
  reportGeneratedAt,
  sections,
  referralCode,
  referralCount,
  features,
  onNavigate,
  onProfile,
  onSignOut,
  onInvite,
  onOpenShareCard,
}) => {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const accordionRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  // "More paths" — one teaser tile per group (handoff decision: production
  // stores each as a single free-text section, not a structured item list).
  const paths = useMemo(() => {
    const build = (type: string, fallbackId: string) => {
      const s = sections.find((x) => x.section_type === type);
      if (!s) return null;
      return {
        title: stripHtml(s.title || FALLBACK_TITLES[fallbackId]),
        teaser: firstSentences(s.content || '', 2),
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
  // x = AI exposure (Safe 0.15 / Augmented 0.45 / Transforming 0.7 / At Risk 0.9).
  // y = 1 - match%/100  (top of chart = strongest).
  const careerMapPoints = useMemo<CareerPoint[]>(() => {
    const xFor = (impact: AIImpactLevel | null): number => {
      switch (impact) {
        case 'Safe':
          return 0.18;
        case 'Augmented':
          return 0.45;
        case 'Transforming':
          return 0.7;
        case 'At Risk':
          return 0.88;
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

  // Comparison radar — top 3 careers with their fit_scores (1–5) on the five
  // work-life axes. Normalised to 0–1 for V4CompareRadarSVG.
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

  const reportDate = reportGeneratedAt
    ? new Date(reportGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
              jobsUnlocked={jobsUnlocked}
              compareCareers={compareCareers}
            />
            {secondary.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {secondary.map((m) => (
                  <SecondaryMatch
                    key={m.rank}
                    match={m}
                    onOpen={() => handleOpenSection(`top-${m.rank}`)}
                    onFindRoles={handleFindRoles}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── More paths ─── */}
        {(paths.runners || paths.outside || paths.dream) && (
          <section style={{ marginTop: 16, marginBottom: 48 }}>
            <div style={{ marginBottom: 16 }}>
              <Eyebrow>MORE PATHS WORTH CONSIDERING</Eyebrow>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {paths.runners && (
                <PathsTile title="Runner-up Careers" accent={PALETTE.teal} teaser={paths.runners.teaser} onOpen={() => handleOpenSection('runners')} />
              )}
              {paths.outside && (
                <PathsTile title="Outside-the-Box" accent={PALETTE.goldBright} teaser={paths.outside.teaser} onOpen={() => handleOpenSection('outside')} />
              )}
              {paths.dream && (
                <PathsTile title="Dream Job Analysis" accent={PALETTE.blue} teaser={paths.dream.teaser} onOpen={() => handleOpenSection('dream')} />
              )}
            </div>
          </section>
        )}

        {/* "Profile at a glance" row removed — the personality radar and
            career map are now full-width banner headers for each report
            group below. */}

        {/* ─── Unlock toolkit ─── */}
        <UnlockToolkit
          referralCode={referralCode}
          referralCount={referralCount}
          features={features}
          onInvite={onInvite}
          onNavigate={onNavigate}
        />

        {/* ─── Share promo ─── */}
        <SharePromoBlock heroTitle={hero?.title ?? 'Your best-fit career'} heroShape={hero?.shape ?? null} heroPct={hero?.matchPct ?? 0} onGenerate={onOpenShareCard} />

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

        {/* ─── About you — banner + accordion ─── */}
        {aboutRows.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            {radarAxes.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <V4ChartBanner
                  eyebrow="PERSONALITY RADAR"
                  icon={<Activity size={14} />}
                  title="How you actually work"
                  blurb="Your operating profile across five dimensions, built from the assessment and pressure-tested by your coach."
                  meta={`${radarAxes.length} axes`}
                  stat={radarLeadStat ?? undefined}
                  chart={<V4PersonalityRadarSVG axes={radarAxes} />}
                />
              </div>
            )}
            <div
              style={{
                background: 'rgba(18, 46, 59, 0.62)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 30px 60px -24px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ padding: '22px 28px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Eyebrow>ABOUT YOU · {aboutRows.length} SECTION{aboutRows.length === 1 ? '' : 'S'}</Eyebrow>
              </div>
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
          </section>
        )}

        {/* ─── Career suggestions — banner + accordion ─── */}
        {careerRows.length > 0 && (
          <section style={{ marginBottom: 16 }}>
            {careerMapPoints.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <V4ChartBanner
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
                  chartWidth="1.7fr"
                />
              </div>
            )}
            <div
              style={{
                background: 'rgba(18, 46, 59, 0.62)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 30px 60px -24px rgba(0,0,0,0.5)',
              }}
            >
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
          </section>
        )}
      </div>
    </LakeBackground>
  );
};

// ── Hero match (#1) — hover-flips to a comparison radar ──────
const HeroMatch: React.FC<{
  match: CareerMatch;
  jobsUnlocked: boolean;
  onOpenBreakdown: () => void;
  onFindRoles: (careerTitle?: string) => void;
  compareCareers: CompareCareer[];
}> = ({ match, jobsUnlocked, onOpenBreakdown, onFindRoles, compareCareers }) => {
  const [flipped, setFlipped] = useState(false);
  const isFlipped = flipped;
  // Only flip when there's something to compare against.
  const canFlip = compareCareers.length >= 2;
  return (
    <article
      style={{
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
      {/* Soft gold glow — sits behind everything, not part of the flip */}
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

      {/* Flip container — hover-only listener, perspective parent.
          Inside, the flipper uses a CSS-grid stack so both faces share one
          cell. That cell auto-sizes to the taller face, which prevents the
          back face (radar + legend) from being clipped when the front face
          (text + bullets) is shorter. */}
      <div
        onMouseEnter={canFlip ? () => setFlipped(true) : undefined}
        onMouseLeave={canFlip ? () => setFlipped(false) : undefined}
        style={{
          position: 'relative',
          perspective: 1600,
          flex: 1,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateAreas: '"stack"',
            transformStyle: 'preserve-3d',
            transition: 'transform 650ms cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* FRONT */}
          <div
            style={{
              gridArea: 'stack',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <Eyebrow>STRONGEST MATCH · CAREER #1</Eyebrow>
                {match.shape && (
                  <div style={{ marginTop: 8, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
                    {match.shape}
                  </div>
                )}
              </div>
              {match.aiImpact && <AIImpactPill label={match.aiImpact} />}
            </div>

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

            <MatchMeter pct={match.matchPct} large />

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

            {match.alignment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
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

          </div>

          {/* BACK — cream paper, comparison radar. Lives in the same grid
              cell as the front so the cell sizes to whichever face is taller. */}
          {canFlip && (
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
                borderRadius: 20,
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
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
                  Work-life fit · 5 axes
                </span>
              </div>
              <p
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  fontWeight: 500,
                  color: PALETTE.inkMuted,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Five axes that shape day-to-day fit. Filled polygon is the strongest match; dashed lines are your
                other top roles for comparison.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <V4CompareRadarSVG careers={compareCareers} focalRank={1} variant="compact" />
              </div>
              <V4CompareLegend careers={compareCareers} focalRank={1} />
            </div>
          )}
        </div>
      </div>

      {/* Button bar — outside the flip, always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingTop: 18,
          borderTop: '1px solid rgba(255,255,255,0.10)',
          flexWrap: 'wrap',
        }}
      >
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
          Why this fits you <ArrowRight size={16} />
        </button>
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
          {jobsUnlocked ? 'Find open roles' : 'Find open roles · locked'}
        </button>
      </div>
    </article>
  );
};

// ── Secondary match (#2 / #3) ─────────────────────────────────
const SecondaryMatch: React.FC<{
  match: CareerMatch;
  onOpen: () => void;
  onFindRoles: (careerTitle?: string) => void;
}> = ({ match, onOpen, onFindRoles }) => (
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <Eyebrow>CAREER #{match.rank}</Eyebrow>
      {match.aiImpact && <AIImpactPill label={match.aiImpact} />}
    </div>
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
    <div style={{ marginTop: 'auto' }}>
      <MatchMeter pct={match.matchPct} />
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
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
        <Briefcase size={13} /> Find roles
      </button>
    </div>
  </article>
);

// ── Match meter ───────────────────────────────────────────────
const MatchMeter: React.FC<{ pct: number; large?: boolean }> = ({ pct, large = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: large ? 16 : 12 }}>
    {large && (
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
          minWidth: 56,
        }}
      >
        Match
      </span>
    )}
    <div
      style={{
        flex: 1,
        height: large ? 8 : 6,
        background: 'rgba(255,255,255,0.10)',
        borderRadius: 9999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${PALETTE.teal} 0%, ${large ? PALETTE.goldBright : PALETTE.blue} 100%)`,
          borderRadius: 9999,
          boxShadow: large ? '0 0 14px rgba(212,160,36,0.35)' : undefined,
        }}
      />
    </div>
    <span
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: large ? 18 : 14,
        color: PALETTE.goldBright,
        minWidth: large ? 50 : undefined,
        textAlign: 'right',
      }}
    >
      {pct}%
    </span>
  </div>
);

// ── Paths tile ────────────────────────────────────────────────
const PathsTile: React.FC<{ title: string; accent: string; teaser: string; onOpen: () => void }> = ({
  title,
  accent,
  teaser,
  onOpen,
}) => (
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
      gap: 12,
      boxShadow: '0 16px 32px -16px rgba(0,0,0,0.4)',
    }}
  >
    <span
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: accent,
      }}
    >
      {title}
    </span>
    <p
      style={{
        fontFamily: FONT_BODY,
        fontWeight: 500,
        fontSize: 13.5,
        lineHeight: 1.5,
        color: 'rgba(255,255,255,0.78)',
        margin: 0,
        flex: 1,
      }}
    >
      {teaser || 'Open the full report to explore these alternatives.'}
    </p>
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
const TOOL_META: Record<string, { label: string; icon: React.ReactNode; unlockCopy: string }> = {
  jobs: { label: 'Find open roles', icon: <Briefcase size={20} />, unlockCopy: 'Invite a first friend to unlock' },
  resume: { label: 'Tailor your resume', icon: <FileText size={20} />, unlockCopy: 'Invite a second friend to unlock' },
  'cover-letter': { label: 'Generate cover letters', icon: <FilePlus size={20} />, unlockCopy: 'Invite a third friend to unlock' },
};

const UnlockToolkit: React.FC<{
  referralCode: string | null;
  referralCount: number;
  features: ResolvedFeature[];
  onInvite: () => void;
  onNavigate: (route: string) => void;
}> = ({ referralCode, referralCount, features, onInvite, onNavigate }) => {
  const earned = Math.min(referralCount, 3);
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
            <Eyebrow>JOB-HUNT TOOLKIT · EARN BY INVITING</Eyebrow>
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
              Unlock tools as you help friends find their path.
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
              Each friend you bring in unlocks the next tool, for free, forever.<br />
              They get clarity. You get the next step in the job hunt.
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
              <span style={{ whiteSpace: 'nowrap' }}>{earned} of 3 friends joined</span>
              <span style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 9999, overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block',
                    width: `${(earned / 3) * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${PALETTE.gold} 0%, ${PALETTE.goldBright} 100%)`,
                  }}
                />
              </span>
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
                  fontWeight: 800,
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {features.map((f) => (
          <ToolCard key={f.key} feature={f} onInvite={onInvite} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
};

const ToolCard: React.FC<{
  feature: ResolvedFeature;
  onInvite: () => void;
  onNavigate: (route: string) => void;
}> = ({ feature, onInvite, onNavigate }) => {
  const meta = TOOL_META[feature.key];
  const unlocked = feature.unlocked;
  const actionable = unlocked && feature.builtYet && !!feature.route;

  // For the resume tool, surface a summary of past tailored résumés so the
  // user knows there's work to return to (and can jump to the index view
  // without re-generating). Hook is unconditionally called but only renders
  // anything when feature.key === 'resume' AND there's at least one row.
  const { data: savedResumes } = useCustomResumeList();
  const showSavedSummary =
    feature.key === 'resume' &&
    unlocked &&
    feature.builtYet &&
    (savedResumes?.length ?? 0) > 0;
  const mostRecentSaved = showSavedSummary ? savedResumes![0] : null;
  const savedCount = savedResumes?.length ?? 0;

  return (
    <article
      style={{
        background: PALETTE.cream,
        borderRadius: 20,
        padding: 22,
        border: `1px solid ${PALETTE.tan}`,
        boxShadow: '0 18px 36px -16px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 9999,
            background: actionable
              ? 'rgba(212, 160, 36, 0.18)'
              : unlocked
                ? 'rgba(39, 161, 161, 0.14)'
                : 'rgba(18,46,59,0.08)',
            color: actionable
              ? PALETTE.gold
              : unlocked
                ? PALETTE.tealDeep
                : PALETTE.inkSoft,
            border: actionable
              ? '1px solid rgba(212, 160, 36, 0.45)'
              : unlocked
                ? '1px solid rgba(39, 161, 161, 0.30)'
                : '1px solid rgba(18,46,59,0.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: actionable ? '0 6px 16px -6px rgba(212,160,36,0.45)' : undefined,
          }}
        >
          {unlocked ? meta.icon : <Lock size={18} />}
        </div>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: PALETTE.canvasDeep }}>
            {feature.title}
          </div>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 12,
              color: actionable ? PALETTE.gold : unlocked ? PALETTE.teal : PALETTE.inkMuted,
              marginTop: 2,
              letterSpacing: actionable ? '0.04em' : undefined,
              textTransform: actionable ? 'uppercase' : undefined,
            }}
          >
            {unlocked ? (feature.builtYet ? 'Unlocked!' : 'Unlocked · coming soon') : meta.unlockCopy}
          </div>
        </div>
      </div>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: 13.5,
          color: PALETTE.inkMuted,
          lineHeight: 1.5,
          margin: 0,
          flex: 1,
        }}
      >
        {feature.description}
      </p>
      {showSavedSummary && mostRecentSaved ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: 'rgba(39,161,161,0.10)',
            border: '1px solid rgba(39,161,161,0.28)',
            borderRadius: 12,
          }}
        >
          <BookOpen size={14} color={PALETTE.tealDeep} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 11.5,
                fontWeight: 700,
                color: PALETTE.tealDeep,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {savedCount} saved {savedCount === 1 ? 'résumé' : 'résumés'}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12.5,
                fontWeight: 600,
                color: PALETTE.canvasDeep,
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={mostRecentSaved.career_title}
            >
              Most recent: {mostRecentSaved.career_title}
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        disabled={unlocked && !feature.builtYet}
        onClick={() => {
          if (actionable) onNavigate(feature.route!);
          else if (!unlocked) onInvite();
        }}
        style={{
          marginTop: 'auto',
          background: actionable ? PALETTE.gold : 'transparent',
          color: actionable
            ? PALETTE.canvasDeep
            : unlocked && !feature.builtYet
              ? PALETTE.inkSoft
              : PALETTE.tealDeep,
          border: actionable
            ? '1px solid transparent'
            : `1px solid ${unlocked ? 'rgba(39, 161, 161, 0.45)' : PALETTE.teal}`,
          padding: '11px 14px',
          borderRadius: 9999,
          fontFamily: FONT_BODY,
          fontWeight: actionable ? 800 : 700,
          fontSize: 13,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: unlocked && !feature.builtYet ? 'default' : 'pointer',
          boxShadow: actionable ? '0 10px 24px -8px rgba(212,160,36,0.55)' : undefined,
          opacity: unlocked && !feature.builtYet ? 0.7 : 1,
        }}
      >
        {!unlocked && <Lock size={13} />}
        {actionable ? meta.label : unlocked ? 'Coming soon' : 'Invite a friend to unlock'}
        {actionable && <ArrowRight size={13} />}
      </button>
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
      background: PALETTE.cream,
      borderRadius: 24,
      border: `1px solid ${PALETTE.tan}`,
      boxShadow: '0 24px 50px -20px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
    }}
  >
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: PALETTE.tealDeep,
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
          color: PALETTE.canvasDeep,
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
          color: PALETTE.inkMuted,
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
            color: PALETTE.tealDeep,
            border: `1px solid ${PALETTE.tan}`,
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
