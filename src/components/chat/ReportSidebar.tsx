import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, FileText, Check, Circle, Lock, PartyPopper, X, ListOrdered, ClipboardList, Compass, Zap, TrendingUp, Heart, Trophy, Award, Lightbulb, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReportSection } from '@/hooks/useReportSections';

// Map section IDs to translation keys in report.json
const SECTION_I18N_KEY: Record<string, string> = {
  'executive-summary': 'sections.executiveSummary.title',
  'personality-team': 'sections.personalityTeam.title',
  'strengths': 'sections.strengths.title',
  'growth': 'sections.growth.title',
  'values': 'sections.values.title',
  'first-career': 'sections.firstCareer',
  'second-career': 'sections.secondCareer',
  'third-career': 'sections.thirdCareer',
  'runner-up': 'sections.runnerUp.title',
  'outside-box': 'sections.outsideBox.title',
  'dream-jobs': 'sections.dreamJobs.title',
};

// All sections in order - matches store-report-sections
// Each section has: id, title (display), altTitles (what agent might output)
// Canonical section list — the order here defines the numeric index used
// throughout the app (localStorage stores `chat_section_index_<reportId>`
// as a number into this array, so removing or reordering entries breaks
// stored progress for every existing user). Executive Summary stays in
// the list to preserve indices; it's filtered out of the sidebar UI via
// HIDDEN_SECTION_IDS below.
export const ALL_SECTIONS = [
  { id: 'executive-summary', title: 'Executive Summary', altTitles: ['executive summary'], chapter: 'about-you' },
  { id: 'personality-team', title: 'Your Approach', altTitles: ['your approach', 'understanding your approach', 'personality', 'team dynamics'], chapter: 'about-you' },
  { id: 'strengths', title: 'Your Strengths', altTitles: ['your strengths', 'your core strengths', 'core strengths', 'strengths'], chapter: 'about-you' },
  { id: 'growth', title: 'Development Areas', altTitles: ['development areas', 'areas for development', 'areas of development', 'growth', 'growth opportunities'], chapter: 'about-you' },
  { id: 'values', title: 'Career Values', altTitles: ['career values', 'your core values', 'core values', 'values', 'your values'], chapter: 'about-you' },
  { id: 'first-career', title: 'Primary Career Match', altTitles: ['primary career', 'first career', 'career match', 'career 1:', 'career 1', '#1 career'], chapter: 'career-suggestions' },
  { id: 'second-career', title: 'Second Career Match', altTitles: ['second career', 'secondary career', 'career 2:', 'career 2', '#2 career'], chapter: 'career-suggestions' },
  { id: 'third-career', title: 'Third Career Match', altTitles: ['third career', 'career 3:', 'career 3', '#3 career'], chapter: 'career-suggestions' },
  { id: 'runner-up', title: 'Runner-up Careers', altTitles: ['runner-up', 'runner up', 'runners-up', 'runners up', 'honorable mention', 'honorable mentions', 'career 4:', 'career 4', '#4 career'], chapter: 'career-suggestions' },
  { id: 'outside-box', title: 'Outside the Box', altTitles: ['outside the box', 'outside-the-box', 'unconventional', 'wildcard', 'career 5:', 'career 5', '#5 career'], chapter: 'career-suggestions' },
  { id: 'dream-jobs', title: 'Dream Job Assessment', altTitles: ['dream job', 'dream jobs', 'dream career', 'dream role', 'career 6:', 'career 6', '#6 career'], chapter: 'career-suggestions' },
] as const;

export type SectionId = typeof ALL_SECTIONS[number]['id'];

// Sections present in ALL_SECTIONS but intentionally hidden from the
// sidebar UI + progress count. Currently just Executive Summary, which the
// chat doesn't surface but stays in the canonical list to keep numeric
// indices stable for stored progress.
const HIDDEN_SECTION_IDS: ReadonlySet<string> = new Set(['executive-summary']);

// Total visible section count — used for the "N / M" progress label so it
// reflects what the user actually sees, not the canonical list length.
const VISIBLE_SECTIONS_COUNT = ALL_SECTIONS.filter(
  (s) => !HIDDEN_SECTION_IDS.has(s.id)
).length;

// Icons for each section in the sidebar
const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'executive-summary': ClipboardList,
  'personality-team': Compass,
  'strengths': Zap,
  'growth': TrendingUp,
  'values': Heart,
  'first-career': Trophy,   // will be overridden by number badge in button
  'second-career': Trophy,
  'third-career': Trophy,
  'runner-up': Award,
  'outside-box': Lightbulb,
  'dream-jobs': Sparkles,
};

