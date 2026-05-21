
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ClipboardList, Brain, Compass, Briefcase, Users, HeartHandshake, Target, type LucideIcon } from 'lucide-react';
import CairnProgress from './CairnProgress';

interface SectionIntroductionProps {
  sectionNumber: number;
  sectionTitle: string;
  description: string;
  onContinue: () => void;
  /** Sections finished so far — drives the cairn. 0 on the very first intro. */
  completedCount?: number;
  /** Title of the section just finished; null on the very first intro. */
  justCompletedTitle?: string | null;
}

// Icon per section (1-indexed) — shown at the top of each section intro so the
// topic is recognisable at a glance.
const SECTION_ICONS: LucideIcon[] = [
  ClipboardList,  // 1 — Intake Questions
  Brain,          // 2 — Personality and Decision-Making
  Compass,        // 3 — Values and Motivations
  Briefcase,      // 4 — Professional Interests and Skills
  Users,          // 5 — Work Environment and Team Preferences
  HeartHandshake, // 6 — Emotional Intelligence
  Target,         // 7 — Career Goals and Development
];

export const SectionIntroduction: React.FC<SectionIntroductionProps> = ({
  sectionNumber,
  sectionTitle,
  description,
  onContinue,
  completedCount = 0,
  justCompletedTitle = null,
}) => {
  const Icon = SECTION_ICONS[sectionNumber - 1];

  // Function to format text with emphasis and line breaks
  const formatTextWithEmphasis = (text: string) => {
    // Replace **text** with <strong>text</strong> and \n with <br>
    const formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\\n/g, '<br>');
    return { __html: formattedText };
  };

  return (
    <div className="max-w-4xl mx-auto h-full">
      <div
        className="relative overflow-hidden rounded-[22px] border shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45)] h-full"
        style={{
          background: '#FDFBF2',
          borderColor: 'rgba(201, 182, 144, 0.6)',
        }}
      >
        {/* Soft gold radial bloom top-right — same as the question card. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            top: -60,
            right: -60,
            width: 280,
            height: 280,
            background:
              'radial-gradient(circle, rgba(212,160,36,0.18) 0%, rgba(212,160,36,0) 70%)',
          }}
        />
        <div className="relative text-center pt-6 pb-12 px-8 h-full flex flex-col justify-center">
          {justCompletedTitle && (
            <div className="mb-8 pb-8 border-b border-border">
              <CairnProgress
                key={completedCount}
                stones={completedCount}
                className="mx-auto h-44 w-auto"
              />
              <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-atlas-gold">
                Great! You finished:
              </p>
              <h2 className="mt-1 text-2xl font-bold text-atlas-navy">
                {justCompletedTitle}
              </h2>
            </div>
          )}

          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            {justCompletedTitle ? 'Up next' : `Section ${sectionNumber}`}
          </p>
          <h3 className="text-2xl font-semibold text-atlas-teal mb-5">
            {sectionTitle}
          </h3>
          {Icon && (
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-atlas-teal/10">
              <Icon className="h-8 w-8 text-atlas-teal" />
            </div>
          )}
          <div
            className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto"
            dangerouslySetInnerHTML={formatTextWithEmphasis(description)}
          />
          <Button
            onClick={onContinue}
            className="self-center bg-atlas-teal hover:bg-atlas-teal/90 px-8 py-3 text-lg"
          >
            Continue
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
