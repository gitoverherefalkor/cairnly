import React from 'react';
import type { DemoAnnotationPlacement } from '@/demo/types';

export interface ResolvedAnnotation {
  key: string;
  messageId: string;
  placement: DemoAnnotationPlacement;
  eyebrow: string;
  title: string;
  body: string;
}

/**
 * One margin note of the demo replay. On wide screens it hangs in the margin
 * to the right of the transcript, aligned with the top or bottom of the
 * message it points at, with a short gold connector; on anything narrower it
 * drops inline, directly above (top) or below (bottom) that message.
 *
 * Pure demo layer: the chat components never see these.
 */
export const DemoAnnotation: React.FC<{ annotation: ResolvedAnnotation }> = ({ annotation }) => {
  const { placement, eyebrow, title, body } = annotation;
  const wide =
    placement === 'top'
      ? 'min-[1360px]:top-1'
      : 'min-[1360px]:bottom-8';
  const inline = placement === 'top' ? 'mb-3' : '-mt-1 mb-6';
  return (
    <aside
      className={`relative ${inline} min-[1360px]:absolute min-[1360px]:left-full min-[1360px]:ml-10 min-[1360px]:w-[264px] min-[1360px]:m-0 ${wide}`}
      aria-label={title}
    >
      {/* Connector to the message, wide screens only. */}
      <span
        aria-hidden="true"
        className="hidden min-[1360px]:block absolute top-6 -left-10 h-px w-10"
        style={{ background: 'rgba(212,160,36,0.7)' }}
      />
      <div
        className="rounded-xl px-4 py-3.5"
        style={{
          background: '#FBF6E8',
          border: '1px solid rgba(212,160,36,0.55)',
          borderLeft: '3px solid #D4A024',
          boxShadow: '0 18px 36px -24px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1.5"
          style={{ color: '#B8860B' }}
        >
          {eyebrow}
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
