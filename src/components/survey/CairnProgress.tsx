import React from 'react';

// A cairn that builds one stone per completed survey section. Gold stones to
// match the section-complete checkmarks. The newest stone drops in to mark the
// moment.

// Two angular, faceted rock shapes — rugged straight-edged slabs, centred at
// the origin (~150 wide x 38 tall). Alternating them keeps the stack natural.
const ROCKS = [
  'M -75,2 L -62,-12 L -34,-17 L 6,-14 L 40,-18 L 66,-10 L 75,2 L 64,14 L 30,19 L -10,16 L -46,18 L -68,10 Z',
  'M -74,-2 L -56,-15 L -20,-16 L 22,-18 L 52,-13 L 73,0 L 67,13 L 38,17 L 2,19 L -34,15 L -60,16 L -73,6 Z',
];

// Per-stone placement, bottom (index 0) to top (index 6):
// [scale, centreY, xOffset, rotationDeg, flipX]
const STONES: ReadonlyArray<[number, number, number, number, number]> = [
  [1.0, 298, 0, -3, 1],
  [0.92, 266, -8, 4, -1],
  [0.85, 235, 7, -4, 1],
  [0.75, 206, -5, 3, -1],
  [0.65, 178, 8, -5, 1],
  [0.54, 152, -4, 4, -1],
  [0.44, 128, 3, -3, 1],
];

const CX = 120;
const GOLD = '#D4A024';
const GOLD_ALT = '#C39019';

interface CairnProgressProps {
  /** How many stones to show (0-7). */
  stones: number;
  /** When true, the topmost shown stone drops in and the crown pops. */
  animateNewest?: boolean;
  className?: string;
}

const CairnProgress = ({ stones, animateNewest = true, className }: CairnProgressProps) => {
  const count = Math.max(0, Math.min(STONES.length, Math.round(stones)));

  // Fixed viewBox = the full 7-stone cairn's bounding box. Partial cairns sit
  // at the bottom and grow upward into the same frame, so every section
  // transition card reserves identical cairn height.
  return (
    <svg
      viewBox="0 60 240 264"
      className={className}
      role="img"
      aria-label={`Cairn progress: ${count} of ${STONES.length} stones placed`}
    >
      {STONES.slice(0, count).map(([s, cy, dx, rot, flip], i) => {
        const isNewest = animateNewest && i === count - 1;
        return (
          <g
            key={i}
            transform={`translate(${CX + dx},${cy}) rotate(${rot}) scale(${s * flip},${s})`}
          >
            <g className={isNewest ? 'cairn-stone-drop' : undefined}>
              <path d={ROCKS[i % 2]} fill={i % 2 === 0 ? GOLD : GOLD_ALT} />
            </g>
          </g>
        );
      })}
    </svg>
  );
};

export default CairnProgress;
