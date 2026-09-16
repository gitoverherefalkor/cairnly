import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, ShieldCheck } from 'lucide-react';
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
  // The persona's finished dashboard. The same link closes the footer, but
  // that one is only reachable after scrolling the whole transcript — this
  // puts it one click away at any point in the replay.
  dashboardHref: string;
  dashboardLabel: string;
  onDashboardClick?: () => void;
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
  dashboardHref,
  dashboardLabel,
  onDashboardClick,
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
          className="hidden min-[1580px]:inline text-[10px] font-bold uppercase tracking-[0.2em] mr-1.5 shrink-0"
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
              // Below 1460px only the number fits beside the dashboard link
              // and the honest label; the legend text is the tooltip there,
              // and the intro card lists the moments in full.
              className={`flex items-center gap-1.5 rounded-full px-1 min-[1460px]:pr-2.5 py-1 text-[13px] font-semibold transition-colors shrink-0 ${
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
              <span className="hidden min-[1460px]:inline">{a.legend}</span>
            </button>
          );
        })}
      </nav>
      <div className="pb-1.5 sm:pb-0 flex items-center justify-center sm:justify-end gap-2 shrink-0">
        {/* Teal so it reads as the one thing here you can go to, against the
            gold chips (jumps within this page) and the gold honest label. */}
        <Link
          to={dashboardHref}
          onClick={onDashboardClick}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors hover:bg-[#1F8282]/12"
          style={{
            background: 'rgba(31,130,130,0.08)',
            border: '1px solid rgba(31,130,130,0.4)',
            color: '#1F8282',
          }}
        >
          <LayoutDashboard size={13} strokeWidth={2.4} className="shrink-0" />
          {dashboardLabel}
          <ArrowRight size={12} strokeWidth={2.4} className="shrink-0" />
        </Link>
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
