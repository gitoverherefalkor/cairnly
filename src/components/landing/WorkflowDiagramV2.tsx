import React from 'react';

/** A node pill inside the workflow graph. */
const Node: React.FC<{ x: number; y: number; label: string; llm?: boolean; width?: number }> = ({
  x,
  y,
  label,
  llm,
  width = 124,
}) => (
  <g transform={`translate(${x}, ${y})`}>
    <rect width={width} height="26" rx="6" fill="#ECE4D2" />
    <circle cx="9" cy="13" r="2.4" fill={llm ? '#D4A024' : '#27A1A1'} />
    <text
      x={(width + 8) / 2}
      y="17"
      textAnchor="middle"
      fontFamily="Inter"
      fontSize="10"
      fontWeight="600"
      fill="#122E3B"
    >
      {label}
    </text>
  </g>
);

type RowDef = {
  label: string;
  a: { l: string; llm?: boolean };
  b: { l: string; llm?: boolean };
};

type PhaseDef = {
  name: string;
  desc: string;
  rows: RowDef[];
};

const PHASES: PhaseDef[] = [
  {
    name: 'PROFILE',
    desc: 'Who you are',
    rows: [
      { label: 'Read your résumé',   a: { l: 'Parse PDF' },                    b: { l: 'Pull skills', llm: true } },
      { label: 'Read your survey',   a: { l: 'Parse 50+ answers' },            b: { l: 'Extract signals', llm: true } },
      { label: 'Build your profile', a: { l: 'Synthesize values', llm: true }, b: { l: 'Save profile' } },
    ],
  },
  {
    name: 'MATCH',
    desc: 'Find your roles',
    rows: [
      { label: 'Scan 1000+ roles',       a: { l: 'Match to profile' },             b: { l: 'Pull salary data' } },
      { label: 'Enrich & rank for fit',  a: { l: 'Re-rank on values', llm: true }, b: { l: 'Score AI-impact', llm: true } },
      { label: 'Write your top matches', a: { l: 'Write top 3', llm: true },       b: { l: 'Write runner-ups', llm: true } },
      { label: 'Wild cards & dream job', a: { l: 'Generate ideas', llm: true },    b: { l: 'Dream-job analysis', llm: true } },
    ],
  },
  {
    name: 'SELECT',
    desc: 'Choose your direction',
    rows: [
      { label: 'Coach trained on you', a: { l: 'Discuss results', llm: true }, b: { l: 'Listen to feedback', llm: true } },
      { label: 'Land the job',         a: { l: 'Find open roles' },            b: { l: 'Tune CV + cover', llm: true } },
    ],
  },
];

const REPORT_ROWS = [
  'Honest personality read',
  'Top 3 matches',
  'Runner-up roles',
  'Outside-the-box',
  'Dream-job feasibility',
  'AI-impact ratings',
  'Salary ranges',
  'Open roles to apply',
  'Tuned CV + cover letter',
];

// Vertically center the deliverable list between the panel's title-divider and footer-pill.
const REPORT_CONTENT_TOP_OFFSET = 50;    // y-offset from REPORT_Y to where content area starts
const REPORT_FOOTER_HEIGHT = 54;          // height of the "Ready" footer pill
const REPORT_ITEM_GAP = 38;

// Layout constants — BASE_Y and REPORT_Y are tuned so the whole diagram sits
// vertically centered between the top edge and the legend at y=612.
const BASE_Y = 95;
const ROW_HEIGHT = 36;
const PHASE_HEADER_HEIGHT = 26;
const PHASE_GAP = 10;
const TRUNK_X = 520;
const REPORT_X = 600;
const REPORT_W = 180;
const REPORT_Y = 80;
const REPORT_H = 480;

// Build flat layout with computed Y positions
type LayoutItem =
  | { kind: 'phase'; y: number; name: string; desc: string }
  | { kind: 'row'; y: number; row: RowDef; index: number };

const LAYOUT: LayoutItem[] = (() => {
  const items: LayoutItem[] = [];
  let y = BASE_Y;
  let idx = 0;
  PHASES.forEach((phase, pi) => {
    items.push({ kind: 'phase', y, name: phase.name, desc: phase.desc });
    y += PHASE_HEADER_HEIGHT;
    phase.rows.forEach((row) => {
      items.push({ kind: 'row', y, row, index: idx });
      idx += 1;
      y += ROW_HEIGHT;
    });
    if (pi < PHASES.length - 1) y += PHASE_GAP;
  });
  return items;
})();

