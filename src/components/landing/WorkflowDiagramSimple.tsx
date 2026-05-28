import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Minimal AI workflow visual for the step-2 slot on the landing page.
 * 6 nodes, parallel fork → converge layout, gentle teal data flows.
 * Loosely n8n-inspired but stripped of all chrome. The full breakdown lives
 * in `WorkflowDiagramV2` inside the Methodology section.
 */

type WfNode = { id: string; labelKey: string; x: number; y: number; output?: boolean };

const NODE_W = 130;
const NODE_H = 40;

// viewBox is 600 × 450 (4:3) so nodes render at intended size in the small slot.
// Labels come from landing.workflowSimple.* — see public/locales/{en,nl}/landing.json.
const NODES: WfNode[] = [
  { id: 'resume',  labelKey: 'workflowSimple.resume',  x: 20,  y: 90  },
  { id: 'survey',  labelKey: 'workflowSimple.survey',  x: 20,  y: 320 },
  { id: 'profile', labelKey: 'workflowSimple.profile', x: 165, y: 205 },
  { id: 'match',   labelKey: 'workflowSimple.match',   x: 310, y: 90  },
  { id: 'wild',    labelKey: 'workflowSimple.wild',    x: 310, y: 320 },
  { id: 'report',  labelKey: 'workflowSimple.report',  x: 455, y: 205, output: true },
];

const EDGES: Array<{ from: string; to: string }> = [
  { from: 'resume',  to: 'profile' },
  { from: 'survey',  to: 'profile' },
  { from: 'profile', to: 'match' },
  { from: 'profile', to: 'wild' },
  { from: 'match',   to: 'report' },
  { from: 'wild',    to: 'report' },
];

const NODE_MAP = Object.fromEntries(NODES.map((n) => [n.id, n]));

const edgePath = (from: WfNode, to: WfNode): string => {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const dx = Math.max((x2 - x1) * 0.55, 35);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
};

const WfNodeCard: React.FC<{ node: WfNode }> = ({ node }) => {
  const { t } = useTranslation('landing');
  return (
  <g transform={`translate(${node.x}, ${node.y})`}>
    <rect
      width={NODE_W}
      height={NODE_H}
      rx="7"
      fill={node.output ? '#FBF6E8' : '#ECE4D2'}
      stroke={node.output ? '#D4A024' : 'transparent'}
      strokeWidth={node.output ? 1.5 : 0}
    />
    {/* Left stripe accent */}
    <rect width="5" height={NODE_H} rx="7" fill={node.output ? '#D4A024' : '#27A1A1'} />
    {/* Label */}
    <text
      x={NODE_W / 2 + 2}
      y={NODE_H / 2 + 4}
      textAnchor="middle"
      fontFamily={node.output ? 'Poppins' : 'Inter'}
      fontSize={node.output ? 11 : 12}
      fontWeight={node.output ? 900 : 600}
      fill="#122E3B"
      letterSpacing={node.output ? 2 : 0}
    >
      {t(node.labelKey)}
    </text>
    {/* I/O ports */}
    {node.id !== 'resume' && node.id !== 'survey' && (
      <circle cx="0" cy={NODE_H / 2} r="3.5" fill="#27A1A1" stroke="#0F1F28" strokeWidth="1.5" />
    )}
    {!node.output && (
      <circle cx={NODE_W} cy={NODE_H / 2} r="3.5" fill="#27A1A1" stroke="#0F1F28" strokeWidth="1.5" />
    )}
  </g>
  );
};

const STEP_DELAY = 0.4;
const PULSE_DUR = 1.3;
const CYCLE_DUR = EDGES.length * STEP_DELAY + 1.4;
const fmt = (n: number) => n.toFixed(4);

const WorkflowDiagramSimple: React.FC = () => (
  <div
    className="lp-screenshot-slot lp-on-dark aspect-[4/3] w-full"
    style={{ background: '#0F1F28' }}
  >
    <svg
      viewBox="0 0 600 450"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 w-full h-full"
    >
      <defs>
        <pattern id="wfSimpleGrid" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.07)" />
        </pattern>
        <filter id="wfSimpleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      <rect width="600" height="450" fill="url(#wfSimpleGrid)" />

      {/* Edges (static curves) */}
      <g fill="none" stroke="#27A1A1" strokeWidth="1.8" strokeOpacity="0.45">
        {EDGES.map((edge, i) => (
          <path key={i} d={edgePath(NODE_MAP[edge.from], NODE_MAP[edge.to])} />
        ))}
      </g>

      {/* Animated teal pulses travelling each edge in sequence */}
      <g fill="#27A1A1" filter="url(#wfSimpleGlow)">
        {EDGES.map((edge, i) => {
          const path = edgePath(NODE_MAP[edge.from], NODE_MAP[edge.to]);
          const start = (i * STEP_DELAY) / CYCLE_DUR;
          const end = (i * STEP_DELAY + PULSE_DUR) / CYCLE_DUR;
          const fadeWindow = 0.02;
          const fadeIn = Math.max(start - fadeWindow, 0);
          const fadeOut = Math.min(end + fadeWindow, 1);
          const startSafe = Math.max(start, 0.0001);
          const endSafe = Math.min(end, 0.9999);
          return (
            <circle key={i} r="3.4" opacity="0">
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

      {/* Nodes */}
      {NODES.map((node) => (
        <WfNodeCard key={node.id} node={node} />
      ))}
    </svg>
  </div>
);

export default WorkflowDiagramSimple;
