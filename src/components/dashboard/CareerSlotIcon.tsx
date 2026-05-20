// CareerSlotIcon.tsx
// Cairnly · Six cairn-variant glyphs for the dashboard career slots.
//
// Drop this file into src/components/dashboard/CareerSlotIcon.tsx
// Usage:
//   <CareerSlotIcon slot="primary" size={32} />
//   <CareerSlotIcon slot="dream" size={40} className="text-ink" />
//
// All icons are self-contained SVGs (no external sprite needed). They render
// at the size you pass; the viewBox preserves aspect ratio. Colours are hard-
// coded to the brand palette so they stay on-brand regardless of parent text
// colour — pass `className` for spacing/positioning, not colouring.

import React from "react";

export type CareerSlot =
  | "primary"
  | "second"
  | "third"
  | "runnerups"
  | "outside"
  | "dream";

interface Props {
  slot: CareerSlot;
  size?: number; // px, default 32
  className?: string;
  ariaLabel?: string;
}

const LABELS: Record<CareerSlot, string> = {
  primary:   "Primary career match",
  second:    "Second career match",
  third:     "Third career match",
  runnerups: "Runner-up careers",
  outside:   "Outside-the-box career",
  dream:     "Dream job",
};

export const CareerSlotIcon: React.FC<Props> = ({
  slot,
  size = 32,
  className,
  ariaLabel,
}) => {
  const label = ariaLabel ?? LABELS[slot];
  const common = {
    width: size,
    height: size,
    role: "img" as const,
    "aria-label": label,
    className,
  };

  switch (slot) {
    case "primary":
      return (
        <svg {...common} viewBox="0 0 40 40">
          <g stroke="#122E3B" strokeWidth="1.8" strokeLinejoin="round" fill="none">
            <ellipse cx="20" cy="34" rx="13" ry="3" />
            <ellipse cx="20" cy="27.5" rx="11" ry="2.5" />
            <ellipse cx="20" cy="21.5" rx="9" ry="2.2" />
            <ellipse cx="20" cy="16" rx="6.5" ry="1.9" />
          </g>
          <path d="M 14 11 L 26 11 L 23 4 L 17 4 Z" fill="#D4A024" stroke="#D4A024" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );

    case "second":
      return (
        <svg {...common} viewBox="0 0 40 40">
          <g stroke="#122E3B" strokeWidth="1.6" strokeLinejoin="round" fill="none">
            <ellipse cx="20" cy="34" rx="11" ry="2.6" />
            <ellipse cx="20" cy="28.5" rx="9" ry="2.2" />
            <ellipse cx="20" cy="23.5" rx="7" ry="1.9" />
          </g>
          <path d="M 15 18 L 25 18 L 22.5 12.5 L 17.5 12.5 Z" fill="#E3B04D" stroke="#C8891A" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );

    case "third":
      return (
        <svg {...common} viewBox="0 0 40 40">
          <g stroke="#122E3B" strokeWidth="1.6" strokeLinejoin="round" fill="none">
            <ellipse cx="20" cy="33" rx="9.5" ry="2.4" />
            <ellipse cx="20" cy="28" rx="7.5" ry="2" />
          </g>
          <path d="M 16 23 L 24 23 L 22 18 L 18 18 Z" fill="none" stroke="#D4A024" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );

    case "runnerups":
      return (
        <svg {...common} viewBox="0 0 48 40">
          <g stroke="#122E3B" strokeWidth="1.4" strokeLinejoin="round" fill="none">
            <ellipse cx="9" cy="33" rx="5.5" ry="1.6" />
            <ellipse cx="9" cy="29" rx="4.2" ry="1.3" />
            <ellipse cx="9" cy="25.5" rx="3" ry="1.1" />
          </g>
          <g stroke="#122E3B" strokeWidth="1.4" strokeLinejoin="round" fill="none">
            <ellipse cx="24" cy="33" rx="6.5" ry="1.7" />
            <ellipse cx="24" cy="28.5" rx="5" ry="1.4" />
            <ellipse cx="24" cy="24" rx="3.6" ry="1.2" />
            <ellipse cx="24" cy="19.5" rx="2.4" ry="0.9" />
          </g>
          <path d="M 21 16 L 27 16 L 25.5 12 L 22.5 12 Z" fill="#D4A024" stroke="#D4A024" strokeWidth="1" strokeLinejoin="round" />
          <g stroke="#122E3B" strokeWidth="1.4" strokeLinejoin="round" fill="none">
            <ellipse cx="39" cy="33" rx="5.5" ry="1.6" />
            <ellipse cx="39" cy="29" rx="4.2" ry="1.3" />
            <ellipse cx="39" cy="25.5" rx="3" ry="1.1" />
          </g>
        </svg>
      );

    case "outside":
      return (
        <svg {...common} viewBox="0 0 44 40">
          <g stroke="#122E3B" strokeWidth="1.6" strokeLinejoin="round" fill="none">
            <ellipse cx="14" cy="33" rx="9" ry="2.3" />
            <ellipse cx="14" cy="28" rx="7" ry="1.9" />
            <ellipse cx="14" cy="23" rx="5" ry="1.6" />
          </g>
          <path d="M 10 18 L 18 18 L 16 13.5 L 12 13.5 Z" fill="#D4A024" stroke="#D4A024" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M 24 22 L 38 8" stroke="#27A1A1" strokeWidth="1.7" strokeLinecap="round" fill="none" />
          <path d="M 34 8 L 38 8 L 38 12" stroke="#27A1A1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 32 18 L 32 22 M 30 20 L 34 20" stroke="#D4A024" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case "dream":
      return (
        <svg {...common} viewBox="0 0 44 40">
          <line x1="3" y1="30" x2="41" y2="30" stroke="#C9B690" strokeWidth="1.2" strokeDasharray="2 3" />
          <g stroke="#122E3B" strokeWidth="1.2" strokeLinejoin="round" fill="none" opacity="0.5">
            <ellipse cx="8" cy="32" rx="3.5" ry="1.1" />
            <ellipse cx="8" cy="29.5" rx="2.6" ry="0.9" />
          </g>
          <g stroke="#122E3B" strokeWidth="1.4" strokeLinejoin="round" fill="none" opacity="0.75">
            <ellipse cx="22" cy="31" rx="5" ry="1.4" />
            <ellipse cx="22" cy="27.5" rx="3.8" ry="1.1" />
            <ellipse cx="22" cy="24.5" rx="2.6" ry="0.9" />
          </g>
          <g stroke="#122E3B" strokeWidth="1.4" strokeLinejoin="round" fill="none">
            <ellipse cx="36" cy="30" rx="3.8" ry="1.1" />
            <ellipse cx="36" cy="27.5" rx="2.8" ry="0.9" />
            <ellipse cx="36" cy="25" rx="2" ry="0.8" />
          </g>
          <path d="M 34 22.5 L 38 22.5 L 37 19.5 L 35 19.5 Z" fill="#D4A024" stroke="#D4A024" strokeWidth="1" strokeLinejoin="round" />
          <path d="M 36 13 L 37.1 15.4 L 39.6 15.7 L 37.7 17.4 L 38.2 19.9 L 36 18.6 L 33.8 19.9 L 34.3 17.4 L 32.4 15.7 L 34.9 15.4 Z" fill="#D4A024" stroke="#D4A024" strokeWidth="0.7" strokeLinejoin="round" />
        </svg>
      );
  }
};

export default CareerSlotIcon;