const ROWS_FLAT = LAYOUT.filter((i): i is Extract<LayoutItem, { kind: 'row' }> => i.kind === 'row');
const PHASES_FLAT = LAYOUT.filter((i): i is Extract<LayoutItem, { kind: 'phase' }> => i.kind === 'phase');
const TOTAL_ROWS = ROWS_FLAT.length;
const REPORT_HUB_Y = REPORT_Y + REPORT_H / 2;

// Sequential wave timing — all animations share one master cycle so they stay in sync forever
const STEP_DELAY = 0.55;
const PULSE_DUR = 1.3;
const CYCLE_DUR = TOTAL_ROWS * STEP_DELAY + 1.4;

const fmt = (n: number) => n.toFixed(4);

const WorkflowDiagramV2: React.FC = () => (
  <>
    {/* Desktop / wide-tablet animated SVG */}
    <div
      className="hidden lg:block lp-screenshot-slot lp-on-dark aspect-[5/4] w-full"
      style={{ background: '#122E3B' }}
    >
      <div className="lp-screenshot-slot__meta">Engine</div>
      <svg
        viewBox="0 0 800 640"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <pattern id="wfGrid2" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.5" fill="rgba(255,255,255,0.05)" />
          </pattern>
          <filter id="wfGlow2" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>
          <marker id="wfArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="rgba(255,255,255,0.45)" />
          </marker>
        </defs>
        <rect width="800" height="640" fill="url(#wfGrid2)" />

        {/* Report panel */}
        <rect
          x={REPORT_X}
          y={REPORT_Y}
          width={REPORT_W}
          height={REPORT_H}
          rx="16"
          fill="#FBF6E8"
          stroke="#D4A024"
          strokeWidth="1.5"
          strokeOpacity="0.8"
        >
          {/* Subtle pulse at end of every cycle = "report ready" */}
          <animate
            attributeName="stroke-opacity"
            values="0.8;0.8;1;0.8"
            keyTimes="0;0.88;0.96;1"
            dur={`${CYCLE_DUR}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-width"
            values="1.5;1.5;2.6;1.5"
            keyTimes="0;0.88;0.96;1"
            dur={`${CYCLE_DUR}s`}
            repeatCount="indefinite"
          />
        </rect>
        <text x={REPORT_X + REPORT_W / 2} y={REPORT_Y + 26} textAnchor="middle" fontFamily="Poppins" fontSize="11" fontWeight="700" fill="#1F8282" letterSpacing="2">
          REPORT
        </text>
        <line x1={REPORT_X + 18} y1={REPORT_Y + 41} x2={REPORT_X + REPORT_W - 18} y2={REPORT_Y + 41} stroke="rgba(31,130,130,0.2)" />
        {(() => {
          const contentTop = REPORT_Y + REPORT_CONTENT_TOP_OFFSET;
          const contentBottom = REPORT_Y + REPORT_H - REPORT_FOOTER_HEIGHT;
          const itemsHeight = (REPORT_ROWS.length - 1) * REPORT_ITEM_GAP;
          const firstItemY = contentTop + (contentBottom - contentTop - itemsHeight) / 2;
          return (
            <>
              <g fontFamily="Inter" fontSize="10.5" fontWeight="600" fill="#122E3B">
                {REPORT_ROWS.map((row, i) => (
                  <text key={row} x={REPORT_X + 24} y={firstItemY + i * REPORT_ITEM_GAP}>
                    {row}
                  </text>
                ))}
              </g>
              <g>
                {REPORT_ROWS.map((_, i) => (
                  <circle
                    key={i}
                    cx={REPORT_X + 14}
                    cy={firstItemY + i * REPORT_ITEM_GAP - 4}
                    r="2.2"
                    fill="#27A1A1"
                  />
                ))}
              </g>
            </>
          );
        })()}
        <rect x={REPORT_X} y={REPORT_Y + REPORT_H - 54} width={REPORT_W} height="54" rx="12" fill="rgba(39,161,161,0.12)" stroke="rgba(39,161,161,0.3)" />
        <text x={REPORT_X + REPORT_W / 2} y={REPORT_Y + REPORT_H - 32} textAnchor="middle" fontFamily="Poppins" fontSize="11" fontWeight="800" fill="#27A1A1">
          Ready within 5 minutes
        </text>
        <text x={REPORT_X + REPORT_W / 2} y={REPORT_Y + REPORT_H - 16} textAnchor="middle" fontFamily="Inter" fontSize="9" fill="rgba(18,46,59,0.55)">
          refined by your coaching chat
        </text>

        {/* Phase headers */}
        {PHASES_FLAT.map((phase, i) => (
          <g key={phase.name}>
            <line x1="20" y1={phase.y + 17} x2="500" y2={phase.y + 17} stroke="rgba(212,160,36,0.18)" strokeWidth="1" strokeDasharray="2 4" />
            <text x="20" y={phase.y + 13} fontFamily="Poppins" fontSize="9.5" fontWeight="700" fill="#D4A024" letterSpacing="2.5">
              {`0${i + 1}`}
            </text>
            <text x="42" y={phase.y + 13} fontFamily="Poppins" fontSize="9.5" fontWeight="700" fill="#D4A024" letterSpacing="2.5">
              {phase.name}
            </text>
            <text x={42 + phase.name.length * 7 + 14} y={phase.y + 13} fontFamily="Inter" fontSize="9.5" fontWeight="500" fill="rgba(255,255,255,0.4)" letterSpacing="0.5">
              · {phase.desc}
            </text>
          </g>
        ))}

        {/* Lane labels */}
        <g fontFamily="Poppins" fontSize="11" fontWeight="700" fill="#ECE4D2" textAnchor="end">
          {ROWS_FLAT.map((item) => (
            <text key={item.row.label} x="185" y={item.y + 17}>
              {item.row.label}
            </text>
          ))}
        </g>

        {/* Static connectors */}
        <g stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" fill="none">
          {ROWS_FLAT.map((item) => {
            const y = item.y + 13;
            return <path key={`ab-${item.index}`} d={`M 334 ${y} L 345 ${y}`} markerEnd="url(#wfArrow)" />;
          })}
          {ROWS_FLAT.map((item) => {
            const y = item.y + 13;
            return <path key={`bt-${item.index}`} d={`M 469 ${y} L ${TRUNK_X} ${y}`} />;
          })}
          {/* Trunk */}
          <path
            d={`M ${TRUNK_X} ${ROWS_FLAT[0].y + 13} L ${TRUNK_X} ${ROWS_FLAT[TOTAL_ROWS - 1].y + 13}`}
            stroke="rgba(212,160,36,0.5)"
            strokeWidth="1.8"
          />
          {/* Trunk → Report */}
          <path
            d={`M ${TRUNK_X} ${REPORT_HUB_Y} C 555 ${REPORT_HUB_Y}, 580 ${REPORT_HUB_Y}, ${REPORT_X} ${REPORT_HUB_Y}`}
            stroke="rgba(212,160,36,0.65)"
            strokeWidth="2.2"
          />
        </g>

        {/* Trunk junction dots */}
        <g fill="rgba(212,160,36,0.7)">
          {ROWS_FLAT.map((item) => (
            <circle key={item.index} cx={TRUNK_X} cy={item.y + 13} r="2.4" />
          ))}
        </g>

        {/* Nodes */}
        {ROWS_FLAT.map((item) => (
          <g key={`nodes-${item.index}`}>
            <Node x={210} y={item.y} label={item.row.a.l} llm={item.row.a.llm} />
            <Node x={345} y={item.y} label={item.row.b.l} llm={item.row.b.llm} />
          </g>
        ))}

        {/*
          Synced sequential wave.
          Every pulse shares one master cycle of CYCLE_DUR seconds. It uses keyTimes/keyPoints
          to "hold at start" until its turn, "travel" during its window, then "hold at end" until
          the cycle restarts. That way all 9 pulses stay in lockstep forever — true sequential wave.
        */}
        <g fill="#E3B04D" filter="url(#wfGlow2)">
          {ROWS_FLAT.map((item) => {
            const y = item.y + 13;
            const path = `M 210 ${y} L 334 ${y} L 345 ${y} L 469 ${y} L ${TRUNK_X} ${y} L ${TRUNK_X} ${REPORT_HUB_Y} L ${REPORT_X} ${REPORT_HUB_Y}`;
            const start = (item.index * STEP_DELAY) / CYCLE_DUR;
            const end = (item.index * STEP_DELAY + PULSE_DUR) / CYCLE_DUR;
            const startSafe = Math.max(start, 0.0001);
            const endSafe = Math.min(end, 0.9999);
            // 6-stop opacity envelope: invisible → fade in → on → fade out → invisible
            const fadeWindow = 0.02;
            const fadeIn = Math.max(startSafe - fadeWindow, 0);
            const fadeOut = Math.min(endSafe + fadeWindow, 1);
            return (
              <circle key={item.index} r="3.2" opacity="0">
                <animate
                  attributeName="opacity"
                  values="0;0;1;1;0;0"
                  keyTimes={`0;${fmt(fadeIn)};${fmt(startSafe)};${fmt(endSafe)};${fmt(fadeOut)};1`}
                  dur={`${CYCLE_DUR}s`}
                  repeatCount="indefinite"
                />
                <animateMotion
                  dur={`${CYCLE_DUR}s`}
                  repeatCount="indefinite"
                  keyTimes={`0;${fmt(startSafe)};${fmt(endSafe)};1`}
                  keyPoints="0;0;1;1"
                  calcMode="linear"
                  path={path}
                />
              </circle>
            );
          })}
        </g>

        {/* Active-lane highlight bar — pulses gold behind the label of whichever lane is firing */}
        <g>
          {ROWS_FLAT.map((item) => {
            const start = (item.index * STEP_DELAY) / CYCLE_DUR;
            const end = (item.index * STEP_DELAY + PULSE_DUR * 0.85) / CYCLE_DUR;
            const startSafe = Math.max(start, 0.0001);
            const endSafe = Math.min(end, 0.9999);
            const fadeWindow = 0.015;
            const fadeIn = Math.max(startSafe - fadeWindow, 0);
            const fadeOut = Math.min(endSafe + fadeWindow, 1);
            return (
              <rect
                key={`hl-${item.index}`}
                x="20"
                y={item.y + 4}
                width="170"
                height="18"
                rx="4"
                fill="#D4A024"
                opacity="0"
              >
                <animate
                  attributeName="opacity"
                  values="0;0;0.18;0.18;0;0"
                  keyTimes={`0;${fmt(fadeIn)};${fmt(startSafe)};${fmt(endSafe)};${fmt(fadeOut)};1`}
                  dur={`${CYCLE_DUR}s`}
                  repeatCount="indefinite"
                />
              </rect>
            );
          })}
        </g>

        {/* Legend */}
        <g transform="translate(30, 612)" fontFamily="Inter" fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.55)">
          <circle cx="5" cy="5" r="2.5" fill="#27A1A1" />
          <text x="14" y="8">Data / code</text>
          <circle cx="95" cy="5" r="2.5" fill="#D4A024" />
          <text x="104" y="8">LLM call</text>
        </g>
      </svg>
    </div>

    {/* Mobile / small-tablet stacked fallback */}
    <div
      className="lg:hidden rounded-2xl p-6 sm:p-7"
      style={{ background: '#122E3B', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center justify-end mb-5">
        <span className="text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
          → Report
        </span>
      </div>
      <div className="space-y-5">
        {PHASES.map((phase, pi) => (
          <div key={phase.name}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#D4A024] font-heading font-bold text-[10px] tracking-[0.22em]">
                {`0${pi + 1} · ${phase.name}`}
              </span>
              <span className="text-white/40 text-[10px]">· {phase.desc}</span>
              <span className="flex-1 h-px bg-white/10 ml-1" />
            </div>
            <ol className="space-y-2 pl-1">
              {phase.rows.map((row) => (
                <li key={row.label} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4A024]" />
                  <span className="text-white font-medium text-[14px]">{row.label}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-end text-[11px] text-[#27A1A1]">
        Ready within 5 minutes
      </div>
    </div>
  </>
);

export default WorkflowDiagramV2;