// Numbered labels for the top-3 careers
const CAREER_NUMBER: Record<string, string> = {
  'first-career': '1',
  'second-career': '2',
  'third-career': '3',
};

// Pre-compute sections by chapter for cleaner rendering
const ABOUT_YOU_SECTIONS = ALL_SECTIONS
  .map((section, index) => ({ ...section, globalIndex: index }))
  .filter(s => s.chapter === 'about-you' && !HIDDEN_SECTION_IDS.has(s.id));

const CAREER_SECTIONS = ALL_SECTIONS
  .map((section, index) => ({ ...section, globalIndex: index }))
  .filter(s => s.chapter === 'career-suggestions' && !HIDDEN_SECTION_IDS.has(s.id));

// Map sidebar section ids to the matching report_sections section_type for
// the top-career sections (single-row, single career per section). Sidebar
// shows the actual career title + company size as a small subline under the
// current section's button when the user is on one of these.
const CAREER_SIDEBAR_SECTIONS: Record<string, string> = {
  'first-career': 'top_career_1',
  'second-career': 'top_career_2',
  'third-career': 'top_career_3',
};

// Multi-row career sections — sidebar shows a count + label so the user
// knows how many cards they're working through.
const MULTI_ROW_SIDEBAR_SECTIONS: Record<string, { sectionType: string; label: (n: number) => string }> = {
  'runner-up': {
    sectionType: 'runner_ups',
    label: (n) => `${n} alternative${n === 1 ? '' : 's'}`,
  },
  'outside-box': {
    sectionType: 'outside_box',
    label: (n) => `${n} unconventional path${n === 1 ? '' : 's'}`,
  },
  'dream-jobs': {
    sectionType: 'dream_jobs',
    label: (n) => `${n} dream job${n === 1 ? '' : 's'}`,
  },
};

