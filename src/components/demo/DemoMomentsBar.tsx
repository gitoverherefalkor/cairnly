import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ResolvedAnnotation } from './DemoAnnotation';

interface DemoMomentsBarProps {
  items: ResolvedAnnotation[];
  // Message ids the visitor has scrolled past: those chips light up.
  reachedIds: Set<string>;
  onSelect: (messageId: string) => void;
  title: string;
  // The honest label. Lives here, in the always-visible sticky row, so it is
  // on screen at every scroll position and on every viewport.
  honestLabel: string;
}

/**
 * Second row of the sticky header: the annotated moments as numbered jump
 * chips (the numbers match the badges on the margin notes), plus the honest
 * label. Section navigation is NOT here: that is the real ReportSidebar,
 * exactly as in a live session.
 */
export const DemoMomentsBar: React.FC<DemoMomentsBarProps> = ({
  items,
  reachedIds,
  onSelect,
  title,
  honestLabel,
}) => (
  <div className="border-t border-gray-100">
    {/* Phones: chips on one scrollable row, the honest label on its own row
        underneath. From sm up both sit on one line. */}
    <div className="px-2 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 sm:gap-3">
      <nav
        aria-label={title}
        className="flex items-center gap-1 py-1 sm:py-1.5 whitespace-nowrap overflow-x-auto min-w-0"
      >
        <span
          className="hidden 2xl:inline text-[10px] font-bold uppercase tracking-[0.2em] mr-1.5 shrink-0"
          style={{ color: '#B8860B' }}
        >
          {title}
        </span>
        {items.map((a) => {
          const reached = reachedIds.has(a.messageId);
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onSelect(a.messageId)}
              title={a.legend}
              // Below 1360px only the number fits next to the honest label;
              // the legend text is the tooltip there, and the intro card
              // lists the moments in full.
              className={`flex items-center gap-1.5 rounded-full px-1 min-[1360px]:pr-2.5 py-1 text-[13px] font-semibold transition-colors shrink-0 ${
                reached ? 'text-[#122E3B] hover:bg-[#D4A024]/15' : 'text-gray-500 hover:text-atlas-navy hover:bg-gray-50'
              }`}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors"
                style={
                  reached
                    ? { background: '#D4A024', color: '#1A1A1A' }
                    : { background: 'rgba(18,46,59,0.08)', color: '#4B6373' }
                }
              >
                {a.index}
              </span>
              <span className="hidden min-[1360px]:inline">{a.legend}</span>
            </button>
          );
        })}
      </nav>
      <div className="pb-1.5 sm:pb-0 flex justify-center sm:justify-end shrink-0">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold whitespace-nowrap"
          style={{
            background: 'rgba(212,160,36,0.12)',
            border: '1px solid rgba(212,160,36,0.5)',
            color: '#122E3B',
          }}
        >
          <ShieldCheck size={13} strokeWidth={2.4} className="shrink-0" style={{ color: '#B8860B' }} />
          {honestLabel}
        </span>
      </div>
    </div>
  </div>
);
