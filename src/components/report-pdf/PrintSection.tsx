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
import { iconForSubsection } from '@/components/chat/subsectionIcons';
import { iconForSection, eyebrowFor, anchorFor, photoKeyFor } from './printSectionMeta';
import { PrintChip } from './PrintGroupHeader';
import { introFor, type PrintLang } from './printIntros';

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

/** Strip tags AND stray markdown bold. WF4 writes `company_size_type` as a
 *  fragment of markup ("<h4><strong>Small (11-50) / Boutique</strong></h4>"),
 *  so a plain render prints the tags. Mirrors `cleanField` in ReportSidebar,
 *  which exists for this exact field. */
function cleanField(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
}

// Sections that carry match / AI-impact / move pills.
//
// runner_ups was missing from this list, which was simply wrong: 81 of 82
// runner-up rows in production carry a score, 61 carry a `move`, and 81 discuss
// AI impact. They were the only ranked roles in the document rendering without
// their numbers. dream_jobs has no score (MatchPill self-skips on a non-finite
// value) but does carry move and AI impact.
const CAREER_TYPES = [
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
  'dream_jobs',
];

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
const MARKER_RE = /^\s*([⚠✓])[\s ]*/;

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

/** Flatten a heading's children to plain text, for the icon lookup. */
function headingText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((c) => {
      if (typeof c === 'string') return c;
      if (typeof c === 'number') return String(c);
      // Bold-wrapped subheaders happen; reach one level in for their text.
      if (React.isValidElement(c)) return headingText((c.props as { children?: React.ReactNode }).children);
      return '';
    })
    .join('');
}

/** Sub-heading renderer.
 *
 *  Two jobs. First, ICONS: `iconForSubsection` maps the model's exact h5 text
 *  to a Lucide icon and already carries both the English and Dutch subheader
 *  tables. The chat has rendered these for a while; the print pipeline simply
 *  never called it, which is why the PDF had none.
 *
 *  Second, SEMANTICS: the model writes its sub-headings as `#####`, so the
 *  markdown pipeline emitted `<h5>` directly under the section's `<h2>`,
 *  skipping two levels. Everything the model emits at h3/h4/h5 means the same
 *  thing — "sub-heading inside a section" — so they all render at ONE level,
 *  chosen by where the section itself sits: h3 under a top-level section, h4
 *  under a role that is nested inside a group. That keeps the outline honest
 *  about what contains what.
 *
 *  Styling comes from `.print-subhead`, never from the tag, precisely because
 *  the tag now varies. */
function makeSubheading(tag: 'h3' | 'h4') {
  const Subheading: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const text = headingText(children);
    const Icon = iconForSubsection(text);
    return React.createElement(
      tag,
      { className: 'print-subhead' },
      Icon ? <Icon size={14} className="print-subhead-icon" aria-hidden="true" /> : null,
      <span key="t">{children}</span>,
    );
  };
  return Subheading;
}

const SubheadingH3 = makeSubheading('h3');
const SubheadingH4 = makeSubheading('h4');

const MD_COMPONENTS_TOP = {
  p: PrintParagraph,
  li: PrintListItem,
  h3: SubheadingH3,
  h4: SubheadingH3,
  h5: SubheadingH3,
  h6: SubheadingH3,
} as const;

const MD_COMPONENTS_NESTED = {
  p: PrintParagraph,
  li: PrintListItem,
  h3: SubheadingH4,
  h4: SubheadingH4,
  h5: SubheadingH4,
  h6: SubheadingH4,
} as const;

