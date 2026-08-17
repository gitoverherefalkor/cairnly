import React from 'react';
import type { ReportSection } from '@/hooks/useReportSections';
import { PALETTE, FONT_DISPLAY, FONT_BODY, pickSectionShareQuotes, stripHtml } from '@/components/dashboard/v2/dashboardV2Shared';
import { SHARE_PROMPT, type PrintLang } from './printIntros';

// The pull quote is the LinkedIn share-card line, printed.
//
// ── Where the text comes from, and why there are two paths ──────────────────
//
// The share feature has two mechanisms, and they are not the same:
//
//   • CAREER quotes are LLM-written and persisted to
//     `report_sections.share_quotes`. They are generated ON DEMAND — the only
//     caller in the repo is ShareCardModal, on first open — so the column is
//     null for any report whose owner never opened the share modal. At the
//     time of writing that is most of them.
//
//   • PERSONALITY quotes are never persisted at all. The dashboard derives
//     them at render time with pickSectionShareQuotes(). Calling the same
//     helper here is not a fallback or an approximation: it is the identical
//     code path the share card uses, so the printed line matches what the
//     user would see in the modal.
//
// So: prefer a stored LLM quote when one exists, otherwise derive. The
// consequence worth knowing is that this auto-upgrades — if share-quote
// generation ever moves earlier (report completion rather than modal open),
// every subsequent PDF starts printing the LLM line with no change here.
//
// The derived path is anchored on each section's punchline subsection ("Key
// Insight", "Why this role fits you"); see SHARE_QUOTE_ANCHORS for why, and
// for what happens when a report has no matching heading.

/** Pull the best available share line out of a section. */
export function shareQuoteFor(section: ReportSection): string | null {
  const stored = (section as { share_quotes?: unknown }).share_quotes;
  if (Array.isArray(stored)) {
    const first = stored.find((q) => typeof q === 'string' && q.trim().length > 0);
    if (typeof first === 'string') return first.trim();
  }
  // jsonb columns written by n8n arrive as STRING primitives often enough that
  // every reader in this codebase has to parse-if-string. Do the same here.
  if (typeof stored === 'string' && stored.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const first = parsed.find((q) => typeof q === 'string' && q.trim().length > 0);
        if (typeof first === 'string') return first.trim();
      }
    } catch {
      // Malformed — fall through to the derived path.
    }
  }
  // Punctuation tidying now happens inside the shared helper, so the dashboard
  // share card gets it too rather than only the printed page.
  const derived = pickSectionShareQuotes(
    section.section_type,
    section.content || '',
    stripHtml(section.title || ''),
    1,
  );
  return derived[0] ?? null;
}

/** Decorative opening quote mark, drawn.
 *
 *  A literal “ would be safer than most symbols but the whole document avoids
 *  non-Latin glyphs on principle: headless Chromium on Lambda has almost no
 *  system fonts, so anything Poppins and Inter do not carry becomes a tofu
 *  box. Two rounded shapes cost nothing and cannot fail. */
const QuoteMark: React.FC = () => (
  <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" style={{ flex: '0 0 auto' }}>
    <path
      d="M0 16V9.2C0 4.1 2.6 0.9 7.4 0v3.1C5.1 3.8 3.9 5.3 3.9 7.4h2.9V16H0Zm12.1 0V9.2C12.1 4.1 14.7 0.9 19.5 0v3.1c-2.3 0.7-3.5 2.2-3.5 4.3h2.9V16h-6.8Z"
      fill={PALETTE.tan}
    />
  </svg>
);

export const PrintPullQuote: React.FC<{
  quote: string;
  attribution?: string | null;
  lang: PrintLang;
  shareUrl: string;
}> = ({ quote, attribution, lang, shareUrl }) => {
  const t = SHARE_PROMPT[lang];
  return (
    <div
      className="print-nobreak"
      style={{
        margin: '7mm 0 0 0',
        padding: '6mm 7mm',
        background: PALETTE.creamLight,
        border: `1px solid rgba(201, 182, 144, 0.55)`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 7.5,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: PALETTE.tealDeep,
          marginBottom: 8,
        }}
      >
        {t.label}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <QuoteMark />
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 15,
            lineHeight: 1.4,
            letterSpacing: '-0.015em',
            color: PALETTE.canvasDeep,
          }}
        >
          {quote}
        </div>
      </div>

      {attribution && (
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 9.5,
            color: PALETTE.inkMuted,
            margin: '8px 0 0 32px',
          }}
        >
          {attribution}
        </div>
      )}

      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 8.5,
          lineHeight: 1.5,
          color: PALETTE.inkSoft,
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid rgba(201, 182, 144, 0.5)',
        }}
      >
        {t.cta}{' '}
        <span style={{ color: PALETTE.tealDeep, fontWeight: 600 }}>{shareUrl}</span>
      </div>
    </div>
  );
};
