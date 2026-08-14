import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReportSection } from '@/hooks/useReportSections';
import {
  PALETTE,
  FONT_DISPLAY,
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

// ─── Marker glyphs ──────────────────────────────────────────────────────────
// The AI prefixes its risk and fit bullets with ⚠ (U+26A0) and ✓ (U+2713).
// Both render as TOFU BOXES in the PDF: headless Chromium on Lambda ships
// almost no system fonts, and neither Poppins nor Inter carries these
// codepoints, so there is no fallback face to borrow them from. The deployed
// report had 27 of these boxes in it.
//
// Fixing it by loading a symbol webfont would add a network dependency to
// every render for four glyphs. Drawing them as inline SVG instead cannot fail,
// costs nothing, and lets the marks carry brand colour.
const MARKER_RE = /^\s*([⚠✓])[\s ]*/;

type Marker = '⚠' | '✓';

const WarnIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" className="print-callout-icon" aria-hidden="true">
    <path
      d="M8 1.6 15 14H1L8 1.6Z"
      fill="none"
      stroke={PALETTE.gold}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M8 6v3.4" stroke={PALETTE.gold} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8" cy="11.7" r="0.9" fill={PALETTE.gold} />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" className="print-callout-icon" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="none" stroke={PALETTE.teal} strokeWidth="1.4" />
    <path
      d="M4.6 8.3 6.9 10.6 11.4 5.6"
      fill="none"
      stroke={PALETTE.teal}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Pull a leading ⚠/✓ off a paragraph's children, returning the marker and the
 *  remaining nodes. Operates on the parsed children rather than the raw string
 *  so the bold lead-in that usually follows the marker survives intact. */
function splitMarker(children: React.ReactNode): { marker: Marker | null; rest: React.ReactNode } {
  const arr = React.Children.toArray(children);
  const first = arr[0];
  if (typeof first !== 'string') return { marker: null, rest: children };
  const m = first.match(MARKER_RE);
  if (!m) return { marker: null, rest: children };
  return { marker: m[1] as Marker, rest: [first.slice(m[0].length), ...arr.slice(1)] };
}

/** Paragraph renderer that promotes ⚠/✓-prefixed paragraphs into callouts. */
const PrintParagraph: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { marker, rest } = splitMarker(children);
  if (!marker) return <p>{children}</p>;
  const good = marker === '✓';
  return (
    <div className={`print-callout ${good ? 'print-callout--good' : 'print-callout--warn'}`}>
      {good ? <CheckIcon /> : <WarnIcon />}
      <div className="print-callout-body">{rest}</div>
    </div>
  );
};

/** List items get the same treatment — the model is inconsistent about whether
 *  a marked line is a bullet or a paragraph. */
const PrintListItem: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { marker, rest } = splitMarker(children);
  if (!marker) return <li>{children}</li>;
  const good = marker === '✓';
  return (
    <li className="print-li--marked">
      <div className={`print-callout ${good ? 'print-callout--good' : 'print-callout--warn'}`}>
        {good ? <CheckIcon /> : <WarnIcon />}
        <div className="print-callout-body">{rest}</div>
      </div>
    </li>
  );
};

const MD_COMPONENTS = { p: PrintParagraph, li: PrintListItem } as const;

// ─── Section framing ────────────────────────────────────────────────────────
// The eyebrow above each title carries information the title itself cannot:
// a role name alone does not tell the reader whether they are looking at the
// #1 match or a runner-up. Ranked labels come from the section type, which is
// the only place that ordering actually lives.
const EYEBROW: Record<string, string> = {
  exec_summary: 'Overview',
  approach: 'About you',
  personality_team: 'About you',
  strengths: 'About you',
  development: 'About you',
  values: 'About you',
  top_career_1: 'Top match · 01',
  top_career_2: 'Top match · 02',
  top_career_3: 'Top match · 03',
  runner_ups: 'Also worth a look',
  outside_box: 'Outside the box',
  dream_jobs: 'Your dream jobs',
};

export const PrintSection: React.FC<{ section: ReportSection; first?: boolean }> = ({
  section,
  first = false,
}) => {
  const isCareer = CAREER_TYPES.includes(section.section_type);
  const score = section.score != null ? Number(section.score) : NaN;
  const impact = isCareer ? extractAIImpact(section.content || '') : null;
  const move = section.metadata?.move as MoveLevel | undefined;
  const eyebrow = EYEBROW[section.section_type];

  return (
    <section
      style={{
        marginBottom: '9mm',
        // A hairline above each section is the cheapest possible signal that
        // one topic ended and another began, and it survives page breaks
        // (unlike a bottom border, which can land alone at the top of a page).
        borderTop: first ? 'none' : `1px solid ${PALETTE.cream}`,
        paddingTop: first ? 0 : '7mm',
      }}
    >
      <div className="print-nobreak">
        {eyebrow && (
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 7.5,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: PALETTE.gold,
              margin: '0 0 4px 0',
            }}
          >
            {eyebrow}
          </div>
        )}

        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 19,
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            color: PALETTE.canvasDeep,
            margin: '0 0 7px 0',
          }}
        >
          {stripHtml(section.title || '')}
        </h2>

        {isCareer && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 9px 0' }}>
            {Number.isFinite(score) && <MatchPill pct={score} />}
            {impact && <AIImpactPill label={impact as AIImpactLevel} />}
            {move && <MovePill level={move} />}
          </div>
        )}
      </div>

      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {htmlToMarkdown(section.content || '')}
      </ReactMarkdown>
    </section>
  );
};
