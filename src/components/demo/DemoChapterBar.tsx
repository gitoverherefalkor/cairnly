import React from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import type { DemoChapterId } from '@/demo/chapters';

export interface DemoChapterItem {
  id: DemoChapterId;
  label: string;
  reachable: boolean;
}

interface DemoChapterBarProps {
  chapters: DemoChapterItem[];
  activeId: DemoChapterId | null;
  onSelect: (id: DemoChapterId) => void;
  // The honest label. Lives here, in the always-visible sticky row, so it is
  // on screen at every scroll position and on every viewport.
  honestLabel: string;
}

/**
 * Sticky chapter row of the demo replay: Persoonlijkheid → Carrières →
 * Droombanen. Clicking scrolls to the first message of that chapter; the
 * active chapter follows the scroll position (computed by the page).
 */
export const DemoChapterBar: React.FC<DemoChapterBarProps> = ({
  chapters,
  activeId,
  onSelect,
  honestLabel,
}) => (
  <div className="border-t border-gray-100">
    {/* Phones: chapters on one scrollable row, the honest label on its own
        row underneath, so the label never scrolls out of sight. From sm up
        both sit on one line. */}
    <div className="px-2 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0 sm:gap-3">
      <nav
        aria-label="Chapters"
        className="flex items-center gap-0.5 py-1 sm:py-1.5 whitespace-nowrap overflow-x-auto"
      >
        {chapters.map((ch, i) => {
          const active = ch.id === activeId;
          return (
            <React.Fragment key={ch.id}>
              {i > 0 && <ChevronRight size={14} className="text-gray-300 shrink-0" aria-hidden="true" />}
              <button
                type="button"
                onClick={() => onSelect(ch.id)}
                disabled={!ch.reachable}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] sm:text-sm font-semibold transition-colors disabled:opacity-40 ${
                  active
                    ? 'bg-atlas-teal/10 text-atlas-teal'
                    : 'text-gray-500 hover:text-atlas-navy hover:bg-gray-50'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    active ? 'bg-atlas-teal text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {i + 1}
                </span>
                {ch.label}
              </button>
            </React.Fragment>
          );
        })}
      </nav>
      <div className="pb-1.5 sm:pb-0 flex justify-center sm:justify-end">
        <span
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-semibold whitespace-nowrap"
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
