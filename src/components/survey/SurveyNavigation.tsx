import React from 'react';
import { CheckCircle, Lock, LockOpen, Loader2, Mountain } from 'lucide-react';
import { useAssessmentSession } from '@/components/assessment/AssessmentSessionContext';

interface Section {
  id: string;
  title: string;
}

interface SurveyNavigationProps {
  sections: Section[];
  currentSectionIndex: number;
  completedSections: number[];
  onSectionClick: (sectionIndex: number) => void;
  currentQuestionInSection?: number;
  totalQuestionsInSection?: number;
  /** When set, the autosave block is temporarily replaced by this encouragement message. */
  activeMilestone?: string | null;
}

// Encouragement message — temporarily takes the autosave block's place in the
// sidebar when the user crosses a progress milestone. Mustard card so it reads
// as a distinct, positive beat rather than blending into the survey chrome.
const MilestoneNotice: React.FC<{ message: string }> = ({ message }) => (
  <div className="mt-5 pt-5 border-t border-white/10 px-1">
    <div className="flex items-start gap-3 rounded-lg bg-atlas-gold p-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <Mountain className="h-5 w-5 text-white flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium text-white leading-relaxed">{message}</p>
    </div>
  </div>
);

// Small reassurance block — tells users their progress is safely stored and they can close
// the tab at any time. Briefly flashes a spinner when an actual save is triggered.
const AutoSaveNotice: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { saveStatus } = useAssessmentSession();
  const isSaving = saveStatus === 'saving';

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 mt-2">
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin text-atlas-gold" />
        ) : (
          <CheckCircle className="h-3 w-3 text-atlas-gold" />
        )}
        <span>{isSaving ? 'Saving…' : 'Progress auto-saved'}</span>
      </div>
    );
  }

  // Aligned to match the section-item layout above.
  return (
    <div className="mt-5 pt-5 border-t border-white/10 px-1">
      <div className="flex items-center gap-3 mb-1">
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#EFBE48] flex-shrink-0" />
        ) : (
          <CheckCircle className="h-4 w-4 text-[#EFBE48] flex-shrink-0" />
        )}
        <p className="text-[12.5px] font-semibold text-white">
          {isSaving ? 'Saving…' : 'Progress auto-saved'}
        </p>
      </div>
      <p className="text-[11px] text-white/60 leading-snug pl-7">
        Safe to close this tab and return later. Your answers stay where you left off.
      </p>
    </div>
  );
};

export const SurveyNavigation: React.FC<SurveyNavigationProps> = ({
  sections,
  currentSectionIndex,
  completedSections,
  onSectionClick,
  currentQuestionInSection,
  totalQuestionsInSection,
  activeMilestone
}) => {
  const getSectionStatus = (sectionIndex: number) => {
    // `current` wins over `completed` — the section you're working on shouldn't
    // display a completion checkmark until you've actually moved past it.
    if (sectionIndex === currentSectionIndex) {
      return 'current';
    } else if (completedSections.includes(sectionIndex)) {
      return 'completed';
    } else if (sectionIndex < currentSectionIndex) {
      return 'accessible';
    } else {
      return 'locked';
    }
  };

  const getSectionIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-[18px] w-[18px] text-[#EFBE48]" />;
      case 'current':
        return <LockOpen className="h-4 w-4 text-[#2ABFBF]" />;
      case 'accessible':
        return <LockOpen className="h-4 w-4 text-[#2ABFBF]" />;
      default:
        return <Lock className="h-4 w-4 text-white/35" />;
    }
  };

  return (
    <aside
      className="hidden md:flex w-80 h-fit flex-col p-[22px] rounded-[20px] border border-white/10 shadow-[0_24px_50px_-22px_rgba(0,0,0,0.45)] backdrop-blur-[14px]"
      style={{ background: 'rgba(18, 46, 59, 0.55)' }}
    >
      {/* Gold editorial eyebrow */}
      <div
        className="text-[11px] font-heading font-black uppercase mb-4 text-[#EFBE48]"
        style={{ letterSpacing: '0.24em', fontWeight: 900 }}
      >
        Your Progress
      </div>

      <div className="space-y-3.5 flex-1">
        {sections.map((section, index) => {
          const status = getSectionStatus(index);
          const isClickable = status === 'completed' || status === 'accessible' || status === 'current';

          const showProgress =
            status === 'current' &&
            typeof currentQuestionInSection === 'number' &&
            typeof totalQuestionsInSection === 'number' &&
            totalQuestionsInSection > 0;
          const progressPct = showProgress
            ? Math.min(100, (currentQuestionInSection! / totalQuestionsInSection!) * 100)
            : 0;
          const isCurrent = status === 'current';

          return (
            <div
              key={section.id}
              onClick={() => isClickable ? onSectionClick(index) : undefined}
              className={`transition-colors rounded-[12px] ${
                isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
              } ${
                isCurrent
                  ? 'p-3 border border-[rgba(39,161,161,0.32)]'
                  : 'p-0 border border-transparent'
              }`}
              style={isCurrent ? { background: 'rgba(39, 161, 161, 0.18)' } : undefined}
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 mt-0.5">{getSectionIcon(status)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-[13px] font-bold truncate ${
                        status === 'locked' ? 'text-white/65' : 'text-white'
                      }`}
                    >
                      Section {index + 1}
                    </p>
                    {showProgress && (
                      <span className="text-[11px] font-bold whitespace-nowrap text-[#EFBE48]">
                        Q{currentQuestionInSection} /{totalQuestionsInSection}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs truncate mt-0.5 ${
                      status === 'locked'
                        ? 'text-white/40'
                        : isCurrent
                          ? 'text-white/[0.78]'
                          : 'text-white/50'
                    }`}
                  >
                    {section.title}
                  </p>
                  {showProgress && (
                    <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full transition-all duration-500 ease-out rounded-full"
                        style={{
                          width: `${progressPct}%`,
                          background: 'linear-gradient(90deg, #27A1A1 0%, #EFBE48 100%)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {activeMilestone ? <MilestoneNotice message={activeMilestone} /> : <AutoSaveNotice />}
    </aside>
  );
};

// Compact mobile step indicator — shown only on small screens
export const MobileStepIndicator: React.FC<{
  sections: Section[];
  currentSectionIndex: number;
  completedSections: number[];
  onSectionClick: (sectionIndex: number) => void;
}> = ({ sections, currentSectionIndex, completedSections, onSectionClick }) => {
  const getSectionStatus = (sectionIndex: number) => {
    // Same rule as the desktop sidebar: the current section never shows a checkmark
    // even if it's already been added to completedSections on intro.
    if (sectionIndex === currentSectionIndex) return 'current';
    if (completedSections.includes(sectionIndex)) return 'completed';
    if (sectionIndex < currentSectionIndex) return 'accessible';
    return 'locked';
  };

  return (
    <div className="md:hidden py-3">
      <div className="flex items-center justify-center gap-2">
        {sections.map((section, index) => {
          const status = getSectionStatus(index);
          const isClickable = status === 'completed' || status === 'accessible' || status === 'current';

          return (
            <button
              key={section.id}
              onClick={() => isClickable ? onSectionClick(index) : undefined}
              disabled={!isClickable}
              title={`Section ${index + 1}: ${section.title}`}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                status === 'current'
                  ? 'bg-atlas-teal text-white ring-2 ring-atlas-teal/30 scale-110'
                  : status === 'completed'
                    ? 'bg-atlas-gold/20 text-atlas-gold'
                    : status === 'accessible'
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              {status === 'completed' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </button>
          );
        })}
      </div>
      <AutoSaveNotice compact />
    </div>
  );
};
