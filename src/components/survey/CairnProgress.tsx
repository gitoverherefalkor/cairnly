import React from 'react';

/**
 * CairnProgress
 * Survey-progress cairn that stacks the *actual* Cairnly logo stones one at a
 * time. Each layer PNG is a single real stone sliced from the brand mark, so a
 * completed cairn is pixel-identical to the icon, capped by the gold capstone.
 *
 * Assets live in /public/cairn/:
 *   s0.png .. s4.png   five teal stones, bottom -> top
 *   crown.png          gold capstone
 * Each PNG is the full 942x1051 logo canvas with only its own stone painted,
 * so they stack by simply overlaying at the same offset.
 *
 * The survey has 7 sections but only shows this on the 6 between-section
 * "you finished X" cards (counts 1-6) plus the final processing screen. Five
 * stones + the crown = six pieces, one per card: stones drop on cards 1-5, the
 * crown pops on card 6. So `crowned` is decoupled from the stone count — the
 * caller decides when the capstone lands.
 */

const LAYERS = ['s0', 's1', 's2', 's3', 's4'] as const; // bottom -> top
// Source canvas + the cairn's bounding box within it (used to crop the margins).
const SRC = { w: 942, h: 1051, x0: 255, y0: 183, cw: 382, ch: 627 };

export interface CairnProgressProps {
  /** Stones placed, 0–5. */
  filled: number;
  /** Show the gold capstone. Defaults to filled >= 5 (all stones placed). */
  crowned?: boolean;
  /** Which piece drops in on this render: the newest stone, the crown, or
   *  nothing. Cards remount per section (key=count), so the animation plays
   *  once. Default 'stone'. */
  animate?: 'stone' | 'crown' | 'none';
  /** Rendered cairn width in px. Height follows the icon's aspect. Default 130. */
  width?: number;
  /** Folder the layer PNGs live in. Default '/cairn'. */
  assetBase?: string;
  className?: string;
}

export default function CairnProgress({
  filled,
  crowned,
  animate = 'stone',
  width = 130,
  assetBase = '/cairn',
  className,
}: CairnProgressProps) {
  const n = Math.max(0, Math.min(LAYERS.length, Math.round(filled)));
  const showCrown = crowned ?? n >= LAYERS.length;

  const scale = width / SRC.cw;
  const frameH = SRC.ch * scale;
  const plane: React.CSSProperties = {
    position: 'absolute',
    width: SRC.w * scale,
    height: SRC.h * scale,
    left: -SRC.x0 * scale,
    top: -SRC.y0 * scale,
  };
  const img: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  };

  return (
    <div
      className={className}
      style={{ position: 'relative', width, height: frameH, overflow: 'hidden' }}
      role="img"
      aria-label={`Cairn progress: ${n} of ${LAYERS.length} stones placed${showCrown ? ', crowned' : ''}`}
    >
      <div style={plane}>
        {LAYERS.slice(0, n).map((name, i) => (
          <img
            key={name}
            src={`${assetBase}/${name}.png`}
            alt=""
            style={img}
            className={animate === 'stone' && i === n - 1 ? 'cairn-stone-drop' : undefined}
          />
        ))}
        {showCrown && (
          <img
            src={`${assetBase}/crown.png`}
            alt=""
            style={{ ...img, transformOrigin: '45.6% 21.5%' }}
            className={animate === 'crown' ? 'cairn-crown-pop' : undefined}
          />
        )}
      </div>
    </div>
  );
}
