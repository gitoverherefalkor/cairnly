import React, { useLayoutEffect, useRef, useState } from 'react';
import type { DemoAnnotationPlacement } from '@/demo/types';

export interface ResolvedAnnotation {
  key: string;
  messageId: string;
  placement: DemoAnnotationPlacement;
  // 1-based position in transcript order. Shown as the badge on the note and
  // as the number in the legend rail, so the two can be matched at a glance.
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  // Short label for the legend rail / the intro list on small screens.
  legend: string;
}

// Bot bubbles are rounded-[20px], user bubbles rounded-2xl. The bubble is the
// outermost element with either class inside the message root, so the first
// match in document order is the one we want.
const BUBBLE_SELECTOR = '[class*="rounded-[20px]"], [class*="rounded-2xl"]';

/**
 * One margin note of the demo replay. On wide screens it hangs in the margin
 * to the right of the transcript, aligned with the top or bottom of the
 * message it points at, with a gold connector that runs all the way to the
 * bubble's edge; on anything narrower it drops inline, directly above (top)
 * or below (bottom) that message.
 *
 * Pure demo layer: the chat components never see these.
 */
export const DemoAnnotation: React.FC<{ annotation: ResolvedAnnotation }> = ({ annotation }) => {
  const { placement, index, eyebrow, title, body } = annotation;
  const ref = useRef<HTMLElement>(null);
  const [lineWidth, setLineWidth] = useState(0);

  // Measure the gap between the message bubble and this note so the
  // connector actually touches the bubble: bot bubbles stop at 85% of the
  // column, user bubbles hug the right edge, and either can be narrower for
  // a short message. Only the margin layout has a connector.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (getComputedStyle(el).position !== 'absolute') {
        setLineWidth(0);
        return;
      }
      const wrapper = el.parentElement;
      const root = wrapper
        ? Array.from(wrapper.children).find((c) => c.tagName !== 'ASIDE')
        : null;
      const bubble = root?.querySelector<HTMLElement>(BUBBLE_SELECTOR);
      if (!bubble) {
        setLineWidth(0);
        return;
      }
      const gap = el.getBoundingClientRect().left - bubble.getBoundingClientRect().right;
      setLineWidth(gap > 0 ? Math.round(gap) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const wide = placement === 'top' ? 'min-[1360px]:top-1' : 'min-[1360px]:bottom-8';
  const inline = placement === 'top' ? 'mb-3' : '-mt-1 mb-6';
  return (
    <aside
      ref={ref}
      data-demo-annotation=""
      className={`relative ${inline} min-[1360px]:absolute min-[1360px]:left-full min-[1360px]:ml-8 min-[1360px]:w-[248px] min-[1360px]:m-0 ${wide}`}
      aria-label={title}
    >
      {lineWidth > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-6 h-px"
          style={{ left: -lineWidth, width: lineWidth, background: 'rgba(212,160,36,0.75)' }}
        />
      )}
      <div
        className="rounded-xl px-4 py-3.5"
        style={{
          background: '#FBF6E8',
          border: '1px solid rgba(212,160,36,0.55)',
          borderLeft: '3px solid #D4A024',
          boxShadow: '0 18px 36px -24px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{ background: '#D4A024', color: '#1A1A1A' }}
          >
            {index}
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: '#B8860B' }}
          >
            {eyebrow}
          </span>
        </div>
        <div
          className="font-heading font-bold text-[15px] leading-snug mb-1.5"
          style={{ color: '#122E3B' }}
        >
          {title}
        </div>
        <p className="text-[13px] leading-[1.6] font-medium" style={{ color: '#4B6373' }}>
          {body}
        </p>
      </div>
    </aside>
  );
};
