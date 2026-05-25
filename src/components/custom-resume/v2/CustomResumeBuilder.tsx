// Custom Résumé builder — single-page form (no multi-step wizard).
//
// Visual language ported from /jobs (v2): approach_vis full-bleed background,
// glassy dark cards, gold eyebrow tier label, big display heading, gold CTA.
//
// Sections, top to bottom:
//   - Hero (eyebrow + headline + sub)
//   - Careers picker (max 3 selectable, grouped by tier)
//   - Template picker (5 cards — 2 ATS-safe, 3 designed)
//   - Cover-letter toggle (pill-style)
//   - Generate CTA (gold)

import React from 'react';
import { ArrowDown, Award, BookOpen, CheckCircle2, Lightbulb, Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';
import {
  PageSection,
  TierPill,
  SelectCheckCircle,
  glassCardStyle,
  REyebrow,
} from './customResumeV2Shared';
import type { ReportSection } from '@/hooks/useReportSections';
import type { CareerSelection } from '../types';
import { stripHtml } from '../utils';

const CAREER_SECTION_TYPES = new Set([
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
  'dream_jobs',
]);

const MAX_SELECT = 3;

// Forest green for "Outside the Box" — distinct from the top-three gold,
// the runner-up teal, and the dream-job blue so each tier reads at a glance.
const FOREST_GREEN = '#6BA66A';

const TIER_FOR_TYPE: Record<string, { label: string; color: string; icon: 'num' | 'award' | 'lightbulb'; num?: number }> = {
  top_career_1: { label: 'Top Career #1', color: PALETTE.goldBright, icon: 'num', num: 1 },
  top_career_2: { label: 'Top Career #2', color: PALETTE.goldBright, icon: 'num', num: 2 },
  top_career_3: { label: 'Top Career #3', color: PALETTE.goldBright, icon: 'num', num: 3 },
  runner_ups: { label: 'Runner-up', color: PALETTE.tealBright, icon: 'award' },
  outside_box: { label: 'Outside the Box', color: FOREST_GREEN, icon: 'lightbulb' },
  dream_jobs: { label: 'Dream Job', color: PALETTE.blue, icon: 'lightbulb' },
};

interface CustomResumeBuilderProps {
  sections: ReportSection[];
  selected: CareerSelection[];
  onSelectedChange: (next: CareerSelection[]) => void;
  includeCoverLetter: boolean;
  onCoverLetterChange: (next: boolean) => void;
  // Cover letter sits behind a higher referral tier than the résumé itself.
  // When locked, the pill toggle is disabled and shows an "invite N more"
  // hint instead of the on-by-default state.
  coverLetterUnlocked: boolean;
  referralsToCoverLetter: number;
  isGenerating: boolean;
  onGenerate: () => void;
  // When the user already has saved résumés, show a "Jump to saved (N)"
  // anchor button next to the hero so it's obvious there's a list further
  // down the page.
  savedCount?: number;
  onJumpToSaved?: () => void;
}

export const CustomResumeBuilder: React.FC<CustomResumeBuilderProps> = ({
  sections,
  selected,
  onSelectedChange,
  includeCoverLetter,
  onCoverLetterChange,
  coverLetterUnlocked,
  referralsToCoverLetter,
  isGenerating,
  onGenerate,
  savedCount = 0,
  onJumpToSaved,
}) => {
  const careers = sections.filter((s) => CAREER_SECTION_TYPES.has(s.section_type));
  const selectedIds = new Set(selected.map((s) => s.section_id));
  const atLimit = selected.length >= MAX_SELECT;

  const orderedCareers = [...careers].sort((a, b) => {
    const order = ['top_career_1', 'top_career_2', 'top_career_3', 'runner_ups', 'outside_box', 'dream_jobs'];
    const ai = order.indexOf(a.section_type);
    const bi = order.indexOf(b.section_type);
    if (ai !== bi) return ai - bi;
    return Number(b.score ?? 0) - Number(a.score ?? 0);
  });

  const toggle = (s: ReportSection) => {
    const id = s.id;
    const title = stripHtml(s.title);
    if (selectedIds.has(id)) {
      onSelectedChange(selected.filter((c) => c.section_id !== id));
    } else {
      if (atLimit) return;
      onSelectedChange([
        ...selected,
        { section_id: id, section_type: s.section_type, career_title: title },
      ]);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 32px 80px' }}>
      {/* Hero — heading on the left, "jump to saved" anchor on the right when
          the user already has past résumés further down the page. */}
      <div
        style={{
          marginBottom: 36,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <REyebrow>STEP 2 · TAILORED RÉSUMÉ · TIER 2 OF 3</REyebrow>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 900,
              fontSize: 48,
              letterSpacing: '-0.03em',
              color: '#fff',
              margin: '12px 0 8px 0',
              lineHeight: 1.0,
            }}
          >
            Tailor your résumé.
          </h1>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.72)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Pick up to 3 careers from your report and we'll generate a tailored résumé for each,
            re-framed toward the role and ATS-scored. Once they're ready, swap between 5 visual
            styles (2 ATS-safe, 2 designed) without re-generating. Free to download.
          </p>
        </div>
        {savedCount > 0 && onJumpToSaved ? (
          <button
            type="button"
            onClick={onJumpToSaved}
            style={{
              background: 'rgba(39,161,161,0.14)',
              color: PALETTE.tealBright,
              border: '1px solid rgba(39,161,161,0.42)',
              padding: '10px 16px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 20px -10px rgba(39,161,161,0.5)',
            }}
            title={`Jump to ${savedCount} saved ${savedCount === 1 ? 'résumé' : 'résumés'}`}
          >
            <BookOpen size={14} />
            Saved résumés ({savedCount})
            <ArrowDown size={13} />
          </button>
        ) : null}
      </div>

      {/* Careers */}
      <PageSection
        eyebrow="CAREERS TO TAILOR FOR"
        rightSlot={
          <span style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
            {selected.length} / {MAX_SELECT} selected
          </span>
        }
      >
        {orderedCareers.length === 0 ? (
          <EmptyHint>Your report doesn't have career suggestions yet.</EmptyHint>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {orderedCareers.map((c) => {
              const isSelected = selectedIds.has(c.id);
              const disabled = !isSelected && atLimit;
              return (
                <CareerCard
                  key={c.id}
                  section={c}
                  selected={isSelected}
                  disabled={disabled}
                  onToggle={() => toggle(c)}
                />
              );
            })}
          </div>
        )}
      </PageSection>

      {/* Template selection lives on the Results screen, not here.
          The template only affects PDF layout — not what the AI generates —
          so making the user pick before generation was redundant friction.
          The Results screen has a dropdown to switch between all templates
          on already-generated data. */}

      {/* Cover letter + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {(() => {
          const disabled = selected.length === 0 || isGenerating;
          const hint = isGenerating
            ? null
            : selected.length === 0
              ? 'Pick at least one career'
              : null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                onClick={onGenerate}
                disabled={disabled}
                style={{
                  background: disabled ? 'rgba(212,160,36,0.4)' : PALETTE.gold,
                  color: PALETTE.canvasDeep,
                  border: 'none',
                  padding: '16px 28px',
                  borderRadius: 9999,
                  fontFamily: FONT_BODY,
                  fontWeight: 800,
                  fontSize: 15,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  boxShadow: disabled ? 'none' : '0 14px 32px -10px rgba(212,160,36,0.55)',
                  opacity: disabled ? 0.7 : 1,
                }}
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isGenerating
                  ? 'Starting…'
                  : `Generate ${selected.length || 0} ${(selected.length || 0) === 1 ? 'résumé' : 'résumés'}`}
              </button>
              {hint && (
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: PALETTE.goldBright,
                    letterSpacing: '0.02em',
                    paddingLeft: 4,
                  }}
                >
                  {hint}
                </span>
              )}
            </div>
          );
        })()}

        <CoverLetterToggle
          checked={coverLetterUnlocked && includeCoverLetter}
          onChange={onCoverLetterChange}
          locked={!coverLetterUnlocked}
          invitesNeeded={referralsToCoverLetter}
        />

        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
            flexBasis: '100%',
            marginTop: 4,
          }}
        >
          Typical generation takes 20–40 seconds. Each résumé updates live as it completes.
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.42)',
            flexBasis: '100%',
            marginTop: 2,
          }}
        >
          * ATS = Applicant Tracking System, the software most employers use to
          scan and filter résumés before a human ever sees them. ATS-safe
          templates use clean text-only layouts so nothing gets dropped.
        </div>
      </div>
    </div>
  );
};

// ── Career card ───────────────────────────────────────────────
const CareerCard: React.FC<{
  section: ReportSection;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}> = ({ section, selected, disabled, onToggle }) => {
  const tier = TIER_FOR_TYPE[section.section_type] ?? TIER_FOR_TYPE.runner_ups;
  const title = stripHtml(section.title) || 'Untitled career';
  const altTitles = stripHtml(section.alternate_titles);
  const score = section.score != null ? Math.round(Number(section.score)) : null;

  return (
    <button
      type="button"
      onClick={!disabled ? onToggle : undefined}
      disabled={disabled}
      style={{
        ...glassCardStyle(selected, disabled),
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 152,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TierIcon icon={tier.icon} num={tier.num} selected={selected} color={tier.color} />
          <TierPill label={tier.label} selected={selected} color={tier.color} />
        </div>
        <SelectCheckCircle selected={selected} />
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 17,
          letterSpacing: '-0.01em',
          color: '#fff',
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      {altTitles && (
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.45,
          }}
        >
          {altTitles}
        </div>
      )}
      {score != null && (
        <div
          style={{
            marginTop: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            paddingTop: 8,
          }}
        >
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 900,
              fontSize: 13,
              color: PALETTE.goldBright,
            }}
          >
            {score}/100
          </span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Match
          </span>
        </div>
      )}
    </button>
  );
};

const TierIcon: React.FC<{
  icon: 'num' | 'award' | 'lightbulb';
  num?: number;
  selected: boolean;
  color: string;
}> = ({ icon, num, selected, color }) => {
  const size = 22;
  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 9999,
    background: selected ? color : 'rgba(255,255,255,0.06)',
    color: selected ? PALETTE.canvasDeep : color,
    border: selected ? 'none' : `1px solid ${color}59`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: FONT_DISPLAY,
    fontSize: 11,
    fontWeight: 900,
    flexShrink: 0,
  };
  if (icon === 'num' && num != null) return <span style={baseStyle}>{num}</span>;
  if (icon === 'award')
    return (
      <span style={baseStyle}>
        <Award size={12} />
      </span>
    );
  return (
    <span style={baseStyle}>
      <Lightbulb size={12} />
    </span>
  );
};

// ── Cover-letter toggle (pill, matches Jobs "Remote-friendly only") ──
// When `locked` is true, the toggle visually mutes and swaps its label to a
// "invite N more" hint. Click is a no-op — the page also forces
// includeCoverLetter=false on submit, so this is belt-and-suspenders.
const CoverLetterToggle: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  locked: boolean;
  invitesNeeded: number;
}> = ({ checked, onChange, locked, invitesNeeded }) => {
  // Checked state needs to read clearly as "selected" — filled teal background
  // with the canvas-deep text and a soft glow, mirroring the gold CTA next to
  // it. The unchecked state stays subtle (transparent w/ thin border).
  const border = locked
    ? '1px dashed rgba(212,160,36,0.45)'
    : checked
      ? `1.5px solid ${PALETTE.tealBright}`
      : '1px solid rgba(255,255,255,0.22)';
  const background = locked
    ? 'rgba(212,160,36,0.08)'
    : checked
      ? PALETTE.teal
      : 'transparent';
  const color = locked
    ? PALETTE.goldBright
    : checked
      ? '#fff'
      : 'rgba(255,255,255,0.92)';
  const boxShadow = checked && !locked
    ? '0 10px 28px -10px rgba(39,161,161,0.65)'
    : undefined;

  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        cursor: locked ? 'not-allowed' : 'pointer',
        padding: '10px 14px',
        borderRadius: 9999,
        border,
        background,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 13,
        color,
        whiteSpace: 'nowrap',
        height: 42,
        boxSizing: 'border-box',
        opacity: locked ? 0.85 : 1,
        boxShadow,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ display: 'none' }}
      />
      {locked ? (
        <Lock size={13} />
      ) : checked ? (
        <CheckCircle2 size={15} />
      ) : (
        <Mail size={14} />
      )}
      {locked
        ? `Cover letters · invite ${invitesNeeded} more to unlock`
        : checked
          ? 'Cover letters included'
          : 'Add cover letters'}
    </label>
  );
};

const EmptyHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: 32,
      background: 'rgba(18,46,59,0.55)',
      border: '1px dashed rgba(255,255,255,0.12)',
      borderRadius: 18,
      textAlign: 'center',
      fontFamily: FONT_BODY,
      fontSize: 14,
      color: 'rgba(255,255,255,0.6)',
    }}
  >
    {children}
  </div>
);
