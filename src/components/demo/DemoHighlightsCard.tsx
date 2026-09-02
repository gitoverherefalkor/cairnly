import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles } from 'lucide-react';
import type { ReportSection } from '@/hooks/useReportSections';
import { sectionText } from '@/lib/sectionText';

interface DemoHighlightsCardProps {
  section: ReportSection | undefined;
  lang: string;
  kicker: string;
  title: string;
  body: string;
}

const markdownComponents = {
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="space-y-2 list-none pl-0" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li
      className="relative pl-5 text-[0.9375rem] leading-relaxed text-gray-700 before:content-['•'] before:absolute before:left-0 before:text-atlas-teal before:font-bold"
      {...props}
    >
      {children}
    </li>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-atlas-navy" {...props}>
      {children}
    </strong>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-[0.9375rem] leading-relaxed text-gray-700 mb-2 last:mb-0" {...props}>
      {children}
    </p>
  ),
  h1: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <p className="font-semibold text-atlas-navy mb-2">{children}</p>
  ),
  h2: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <p className="font-semibold text-atlas-navy mb-2">{children}</p>
  ),
  h3: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <p className="font-semibold text-atlas-navy mb-2">{children}</p>
  ),
};

/**
 * Closing beat of the replay: the "Gespreksinzichten" the wrap-up wrote into
 * the report, rendered statically from the fixture. The live WrapUpCard
 * calls the extraction function on mount, so it cannot be reused here; this
 * is the demo-layer stand-in with the same visual language.
 */
export const DemoHighlightsCard: React.FC<DemoHighlightsCardProps> = ({
  section,
  lang,
  kicker,
  title,
  body,
}) => {
  if (!section) return null;
  const text = sectionText(section, lang);
  if (!text) return null;
  return (
    <div className="flex justify-start mb-4">
      <div
        className="relative overflow-hidden w-full max-w-[85%] rounded-[20px] border px-5 py-5 text-[15px] leading-[1.6]"
        style={{
          background: '#FDFBF2',
          borderColor: 'rgba(201, 182, 144, 0.6)',
          boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
          color: '#1F2937',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            top: -60,
            right: -60,
            width: 240,
            height: 240,
            background:
              'radial-gradient(circle, rgba(212,160,36,0.16) 0%, rgba(212,160,36,0) 70%)',
          }}
        />
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-atlas-teal mb-2">
          <Sparkles size={14} strokeWidth={2.4} />
          {kicker}
        </div>
        <h3
          className="font-heading text-[22px] sm:text-[24px] mb-2"
          style={{ color: '#122E3B', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.2 }}
        >
          {title}
        </h3>
        <p className="text-[0.9375rem] text-gray-600 leading-relaxed mb-4">{body}</p>
        <div className="rounded-xl border border-atlas-teal/20 bg-white/70 px-4 py-3.5">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};
