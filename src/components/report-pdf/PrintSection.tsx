import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReportSection } from '@/hooks/useReportSections';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  AIImpactPill,
  MatchPill,
  MovePill,
  stripHtml,
  type AIImpactLevel,
  type MoveLevel,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { extractAIImpact } from '@/components/chat/CareerScoreCard';

/** The AI sometimes emits HTML instead of Markdown. Normalise to Markdown so
 *  the document renders through a single pipeline. Mirrors htmlToMarkdown in
 *  DashboardV4 — kept separate so print formatting can diverge if needed. */
export function htmlToMarkdown(text: string): string {
  let r = text;
  r = r.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n');
  r = r.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n\n#### $1\n\n');
  r = r.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n\n##### $1\n\n');
  r = r.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  r = r.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  r = r.replace(/<br\s*\/?>/gi, '\n');
  r = r.replace(/<p[^>]*>/gi, '\n\n').replace(/<\/p>/gi, '\n\n');
  r = r.replace(/<ul[^>]*>/gi, '\n\n').replace(/<\/ul>/gi, '\n\n');
  r = r.replace(/<ol[^>]*>/gi, '\n\n').replace(/<\/ol>/gi, '\n\n');
  r = r.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  r = r.replace(/\n{3,}/g, '\n\n');
  return r;
}

const CAREER_TYPES = ['top_career_1', 'top_career_2', 'top_career_3', 'outside_box'];

export const PrintSection: React.FC<{ section: ReportSection }> = ({ section }) => {
  const isCareer = CAREER_TYPES.includes(section.section_type);
  const score = section.score != null ? Number(section.score) : NaN;
  const impact = isCareer ? extractAIImpact(section.content || '') : null;
  const move = section.metadata?.move as MoveLevel | undefined;

  return (
    <section style={{ marginBottom: '10mm' }}>
      <h2
        className="print-nobreak"
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 20,
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          color: PALETTE.canvasDeep,
          margin: '0 0 6px 0',
        }}
      >
        {stripHtml(section.title || '')}
      </h2>

      {isCareer && (
        <div
          className="print-nobreak"
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 10px 0' }}
        >
          {Number.isFinite(score) && <MatchPill pct={score} />}
          {impact && <AIImpactPill label={impact as AIImpactLevel} />}
          {move && <MovePill level={move} />}
        </div>
      )}

      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 10.5,
          lineHeight: 1.6,
          color: PALETTE.ink,
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {htmlToMarkdown(section.content || '')}
        </ReactMarkdown>
      </div>
    </section>
  );
};
