// A textarea with highlights behind it. The backdrop renders the same text
// with the marks and invisible letters; the textarea sits on top with a
// transparent background, so what you type stays a real textarea (undo,
// selection, spellcheck) while the marks follow every keystroke. Both layers
// share font, padding and wrapping, and the textarea grows with its content
// so the two never scroll apart.

import React, { useLayoutEffect, useRef } from 'react';
import HighlightedText from './HighlightedText';
import type { Span } from '@/lib/outreachHighlight';

const LAYER = 'font-sans text-[13px] leading-[1.6] px-3 py-2.5 whitespace-pre-wrap break-words';

export default function ConceptEditor({
  value,
  spans,
  onChange,
  disabled = false,
  label,
}: {
  value: string;
  spans: Span[];
  onChange: (next: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="relative rounded-xl border border-white/[0.12] bg-[#0E2531] focus-within:border-atlas-teal/60">
      <HighlightedText spans={spans} ghost className={`${LAYER} pointer-events-none absolute inset-0 overflow-hidden`} />
      <textarea
        ref={ref}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        spellCheck
        className={`${LAYER} relative block w-full resize-none overflow-hidden bg-transparent text-white/[0.92] caret-white focus:outline-none disabled:opacity-60`}
      />
    </div>
  );
}