// Strip HTML tags + leaked markdown bold tokens from a stored field.
// `report_sections.title` is `<h3><strong>X</strong></h3>` style;
// `company_size_type` is `<h4><strong>Y</strong></h4>`. We just want the
// readable text for the sidebar.
function cleanField(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

interface ReportSidebarProps {
  currentSectionIndex: number; // -1 = none started, 0 = first section, etc.
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSectionClick: (sectionId: string, index: number) => void;
  onCompleteSession?: () => void; // Called when user clicks "Complete Session"
  isSessionCompleted?: boolean; // True when edge function has marked session complete
  // Career rows from `report_sections`. Used to surface the actual career
  // title + company size next to the current top-career section button.
  reportSections?: ReportSection[];
}

export const ReportSidebar: React.FC<ReportSidebarProps> = ({
  currentSectionIndex,
  isCollapsed,
  onToggleCollapse,
  onSectionClick,
  onCompleteSession,
  isSessionCompleted = false,
  reportSections,
}) => {
  const { t } = useTranslation(['report', 'chat']);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Translate a section title using the report namespace, falling back to the English static title
  const translateTitle = (sectionId: string, fallback: string) => {
    const key = SECTION_I18N_KEY[sectionId];
    return key ? t(key, { defaultValue: fallback }) : fallback;
  };

  // Determine section state based on current progress
  const getSectionState = (index: number): 'past' | 'current' | 'upcoming' => {
    if (index < currentSectionIndex) return 'past';
    if (index === currentSectionIndex) return 'current';
    return 'upcoming';
  };

  // Section is clickable if it's been reached (past or current)
  const isClickable = (index: number): boolean => {
    return index <= currentSectionIndex;
  };

  // Handle section click - delegate to parent
  const handleClick = (sectionId: string, index: number) => {
    if (isClickable(index)) {
      onSectionClick(sectionId, index);
      setMobileOpen(false); // Close drawer on mobile after clicking
    }
  };

  // The full section list content — reused by both desktop and mobile drawer
  const sectionContent = (
    <>
      {/* Section Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* About You Chapter */}
        <div className="px-4 py-2">
          <p
            className="text-[10px] font-heading font-black uppercase mb-2.5 text-white/55"
            style={{ letterSpacing: '0.22em', fontWeight: 900 }}
          >{t('chapters.aboutYou')}</p>
          <div className="space-y-1">
            {ABOUT_YOU_SECTIONS.map((section) => (
              <SectionButton
                key={section.id}
                sectionId={section.id}
                title={translateTitle(section.id, section.title)}
                state={getSectionState(section.globalIndex)}
                onClick={() => handleClick(section.id, section.globalIndex)}
                disabled={!isClickable(section.globalIndex)}
              />
            ))}
          </div>
        </div>

        {/* Career Suggestions Chapter */}
        <div className="px-4 py-2 mt-2">
          <p
            className="text-[10px] font-heading font-black uppercase mb-2.5 text-white/55"
            style={{ letterSpacing: '0.22em', fontWeight: 900 }}
          >{t('chapters.careerSuggestions')}</p>
          <div className="space-y-1">
            {CAREER_SECTIONS.map((section) => {
              const state = getSectionState(section.globalIndex);
              // For CURRENT and PAST career sections, surface either the
              // actual career title + size (top-3 single-row) or a count
              // ("4 alternatives") for multi-row sections. Past sections
              // show this as a muted recap; current shows it prominently.
              let careerInfo: { title: string; size: string | null } | null = null;
              if (state === 'current' || state === 'past') {
                const topType = CAREER_SIDEBAR_SECTIONS[section.id];
                const multi = MULTI_ROW_SIDEBAR_SECTIONS[section.id];
                if (topType) {
                  const row = reportSections?.find((r) => r.section_type === topType);
                  const title = cleanField(row?.title);
                  const size = cleanField(row?.company_size_type) || null;
                  if (title) careerInfo = { title, size };
                } else if (multi) {
                  const count = (reportSections ?? []).filter(
                    (r) => r.section_type === multi.sectionType,
                  ).length;
                  if (count > 0) {
                    careerInfo = { title: multi.label(count), size: null };
                  }
                }
              }
              return (
                <SectionButton
                  key={section.id}
                  sectionId={section.id}
                  title={translateTitle(section.id, section.title)}
                  state={state}
                  onClick={() => handleClick(section.id, section.globalIndex)}
                  disabled={!isClickable(section.globalIndex)}
                  careerInfo={careerInfo}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Complete Session Button - shows when edge function marks session complete */}
      {isSessionCompleted && onCompleteSession && (
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <Button
            onClick={onCompleteSession}
            className="w-full bg-atlas-teal hover:bg-atlas-teal/90 text-white"
          >
            <PartyPopper className="h-4 w-4 mr-2" />
            {t('chat:session.completeSession')}
          </Button>
        </div>
      )}

    </>
  );

  return (
    <>
      {/* ===== Mobile: floating toggle button + slide-over drawer ===== */}

      {/* Floating toggle — bottom-right, above input */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed bottom-20 right-3 z-50 flex items-center gap-1.5 bg-white border border-gray-200 shadow-lg rounded-full px-3 py-2 text-xs font-medium text-atlas-navy hover:bg-gray-50 transition-colors"
        >
          <ListOrdered className="h-4 w-4 text-atlas-teal" />
          <span>{Math.max(0, currentSectionIndex)}/{VISIBLE_SECTIONS_COUNT}</span>
        </button>
      )}

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Slide-over drawer */}
      <div
        className={`md:hidden fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-xl flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-atlas-teal" />
            <h2 className="font-heading font-semibold text-atlas-navy text-sm">{t('chat:session.reportSections')}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileOpen(false)}
            className="hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-500" />
          </Button>
        </div>
        {sectionContent}
      </div>

      {/* ===== Desktop: original fixed sidebar ===== */}

      {/* Collapsed desktop sidebar */}
      {isCollapsed ? (
        <div
          className="hidden md:flex w-12 backdrop-blur-[14px] border border-white/10 rounded-[20px] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.45)] flex-col items-center py-4 space-y-2 fixed left-4 top-1/2 -translate-y-1/2 max-h-[calc(100vh-180px)] overflow-y-auto z-40"
          style={{ background: 'rgba(18, 46, 59, 0.55)' }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="hover:bg-white/10 mb-2"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </Button>
          {ALL_SECTIONS.map((section, index) => {
            // Skip hidden sections (Executive Summary) — kept in
            // ALL_SECTIONS only to preserve numeric indices.
            if (HIDDEN_SECTION_IDS.has(section.id)) return null;
            const state = getSectionState(index);
            const clickable = isClickable(index);

            return (
              <button
                key={section.id}
                onClick={() => handleClick(section.id, index)}
                disabled={!clickable}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                  state === 'current'
                    ? 'bg-atlas-teal text-white ring-2 ring-atlas-teal/30 cursor-pointer hover:ring-atlas-teal/50'
                    : state === 'past'
                      ? 'bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/25 cursor-pointer'
                      : 'bg-white/5 text-white/40 cursor-not-allowed'
                }`}
                title={translateTitle(section.id, section.title)}
              >
                {/* Display the VISIBLE 1-indexed position. */}
                {state === 'past' ? <Check className="h-3.5 w-3.5 text-[#EFBE48]" /> : index}
              </button>
            );
          })}
        </div>
      ) : (
        /* Expanded desktop sidebar */
        <div
          className="hidden md:flex w-72 backdrop-blur-[14px] border border-white/10 rounded-[20px] shadow-[0_24px_50px_-22px_rgba(0,0,0,0.45)] flex-col fixed left-4 top-1/2 -translate-y-1/2 max-h-[calc(100vh-180px)] overflow-hidden z-40"
          style={{ background: 'rgba(18, 46, 59, 0.55)' }}
        >
          {/* Header — gold editorial eyebrow */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <FileText className="h-[15px] w-[15px] text-[#EFBE48]" />
              <span
                className="font-heading uppercase text-[11px] text-[#EFBE48]"
                style={{ letterSpacing: '0.22em', fontWeight: 900 }}
              >
                {t('chat:session.reportSections')}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="hover:bg-white/10 h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4 text-white/60" />
            </Button>
          </div>
          {sectionContent}
        </div>
      )}
    </>
  );
};

