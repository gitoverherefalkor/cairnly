import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CairnProgress from '@/components/survey/CairnProgress';

/**
 * The homepage's scroll-built cairn: a stone drops each time a section passes,
 * the gold capstone lands on the last one. Brought back on 2026-09-28 from the
 * retired How it works section (src/unused/landing/HowItWorks.tsx), where it
 * was a sticky column counting five steps. Same component, same assets
 * (/public/cairn), same trigger line; what changed is the scope. It now counts
 * the live sections and floats in the page's left margin, because the
 * sections run full width and have no column to hold it.
 *
 * Only on screens 1440px and up (see .lp-cairn-float): below that the margin
 * beside the 1280px container is too narrow to hold a cairn without touching
 * the content. Decorative, so hidden from screen readers; each section's own
 * heading already says where you are.
 */

/** Six pieces for six sections: five stones, then the capstone. Labels reuse
 *  each section's eyebrow so the rail needs no copy of its own. */
const STEPS = [
  { id: 'why-cairnly', labelKey: 'pillars.eyebrow' },
  { id: 'is-it-for-you', labelKey: 'whoFor.eyebrow' },
  { id: 'methodology', labelKey: 'methodology.eyebrow' },
  { id: 'comparison', labelKey: 'comparison.eyebrow' },
  { id: 'pricing', labelKey: 'pricing.eyebrow' },
  { id: 'about', labelKey: 'whyBuilt.eyebrow' },
] as const;

const STONES = 5;

/** Luminance of a computed rgb()/rgba() colour, 0-1. Transparent counts as light. */
function isDarkBackground(color: string): boolean {
  const m = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
  if (!m) return false;
  if (m[4] !== undefined && Number(m[4]) < 0.5) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Number(v) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
}

const CairnRail: React.FC = () => {
  const { t } = useTranslation('landing');
  const [placed, setPlaced] = useState(0);
  const [dark, setDark] = useState(false);
  const [overPage, setOverPage] = useState(false);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      // Same trigger as the old step rail: a section counts once its top has
      // scrolled past a line ~42% down the viewport.
      const line = window.innerHeight * 0.42;
      let count = 0;
      STEPS.forEach(({ id }, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) count = i + 1;
      });
      setPlaced(count);

      // Tone follows whichever section sits behind the rail's centre. Nothing
      // there (the footer) hides the rail.
      const mid = window.innerHeight / 2;
      const under = Array.from(document.querySelectorAll<HTMLElement>('main > section')).find((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= mid && r.bottom >= mid;
      });
      setOverPage(!!under);
      if (under) setDark(isDarkBackground(getComputedStyle(under).backgroundColor));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const crowned = placed > STONES;
  const label = placed > 0 ? t(STEPS[placed - 1].labelKey) : '';

  return (
    <aside
      aria-hidden="true"
      className="lp-cairn-float"
      style={{ opacity: placed > 0 && overPage ? 1 : 0 }}
    >
      <div className="lp-cairn-rail__label mb-4" style={{ color: dark ? '#E6C36A' : '#1F8282' }}>
        {label}
      </div>
      {/* Remount per count (key) so the newest stone, or the capstone, drops
          in once, exactly as the old step rail did. */}
      <CairnProgress
        key={placed}
        filled={Math.min(placed, STONES)}
        crowned={crowned}
        animate={crowned ? 'crown' : 'stone'}
        tone={dark ? 'light' : 'default'}
        width={80}
        className="mx-auto"
      />
    </aside>
  );
};

export default CairnRail;
