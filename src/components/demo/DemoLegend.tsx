import React from 'react';
import type { ResolvedAnnotation } from './DemoAnnotation';

interface DemoLegendProps {
  items: ResolvedAnnotation[];
  // Message ids the visitor has scrolled past: those entries light up.
  reachedIds: Set<string>;
  onSelect: (messageId: string) => void;
  title: string;
  hint: string;
}

/**
 * The legend rail: every annotated moment, numbered in transcript order,
 * each a jump link. Sticky in the left margin on wide screens; on smaller
 * screens the same list lives in the intro card (see Demo.tsx).
 */
export const DemoLegend: React.FC<DemoLegendProps> = ({ items, reachedIds, onSelect, title, hint }) => {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label={title}
      className="rounded-xl px-3.5 py-4"
      style={{
        background: '#FBF6E8',
        border: '1px solid rgba(212,160,36,0.55)',
        boxShadow: '0 18px 36px -24px rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="px-2 text-[10px] font-bold uppercase tracking-[0.22em] mb-2.5"
        style={{ color: '#B8860B' }}
      >
        {title}
      </div>
      <ol className="space-y-0.5">
        {items.map((a) => {
          const reached = reachedIds.has(a.messageId);
          return (
            <li key={a.key}>
              <button
                type="button"
                onClick={() => onSelect(a.messageId)}
                className="w-full flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#D4A024]/10"
              >
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold mt-px transition-colors"
                  style={
                    reached
                      ? { background: '#D4A024', color: '#1A1A1A' }
                      : { background: 'rgba(18,46,59,0.08)', color: '#4B6373' }
                  }
                >
                  {a.index}
                </span>
                <span
                  className="text-[13px] leading-snug font-semibold"
                  style={{ color: reached ? '#122E3B' : '#4B6373' }}
                >
                  {a.legend}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 px-2 text-[11px] font-medium" style={{ color: 'rgba(75,99,115,0.8)' }}>
        {hint}
      </p>
    </nav>
  );
};