// Individual section button - simplified props
interface SectionButtonProps {
  sectionId: string;
  title: string;
  state: 'past' | 'current' | 'upcoming';
  onClick: () => void;
  disabled: boolean;
  // When present (current top-career section), shows a small subline
  // under the section title with the actual career title + company size
  // so the user has a reminder of what they're reading.
  careerInfo?: { title: string; size: string | null } | null;
}

const SectionButton: React.FC<SectionButtonProps> = ({ sectionId, title, state, onClick, disabled, careerInfo }) => {
  const SectionIcon = SECTION_ICONS[sectionId];
  const careerNumber = CAREER_NUMBER[sectionId];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-2.5 py-2 rounded-[12px] text-sm font-medium transition-all flex items-start gap-2.5 border ${
        state === 'current'
          ? 'text-white cursor-pointer border-[rgba(39,161,161,0.32)]'
          : state === 'past'
            ? 'text-white hover:bg-white/5 cursor-pointer border-transparent'
            : 'text-white/40 cursor-not-allowed border-transparent'
      }`}
      style={state === 'current' ? { background: 'rgba(39, 161, 161, 0.18)' } : undefined}
    >
      {/* Status icon — pinned to top so the row aligns when a careerInfo
          subline pushes the content to two-or-more lines. */}
      <span className="flex-shrink-0 mt-0.5">
        {state === 'past' && <Check className="h-[15px] w-[15px] text-[#EFBE48]" />}
        {state === 'current' && <Circle className="h-[15px] w-[15px] text-[#EFBE48] fill-[#EFBE48]" />}
        {state === 'upcoming' && <Lock className="h-3.5 w-3.5 text-white/35" />}
      </span>

      {/* Section icon or number badge */}
      {state !== 'past' && (
        careerNumber ? (
          <span className={`w-3.5 text-center text-xs font-bold flex-shrink-0 mt-1 ${
            state === 'current' ? 'text-[#EFBE48]' : 'text-white/65'
          }`}>
            {careerNumber}
          </span>
        ) : SectionIcon ? (
          <SectionIcon className={`h-3.5 w-3.5 flex-shrink-0 mt-1 ${
            state === 'current' ? 'text-[#EFBE48]' : state === 'upcoming' ? 'text-white/35' : 'text-white/65'
          }`} />
        ) : null
      )}

      {/* Title + optional career subline. */}
      <span className={`flex flex-col gap-0.5 min-w-0 flex-1 ${state === 'upcoming' ? 'opacity-70' : ''}`}>
        <span className={state === 'upcoming' ? 'text-white/55' : 'text-white font-bold text-[13px]'}>{title}</span>
        {careerInfo && (state === 'current' || state === 'past') && (
          <>
            <span
              className={`text-[11px] font-semibold truncate leading-tight ${
                state === 'current' ? 'text-[#EFBE48]' : 'text-white/[0.78]'
              }`}
              title={careerInfo.title}
            >
              {careerInfo.title}
            </span>
            {careerInfo.size && (
              <span
                className="text-[11px] truncate leading-tight text-white/50"
                title={careerInfo.size}
              >
                {careerInfo.size}
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
};
