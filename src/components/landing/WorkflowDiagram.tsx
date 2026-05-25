import React from 'react';

/** A node pill inside the workflow graph. */
const Node: React.FC<{ x: number; y: number; label: string; llm?: boolean }> = ({ x, y, label, llm }) => (
  <g transform={`translate(${x}, ${y})`}>
    <rect width="80" height="24" rx="5" fill="#ECE4D2" />
    <circle cx="8" cy="12" r="2.2" fill={llm ? '#D4A024' : '#27A1A1'} />
    <text x="40" y="16" textAnchor="middle" fill="#122E3B">{label}</text>
  </g>
);

const REPORT_ROWS = [
  'Top 3 matches', 'Runner-up roles', 'Outside-the-box', 'Dream-job feasibility',
  'AI-impact ratings', 'Salary ranges', 'Personalized fit', 'Next steps',
];

const LANE_LABELS = [
  ['WF1 · RESUME', 125], ['WF2 · PROFILE', 180], ['WF3 · ENRICH', 235],
  ['WF4 · RANK', 290], ['WF5 · OOB', 345], ['WF6 · CONTENT', 400], ['WF7 · CHAT', 455],
] as const;

const MOBILE_ROWS = [
  ['WF1', 'Resume parse', 'PDF · AI'],
  ['WF2', 'Profile build', 'AI synth'],
  ['WF3', 'Career research', 'Data · AI'],
  ['WF4', 'Match & rank', 'Score · AI'],
  ['WF5', 'Outside-the-box', 'AI critique'],
  ['WF6', 'Content generation', 'AI write'],
  ['WF7', 'Coaching chat', 'AI · Adapt'],
];

/**
 * Stylized "intelligence graph" — an on-brand abstraction of the seven n8n
 * workflows behind every Cairnly report. Pure SVG with native <animateMotion>;
 * a stacked card fallback renders below the `lg` breakpoint.
 */
