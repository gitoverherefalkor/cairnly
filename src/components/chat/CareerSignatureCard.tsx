import React, { useMemo } from 'react';
import { Sparkles, Share2 } from 'lucide-react';
import { useReportSections, type ReportSection } from '@/hooks/useReportSections';
import { useProfile } from '@/hooks/useProfile';
import { extractAIImpact } from './CareerScoreCard';

// Career Signature Card — closing artifact shown at the end of the chat
// session and persisted on the dashboard. Designed to be screenshot-able
// and shareable on LinkedIn, so the layout favors a bold headline career,
// supporting top 2 + top 3, and visible Atlas branding.

const AI_IMPACT_LEVELS = ['Minimal', 'Moderate', 'High', 'Severe', 'Critical'] as const;
type AIImpactLevel = typeof AI_IMPACT_LEVELS[number];

const IMPACT_COLOR: Record<AIImpactLevel, { hex: string; bg: string; text: string }> = {
  Minimal:  { hex: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Moderate: { hex: '#0ea5e9', bg: 'bg-sky-50',     text: 'text-sky-700' },
  High:     { hex: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700' },
  Severe:   { hex: '#f97316', bg: 'bg-orange-50',  text: 'text-orange-700' },
  Critical: { hex: '#ef4444', bg: 'bg-red-50',     text: 'text-red-700' },
};

interface SignatureCareer {
  rank: 1 | 2 | 3;
  title: string;
  score: number;
  aiImpact: AIImpactLevel | null;
  // Company size + type, e.g. "Medium (51–200) / Scale-up". Stripped of
  // the HTML wrapping the n8n prompt outputs around it.
  context: string | null;
}

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
}

function getCareer(sections: ReportSection[], type: string, rank: 1 | 2 | 3): SignatureCareer | null {
  const s = sections.find((x) => x.section_type === type);
  if (!s) return null;
  const score = s.score != null ? Number(s.score) : NaN;
  if (!Number.isFinite(score)) return null;
  const rawContext = s.company_size_type ? stripHtml(s.company_size_type) : '';
  return {
    rank,
    title: stripHtml(s.title || 'Untitled'),
    score,
    aiImpact: extractAIImpact(s.content || ''),
    context: rawContext || null,
  };
}

// Pills are deliberately uniform: same border, same white bg, same
// padding, same font sizes. Only the value's color and the trailing
// indicator change. One visual rhythm across the card instead of two
// (was lg + sm with different backgrounds + different scales).
const PILL_BASE =
  'inline-flex items-center gap-2 rounded-full border border-atlas-navy/15 bg-white px-2.5 py-1';
const PILL_TAG = 'text-[10px] uppercase tracking-wider font-semibold text-gray-500';

const MatchPill: React.FC<{ score: number }> = ({ score }) => (
  <div className={PILL_BASE}>
    <span className={PILL_TAG}>Match</span>
    <span className="text-[10px] font-bold text-atlas-teal leading-none">{score}</span>
    <span className="text-[10px] text-gray-400 leading-none">/100</span>
  </div>
);

const ImpactPill: React.FC<{ level: AIImpactLevel }> = ({ level }) => {
  const c = IMPACT_COLOR[level];
  return (
    <div className={PILL_BASE}>
      <span className={PILL_TAG}>AI Impact</span>
      <span className="text-[10px] font-bold leading-none" style={{ color: c.hex }}>
        {level}
      </span>
      <span
        className="inline-block rounded-full"
        style={{ background: c.hex, width: 6, height: 6 }}
      />
    </div>
  );
};

interface CareerSignatureCardProps {
  reportId: string;
  className?: string;
  // 'compact' renders a tighter card sized to fit a dashboard hero column.
  // 'full' is the standalone closing-screen / modal expansion.
  variant?: 'full' | 'compact';
  // When true, renders with the warm-paper radial gradient hero treatment
  // (used by the modal for share-screenshot punch). When false (default
  // for inline dashboard use), renders on plain white so it matches the
  // other dashboard cards.
  decorative?: boolean;
  // Optional click handler on the whole card (cursor pointer + hover
  // lift). Was previously used to open a modal that just re-rendered
  // this same card, which the dashboard restructure made redundant.
  onClick?: () => void;
  // Click handler for the Share CTA in the footer. When provided,
  // replaces the static "atlas-assessments.com" URL with a "Share →"
  // button. Real share logic (LinkedIn, PNG export, etc.) lives in
  // a separate feature design.
  onShare?: () => void;
}

export const CareerSignatureCard: React.FC<CareerSignatureCardProps> = ({
  reportId,
  className,
  variant = 'full',
  decorative = false,
  onClick,
  onShare,
}) => {
  const isCompact = variant === 'compact';
  const { sections } = useReportSections(reportId);
  const { profile } = useProfile();

  const { hero, second, third, totalScored } = useMemo(() => {
    const list = sections || [];
    const hero = getCareer(list, 'top_career_1', 1);
    const second = getCareer(list, 'top_career_2', 2);
    const third = getCareer(list, 'top_career_3', 3);
    const totalScored = list.filter((s) =>
      ['top_career_1', 'top_career_2', 'top_career_3', 'runner_ups', 'outside_box'].includes(s.section_type)
        && s.score != null,
    ).length;
    return { hero, second, third, totalScored };
  }, [sections]);

  if (!hero) return null;

  const firstName = profile?.first_name || '';

  return (
    <div className={className}>
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        // Decorative variant uses the warm-paper radial hero gradient
        // (modal / share-screenshot context). Default plain white so the
        // inline dashboard card sits in visual rhythm with the rest.
        className={`relative overflow-hidden rounded-lg border border-atlas-navy/10 shadow-sm ${
          decorative ? '' : 'bg-white'
        } ${
          onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-md' : ''
        }`}
        style={
          decorative
            ? {
                background:
                  'radial-gradient(120% 80% at 50% -10%, #ffffff 0%, #FAF6EC 45%, #ECE4D2 100%)',
              }
            : undefined
        }
      >
        {/* Header */}
        <div className={`flex items-center justify-between ${isCompact ? 'px-4 pt-4 pb-3' : 'px-5 sm:px-7 pt-6 pb-4'}`}>
          <div className="flex items-center gap-2 text-atlas-teal">
            <Sparkles className="w-4 h-4" strokeWidth={2.25} />
            <span className="uppercase tracking-[0.16em] font-semibold text-xs">
              Your Career Signature
            </span>
          </div>
          <span className={`uppercase tracking-wider font-semibold text-atlas-navy/50 ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
            CAIRNLY
          </span>
        </div>

        {/* Unified typography helpers — every uppercase tag uses the
            same class so the card has one tag rhythm, not three. Every
            size/type subtitle uses the same teal style. */}
        {/* Tag class: text-[10px] uppercase tracking-wider muted gray
            Subtitle class: text-xs teal medium */}

        {/* Hero — top career #1 */}
        <div className={isCompact ? 'px-4 pb-4' : 'px-5 sm:px-7 pb-6'}>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
            Strongest Match {firstName ? `· ${firstName}` : ''}
          </div>
          <h2
            className={`font-heading leading-tight font-bold text-atlas-navy mb-1 ${
              isCompact ? 'text-[1.15rem] line-clamp-2' : 'text-2xl'
            }`}
          >
            {hero.title}
          </h2>
          {hero.context && (
            <div className="text-xs text-atlas-teal font-medium mb-3">
              {hero.context}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <MatchPill score={hero.score} />
            {hero.aiImpact && <ImpactPill level={hero.aiImpact} />}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-atlas-navy/10" />

        {/* Top 2 + 3 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-atlas-navy/10">
          {[second, third].map((c, i) =>
            c ? (
              <div key={c.rank} className={isCompact ? 'px-4 py-3' : 'px-5 sm:px-7 py-5'}>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5">
                  {c.rank === 2 ? 'Top Career #2' : 'Top Career #3'}
                </div>
                <div className="font-heading leading-snug font-semibold text-atlas-navy line-clamp-2 text-base mb-1">
                  {c.title}
                </div>
                {c.context && (
                  <div className="text-xs text-atlas-teal font-medium line-clamp-1 mb-2.5">
                    {c.context}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <MatchPill score={c.score} />
                  {c.aiImpact && <ImpactPill level={c.aiImpact} />}
                </div>
              </div>
            ) : (
              // Empty cell keeps layout balanced if WF4 hasn't filled this rank yet.
              <div key={`empty-${i}`} className={`opacity-50 ${isCompact ? 'px-4 py-3' : 'px-5 sm:px-7 py-5'}`}>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1.5">
                  {i === 0 ? 'Top Career #2' : 'Top Career #3'}
                </div>
                <div className="text-sm text-gray-400 italic">Pending</div>
              </div>
            ),
          )}
        </div>

        {/* Footer — matches the tag rhythm used throughout: text-[10px]
            with consistent muted/teal pairing. */}
        <div
          className={`border-t border-atlas-navy/10 flex items-center justify-between ${
            isCompact ? 'px-4 py-2.5' : 'px-5 sm:px-7 py-3'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
            {totalScored > 0
              ? `${totalScored} role${totalScored === 1 ? '' : 's'} analyzed`
              : 'From your Cairnly Assessment'}
          </span>
          <span className={`font-semibold text-atlas-teal ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
            {isCompact ? 'View →' : 'cairnly.io'}
          </span>
          {onShare ? (
            <button
              type="button"
              onClick={(e) => {
                // Prevent any parent onClick (card-level handler) from firing.
                e.stopPropagation();
                onShare();
              }}
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-atlas-teal hover:text-atlas-teal/80 transition-colors"
            >
              <Share2 className="w-3 h-3" strokeWidth={2.5} />
              Share
            </button>
          ) : (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-atlas-teal">
              {isCompact ? 'View →' : 'cairnly.io'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
