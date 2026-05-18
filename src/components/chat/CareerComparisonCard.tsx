import React, { useState } from 'react';
import { MessageCircle, GitCompare } from 'lucide-react';
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

// One colour per career, used for both the radar polygon and the legend
// text. Amber is the -600 shade so it stays readable as coloured text.
const FOCAL_COLOR = '#0d9488';
const NON_FOCAL_COLORS: Record<string, string> = {
  top_career_1: '#d97706',
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
      color: isFocal ? FOCAL_COLOR : NON_FOCAL_COLORS[type] ?? '#64748b',
      focal: isFocal,
    });
  }

  // Need at least the focal career + one other to be a comparison.
  if (careers.length < 2) return null;

  const { headline, explanation } = focal.metadata.comparison;
  const heading =
    careers.length === 2
      ? 'How it differs from your other top role'
      : 'How it differs from your other top roles';

  const handleExplain = () => {
    if (explained) return;
    onExplain(explanation);
    setExplained(true);
  };

  return (
    <div className="mt-10">
      {/* Styled to match the career section's other h5 subsection headings. */}
      <h5 className="text-lg font-semibold text-atlas-teal mb-3 flex items-center gap-2.5">
        <GitCompare className="w-5 h-5 shrink-0" strokeWidth={2.25} />
        <span>{heading}</span>
      </h5>

      <p className="text-[0.9375rem] text-gray-700 leading-relaxed mb-4">{headline}</p>

      <div className="flex justify-center mb-3">
        <CareerComparisonRadar careers={careers} size={380} />
      </div>

      {/* Legend — career rank + title in the career's colour, no dots. */}
      <div className="flex flex-col gap-1 mb-4">
        {careers.map((c, idx) => (
          <span key={c.label} className="text-sm font-semibold" style={{ color: c.color }}>
            {idx + 1}. {c.label}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={handleExplain}
        disabled={explained}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
          explained
            ? 'bg-gray-100 text-gray-400 cursor-default'
            : 'bg-atlas-teal text-white hover:bg-atlas-teal/90'
        }`}
      >
        <MessageCircle size={15} />
        {explained ? 'Explanation added below' : 'Explain this comparison'}
      </button>
    </div>
  );
};