export const PrintSection: React.FC<{
  section: ReportSection;
  lang: PrintLang;
  first?: boolean;
  /** 'nested' = a role sitting under a group header (runner-ups, outside-the-box,
   *  dream jobs). Its title steps down to h3 and its sub-headings to h4, and it
   *  does not repeat the group's intro. */
  level?: 'top' | 'nested';
  /** Intros are per section TYPE. Only the first row of a run shows one, and
   *  grouped types show theirs on the group header instead. */
  showIntro?: boolean;
  /** Start this section on a fresh page. */
  breakBefore?: boolean;
}> = ({ section, lang, first = false, level = 'top', showIntro = true, breakBefore = false }) => {
  const nested = level === 'nested';
  const isCareer = CAREER_TYPES.includes(section.section_type);
  const score = section.score != null ? Number(section.score) : NaN;
  const impact = isCareer ? extractAIImpact(section.content || '') : null;
  const move = section.metadata?.move as MoveLevel | undefined;
  const eyebrow = nested ? null : eyebrowFor(section.section_type, lang);
  const Icon = iconForSection(section.section_type);
  const intro = showIntro && !nested ? introFor(section.section_type, lang) : null;
  const photoKey = photoKeyFor(section.section_type);
  // WF4 writes this as a fragment of markup, so it needs the same cleaning the
  // chat sidebar does. It answers "what kind of employer is this?", which the
  // role title never does.
  const sizeType = cleanField(section.company_size_type);
  const TitleTag = nested ? 'h3' : 'h2';
  // Career sections lead with the chip and slot framing; everything else leads
  // with its title. See the note on reading order below.
  const chipFirst = isCareer && !nested;

  // Chip and intro are ONE unit, and the chip never appears without it. Nested
  // roles take their intro from the group header, so gating on the intro is what
  // stops them printing a lone square with empty space beside it. Repeating the
  // chip there would be pointless anyway: it is derived from section_type, so
  // every role in a group gets the identical glyph the group header shows.
  const introBlock = intro ? (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <PrintChip visualKey={photoKey} sectionType={section.section_type} />
      <p
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          fontFamily: FONT_BODY,
          fontSize: 12,
          lineHeight: 1.55,
          color: PALETTE.inkMuted,
          margin: 0,
          paddingLeft: 10,
          borderLeft: `2px solid ${PALETTE.tan}`,
          maxWidth: '150mm',
        }}
      >
        {intro}
      </p>
    </div>
  ) : null;

  return (
    <section
      id={nested ? undefined : anchorFor(section.section_type)}
      style={{
        marginBottom: nested ? '7mm' : '9mm',
        // A hairline above each section is the cheapest possible signal that
        // one topic ended and another began, and it survives page breaks
        // (unlike a bottom border, which can land alone at the top of a page).
        // Nested roles sit inside a group that already has its own frame, so
        // they get a lighter divider.
        borderTop:
          first || breakBefore
            ? 'none'
            : `1px solid ${nested ? 'rgba(236,228,210,0.75)' : PALETTE.cream}`,
        paddingTop: first || breakBefore ? 0 : nested ? '5mm' : '7mm',
        // A section that opens a page needs no rule above it — the page edge is
        // already the strongest separator there is.
        ...(breakBefore ? { breakBefore: 'page', pageBreakBefore: 'always' } : {}),
      }}
    >
      {/* Reading order differs by section kind, on purpose.
          ABOUT-YOU: eyebrow, title, then chip + intro. The intro describes the
          section, so it belongs under the section's own name.
          CAREER: eyebrow, then chip + intro, THEN the role title, size and
          pills. A career's intro describes the SLOT ("your third match, and the
          last of the top three"), not the job, so it belongs with the eyebrow
          above the specific role name rather than under it. */}
      <div className="print-section-head" style={{ marginBottom: intro ? '7mm' : '4mm' }}>
        {eyebrow && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              // Eyebrows now do the work of a sub-section header, so they carry
              // a size to match rather than sitting at caption scale.
              fontSize: 9.5,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: PALETTE.gold,
              margin: '0 0 7px 0',
            }}
          >
            {/* Same icon the chat sidebar shows for this section. */}
            {Icon && <Icon size={15} aria-hidden="true" />}
            {eyebrow}
          </div>
        )}

        {chipFirst && introBlock}

        <TitleTag
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: nested ? 17.5 : 21,
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            color: PALETTE.canvasDeep,
            margin: chipFirst ? '7mm 0 2px 0' : sizeType ? '0 0 2px 0' : '0 0 8px 0',
          }}
        >
          {stripHtml(section.title || '')}
        </TitleTag>

        {sizeType && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              color: PALETTE.inkSoft,
              margin: '0 0 8px 0',
            }}
          >
            {sizeType}
          </div>
        )}

        {isCareer && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 0 0' }}>
            {Number.isFinite(score) && <MatchPill pct={score} />}
            {impact && <AIImpactPill label={impact as AIImpactLevel} />}
            {move && <MovePill level={move} />}
          </div>
        )}

        {!chipFirst && introBlock}
      </div>

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={nested ? MD_COMPONENTS_NESTED : MD_COMPONENTS_TOP}
      >
        {htmlToMarkdown(section.content || '')}
      </ReactMarkdown>
    </section>
  );
};
