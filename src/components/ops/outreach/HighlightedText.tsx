// Renders highlight spans. Used on its own (their mail) and as the backdrop
// behind a textarea (our concept), where `ghost` hides the letters so only
// the marks show through and the textarea's own text sits on top.

import React from 'react';
import type { Mark, Span } from '@/lib/outreachHighlight';

const MARK_CLS: Record<Mark, string> = {
  none: '',
  new: 'bg-amber-400/25 rounded-[3px]',
  shared: 'bg-atlas-teal/25 rounded-[3px]',
  question: 'font-bold',
  unanswered: 'bg-red-500/25 rounded-[3px]',
};

export default function HighlightedText({
  spans,
  ghost = false,
  className = '',
}: {
  spans: Span[];
  ghost?: boolean;
  className?: string;
}) {
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`} aria-hidden={ghost || undefined}>
      {spans.map((s, i) =>
        s.mark === 'none' ? (
          <span key={i} className={ghost ? 'text-transparent' : undefined}>
            {s.text}
          </span>
        ) : (
          <mark key={i} className={`${MARK_CLS[s.mark]} ${ghost ? 'text-transparent' : 'text-inherit'} bg-clip-padding`}>
            {s.text}
          </mark>
        ),
      )}
      {/* A trailing newline in a textarea has height; give the backdrop the same. */}
      {ghost && '​'}
    </div>
  );
}
