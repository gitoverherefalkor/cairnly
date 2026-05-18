import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { ReportSection } from '@/hooks/useReportSections';
import { CareerComparisonRadar, type RadarCareer } from '@/components/career/CareerComparisonRadar';

interface CareerComparisonCardProps {
  // All report sections (from useReportSections) — used to read the
  // top_career rows and their fit_scores.
  sections: ReportSection[];
  // Which career this card belongs to.
  focalSectionType: 'top_career_2' | 'top_career_3';
  // Posts the pre-written explanation into the chat as a bot message.
  onExplain: (explanation: string) => void;
}

const FOCAL_COLOR = '#0d9488';
const NON_FOCAL_COLORS: Record<string, string> = {
  top_career_1: '#f59e0b',
  top_career_2: '#6366f1',
};

// Career order on screen — the careers plotted depend on the focal one.
const CAREER_ORDER = ['top_career_1', 'top_career_2', 'top_career_3'] as const;

function stripHtml(raw: string | null): string {
  if (!raw) return '';
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export const CareerComparisonCard: React.FC<CareerComparisonCardProps> = ({
  sections,
  focalSectionType,
  onExplain,
}) => {
  const [explained, setExplained] = useState(false);

  const focal = sections.find((s) => s.section_type === focalSectionType);
  if (!focal || !focal.metadata?.fit_scores || !focal.metadata?.comparison) {
    return null;
  }

  // Plot every career up to and including the focal one.
  const focalIndex = CAREER_ORDER.indexOf(focalSectionType);
  const careers: RadarCareer[] = [];
  for (let i = 0; i <= focalIndex; i++) {
    const type = CAREER_ORDER[i];
    const section = sections.find((s) => s.section_type === type);
    const scores = section?.metadata?.fit_scores;
    if (!section || !scores) continue;
    const isFocal = type === focalSectionType;
    careers.push({
      label: stripHtml(section.title) || `Career ${i + 1}`,
      scores,
      color: isFocal ? FOCAL_COLOR : NON_FOCAL_COLORS[type] ?? '#94a3b8',
      focal: isFocal,
    });
  }

  // Need at least the focal career + one other to be a comparison.
  if (careers.length < 2) return null;

  const { headline, explanation } = focal.metadata.comparison;

  const handleExplain = () => {
    if (explained) return;
    onExplain(explanation);
    setExplained(true);
  };

  return (
    <div className="mt-4 rounded-xl border border-atlas-teal/30 bg-white p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-atlas-teal mb-1.5">
        How this differs
      </div>
      <p className="text-sm text-atlas-navy font-medium leading-snug mb-3">{headline}</p>

      {/* Radar and legend sit side by side; they stack on a narrow bubble. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-shrink-0 mx-auto sm:mx-0">
          <CareerComparisonRadar careers={careers} size={250} />
        </div>

        <div className="flex-1 min-w-[170px]">
          <div className="flex flex-col gap-1.5 mb-3">
            {careers.map((c, idx) => (
              <span
                key={c.label}
                className="flex items-start gap-2 text-xs font-medium text-atlas-navy leading-snug"
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 mt-[3px]"
                  style={{ backgroundColor: c.color }}
                />
                <span>
                  <span className="font-bold">{idx + 1}.</span> {c.label}
                </span>
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExplain}
            disabled={explained}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              explained
                ? 'bg-gray-100 text-gray-400 cursor-default'
                : 'bg-atlas-teal text-white hover:bg-atlas-teal/90'
            }`}
          >
            <MessageCircle size={14} />
            {explained ? 'Explanation added below' : 'Explain this comparison'}
          </button>
        </div>
      </div>
    </div>
  );
};
