// CareerSlotIcon — Cairnly's "wayfinder" career-slot glyphs.
// Six variants used by the dashboard report accordion's Career Suggestion
// rows. SVGs are inline and self-contained; colors are pinned to the brand
// palette (#122E3B ink, #D4A024 gold, #F0C040 highlight). Size scales freely
// via the `size` prop; viewBox preserves aspect ratio.

import React from 'react';

export type CareerSlot =
  | 'primary'
  | 'second'
  | 'third'
  | 'runnerups'
  | 'outside'
  | 'dream';

interface Props {
  slot: CareerSlot;
  size?: number;
  className?: string;
  ariaLabel?: string;
}

const LABELS: Record<CareerSlot, string> = {
  primary: 'Primary career match',
  second: 'Second career match',
  third: 'Third career match',
  runnerups: 'Runner-up careers',
  outside: 'Outside-the-box career',
  dream: 'Dream job',
};

const INK = '#122E3B';
const GOLD = '#D4A024';
const GOLD_HIGHLIGHT = '#F0C040';

export const CareerSlotIcon: React.FC<Props> = ({ slot, size = 32, className, ariaLabel }) => {
  const label = ariaLabel ?? LABELS[slot];
  const common = {
    width: size,
    height: size,
    role: 'img' as const,
    'aria-label': label,
    className,
    viewBox: '0 0 40 40',
  };

  switch (slot) {
    // Bullseye, solid gold center.
    case 'primary':
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" fill="none" stroke={INK} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="11" fill="none" stroke={INK} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="5.5" fill={GOLD} />
        </svg>
      );

    // Same target, gold center ring (open).
    case 'second':
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" fill="none" stroke={INK} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="11" fill="none" stroke={INK} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="5.5" fill="none" stroke={GOLD} strokeWidth="2" />
        </svg>
      );

    // Middle ring goes gold; center stays open ink.
    case 'third':
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" fill="none" stroke={INK} strokeWidth="1.5" />
          <circle cx="20" cy="20" r="11" fill="none" stroke={GOLD} strokeWidth="2" />
          <circle cx="20" cy="20" r="5.5" fill="none" stroke={INK} strokeWidth="1.5" />
        </svg>
      );

    // Four gold dots in a diamond, dashed ink ring around them.
    case 'runnerups':
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="17" fill="none" stroke={INK} strokeWidth="1.4" strokeDasharray="2 2.5" />
          <circle cx="20" cy="10" r="3.4" fill={GOLD} />
          <circle cx="30" cy="20" r="3.4" fill={GOLD} />
          <circle cx="20" cy="30" r="3.4" fill={GOLD} />
          <circle cx="10" cy="20" r="3.4" fill={GOLD} />
        </svg>
      );

    // Rotated square, ink center dot, gold "out-of-frame" dot with dashed connector.
    case 'outside':
      return (
        <svg {...common}>
          <rect
            x="9"
            y="9"
            width="22"
            height="22"
            rx="2"
            fill="none"
            stroke={INK}
            strokeWidth="1.5"
            transform="rotate(45 20 20)"
          />
          <circle cx="20" cy="20" r="2.4" fill="none" stroke={INK} strokeWidth="1.3" />
          <circle cx="33" cy="9" r="3.2" fill={GOLD} />
          <line
            x1="22.5"
            y1="17.5"
            x2="30"
            y2="11"
            stroke={GOLD}
            strokeWidth="1.4"
            strokeDasharray="1.5 2.5"
            strokeLinecap="round"
          />
        </svg>
      );

    // You-are-here ink dot at lower-left; dashed aspirational arc up to the
    // gold "dream" circle with a soft halo + highlight.
    case 'dream':
      return (
        <svg {...common}>
          <circle cx="29" cy="11" r="9" fill={GOLD} opacity="0.14" />
          <line x1="6" y1="32" x2="16" y2="32" stroke={INK} strokeWidth="1.2" />
          <circle cx="11" cy="32" r="2.2" fill={INK} />
          <path
            d="M 12.5 30.5 Q 19 21, 24 14"
            fill="none"
            stroke={INK}
            strokeWidth="1.4"
            strokeDasharray="1.8 3"
            strokeLinecap="round"
          />
          <circle cx="29" cy="11" r="5" fill={GOLD} />
          <circle cx="27.5" cy="9.5" r="1.4" fill={GOLD_HIGHLIGHT} opacity="0.85" />
        </svg>
      );
  }
};

export default CareerSlotIcon;