const WorkflowDiagram: React.FC = () => (
  <>
    {/* Desktop / wide-tablet animated SVG */}
    <div
      className="hidden lg:block lp-screenshot-slot lp-on-dark aspect-[4/3] w-full"
      style={{ background: '#122E3B' }}
    >
      <div className="lp-screenshot-slot__meta">Engine</div>
      <svg
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <pattern id="wfGrid" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.5" fill="rgba(255,255,255,0.05)" />
          </pattern>
          <linearGradient id="goldStreak" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#D4A024" stopOpacity="0" />
            <stop offset="50%" stopColor="#E3B04D" />
            <stop offset="100%" stopColor="#D4A024" stopOpacity="0" />
          </linearGradient>
          <filter id="wfGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>
        <rect width="800" height="600" fill="url(#wfGrid)" />

        {/* Top badge */}
        <g transform="translate(30, 28)">
          <rect width="168" height="22" rx="11" fill="#D4A024" />
          <text x="84" y="15" textAnchor="middle" fontFamily="Poppins" fontSize="10" fontWeight="700" fill="#1A1A1A" letterSpacing="2.5">7 AI WORKFLOWS</text>
        </g>
        <text x="30" y="68" fontFamily="Inter" fontSize="11" fill="rgba(255,255,255,0.55)" fontWeight="500">Months of work · Multiple LLMs · Coach-tuned at every step</text>

        <text x="772" y="42" textAnchor="end" fontFamily="Poppins" fontSize="10" fontWeight="700" fill="#D4A024" letterSpacing="2">→ YOUR REPORT</text>

        {/* Report panel */}
        <rect x="600" y="110" width="170" height="400" rx="16" fill="#FBF6E8" stroke="#D4A024" strokeWidth="1.5" strokeOpacity="0.8" />
        <text x="685" y="140" textAnchor="middle" fontFamily="Poppins" fontSize="11" fontWeight="700" fill="#1F8282" letterSpacing="2">REPORT</text>
        <line x1="618" y1="155" x2="752" y2="155" stroke="rgba(31,130,130,0.2)" />
        <g fontFamily="Inter" fontSize="10.5" fontWeight="600" fill="#122E3B">
          {REPORT_ROWS.map((row, i) => (
            <text key={row} x="618" y={180 + i * 35}>{row}</text>
          ))}
        </g>
        <g>
          {REPORT_ROWS.map((_, i) => (
            <circle key={i} cx="610" cy={177 + i * 35} r="2" fill="#27A1A1" />
          ))}
        </g>
        <rect x="600" y="450" width="170" height="60" rx="12" fill="rgba(39,161,161,0.12)" stroke="rgba(39,161,161,0.3)" />
        <text x="685" y="482" textAnchor="middle" fontFamily="Poppins" fontSize="11" fontWeight="800" fill="#27A1A1">Ready in ~90s</text>
        <text x="685" y="498" textAnchor="middle" fontFamily="Inter" fontSize="9" fill="rgba(18,46,59,0.55)">refined by your coaching chat</text>

        {/* Lane labels */}
        <g fontFamily="Poppins" fontSize="9" fontWeight="700" fill="rgba(255,255,255,0.6)" letterSpacing="1.2" textAnchor="end">
          {LANE_LABELS.map(([label, y]) => (
            <text key={label} x="108" y={y}>{label}</text>
          ))}
        </g>

        {/* Connectors */}
        <g stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" fill="none">
          <path d="M 200 122 L 290 122" />
          <path d="M 380 122 L 600 200" />
          <path d="M 200 177 L 290 177" />
          <path d="M 380 177 L 470 177" />
          <path d="M 560 177 L 600 230" />
          <path d="M 200 232 L 290 232" />
          <path d="M 380 232 L 470 232" />
          <path d="M 560 232 L 600 260" />
          <path d="M 200 287 L 290 287" />
          <path d="M 380 287 L 470 287" />
          <path d="M 560 287 L 600 300" />
          <path d="M 200 342 L 290 342" />
          <path d="M 380 342 L 470 342" />
          <path d="M 560 342 L 600 340" />
          <path d="M 200 397 L 290 397" />
          <path d="M 380 397 L 470 397" />
          <path d="M 560 397 L 600 380" />
          <path d="M 200 452 L 290 452" />
          <path d="M 380 452 L 600 420" />
        </g>

        {/* Nodes */}
        <g fontFamily="Inter" fontSize="10" fontWeight="600">
          <Node x={120} y={110} label="Parse PDF" />
          <Node x={300} y={110} label="AI extract" llm />
          <Node x={120} y={165} label="Read answers" />
          <Node x={300} y={165} label="AI synth" llm />
          <Node x={480} y={165} label="Save profile" />
          <Node x={120} y={220} label="Fetch roles" />
          <Node x={300} y={220} label="Salary data" llm />
          <Node x={480} y={220} label="AI-impact" llm />
          <Node x={120} y={275} label="Match scores" />
          <Node x={300} y={275} label="Re-rank" llm />
          <Node x={480} y={275} label="Top 3" />
          <Node x={120} y={330} label="Generate" llm />
          <Node x={300} y={330} label="AI critique" llm />
          <Node x={480} y={330} label="Filter" />
          <Node x={120} y={385} label="Write top 3" llm />
          <Node x={300} y={385} label="Write rest" llm />
          <Node x={480} y={385} label="Dream-job" llm />
          <Node x={120} y={440} label="Coach prompt" />
          <Node x={300} y={440} label="Adapt report" llm />
        </g>

        {/* Animated pulse dots */}
        <g fill="#E3B04D" filter="url(#wfGlow)">
          <circle r="2.6"><animateMotion dur="4.5s" repeatCount="indefinite" path="M 200 177 L 290 177 L 290 177 L 380 177 L 380 177 L 470 177 L 470 177 L 560 177 L 560 177 L 600 220" /></circle>
          <circle r="2.6"><animateMotion dur="5s" begin="0.6s" repeatCount="indefinite" path="M 200 232 L 290 232 L 380 232 L 470 232 L 560 232 L 600 260" /></circle>
          <circle r="2.6"><animateMotion dur="4.2s" begin="1.2s" repeatCount="indefinite" path="M 200 287 L 290 287 L 380 287 L 470 287 L 560 287 L 600 300" /></circle>
          <circle r="2.6"><animateMotion dur="5.4s" begin="0.3s" repeatCount="indefinite" path="M 200 342 L 290 342 L 380 342 L 470 342 L 560 342 L 600 340" /></circle>
          <circle r="2.6"><animateMotion dur="4.8s" begin="1.6s" repeatCount="indefinite" path="M 200 397 L 290 397 L 380 397 L 470 397 L 560 397 L 600 380" /></circle>
          <circle r="2.6"><animateMotion dur="3.8s" begin="2.1s" repeatCount="indefinite" path="M 200 122 L 290 122 L 380 122 L 600 200" /></circle>
          <circle r="2.6"><animateMotion dur="5.2s" begin="2.8s" repeatCount="indefinite" path="M 200 452 L 290 452 L 380 452 L 600 420" /></circle>
        </g>

        {/* Legend */}
        <g transform="translate(30, 555)" fontFamily="Inter" fontSize="9" fontWeight="600" fill="rgba(255,255,255,0.55)">
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
      <div className="flex items-center justify-between mb-5">
        <div
          className="px-3 py-1 rounded-full text-[10px] font-heading font-extrabold uppercase tracking-[0.22em]"
          style={{ background: '#D4A024', color: '#1A1A1A' }}
        >
          7 AI Workflows
        </div>
        <span className="text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">→ Report</span>
      </div>
      <ul className="space-y-3">
        {MOBILE_ROWS.map(([wf, label, tag]) => (
          <li key={wf} className="flex items-center gap-4">
            <span className="text-[#D4A024] font-heading font-extrabold text-[11px] tracking-[0.22em] w-8 shrink-0">{wf}</span>
            <span className="text-white font-medium text-[14px]">{label}</span>
            <span className="ml-auto text-[10px] text-white/40 uppercase tracking-wider">{tag}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/55">
        <span>All converge into your report</span>
        <span className="text-[#27A1A1]">Ready in ~90s</span>
      </div>
    </div>
  </>
);

export default WorkflowDiagram;
