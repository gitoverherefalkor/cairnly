// Print-only CSS for the /report/print route. Injected as a <style> tag by
// ReportPrint.tsx rather than living in Tailwind, because these rules must
// apply to the headless-Chromium render and must not leak into the app.
//
// PAGINATION MODEL — read before changing anything here.
//
// The narrative is a NATURAL FLOW that Chromium paginates itself. An earlier
// version used fixed 297mm sheets and packed N sections per sheet; that was
// measured against a real 20-section report and clipped 7 of 12 pages, one by
// 1797px. It cannot be fixed by tuning N, because individual career sections
// are themselves longer than a page. Only the cover and the chart pages are
// fixed sheets, because each is designed to occupy exactly one page.
//
// `@page :first { margin: 0 }` is what lets the cover bleed to the paper edge
// while every other page keeps real margins. Chromium supports this.
//
// TYPOGRAPHY — why this file carries a whole type system.
//
// The app runs Tailwind, whose preflight reset zeroes the margin on every p,
// h1-h6, ul and ol. That is right for a component UI and catastrophic for a
// long-form document: it strips out every scrap of vertical rhythm, so the
// narrative rendered as one undifferentiated slab of text. Worse, the AI writes
// its sub-headings as `#####`, and a browser's default h5 is SMALLER than body
// copy — so the document's second-level structure was rendering *below* the
// size of the prose it introduced, distinguishable only by font-weight.
//
// Everything under `.print-flow` therefore restates its own typography from
// scratch. Do not assume any browser default survives here; preflight got it.

import { PALETTE } from '@/components/dashboard/v2/dashboardV2Shared';

// One place to change the page geometry. The side margin sets the measure
// (line length): 210mm paper − 2 × 19mm = 172mm of text. Measured against the
// real report, the 12px body lands at ~95 characters per line — long for a
// novel, normal for a business report, and the compromise that keeps a
// 17-page document from becoming a 25-page one. Narrowing the measure to a
// textbook 75 characters would need 48mm side margins and would add roughly
// ten pages of white space.
const MARGIN_SIDE_MM = 19;
const MARGIN_TOP_MM = 16;
const MARGIN_BOTTOM_MM = 16;

export const PAGE_MARGINS = {
  side: MARGIN_SIDE_MM,
  top: MARGIN_TOP_MM,
  bottom: MARGIN_BOTTOM_MM,
} as const;

export const PRINT_CSS = `
  @page {
    size: A4;
    margin: ${MARGIN_TOP_MM}mm ${MARGIN_SIDE_MM}mm ${MARGIN_BOTTOM_MM}mm;
  }

  /* The cover bleeds to the paper edge. */
  @page :first {
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* A block designed to occupy exactly one page (cover, charts). */
  .print-sheet {
    position: relative;
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
  }

  /* The cover is the only full-bleed sheet, so it carries the full paper size.
     Everything else lives inside the @page margins. */
  .print-sheet--cover {
    width: 210mm;
    height: 297mm;
    overflow: hidden;
  }

  /* Keep an atomic element (chart, pill row, heading) on one page. */
  .print-nobreak {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* ─── Narrative typography ───────────────────────────────────────────────
     Restated from scratch: Tailwind preflight has zeroed all of it. */

  .print-flow {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: ${PALETTE.ink};
    /* Chromium hyphenates nothing by default; on a ~95-char measure with long
       role titles ("Executive Education Facilitator"), justified text would
       open rivers. Left-aligned ragged-right is the safer choice. */
    text-align: left;
  }

  .print-flow p {
    margin: 0 0 7px 0;
    orphans: 3;
    widows: 3;
  }

  .print-flow p:last-child { margin-bottom: 0; }

  /* The AI emits its sub-headings as h5 (and occasionally h3/h4). They all mean
     the same thing — "sub-heading inside a section" — so they all get the same
     treatment rather than an accidental hierarchy based on how many hashes the
     model happened to type. Space above is much larger than space below, so a
     heading binds visually to the prose it introduces. */
  .print-flow h3,
  .print-flow h4,
  .print-flow h5,
  .print-flow h6 {
    font-family: 'Poppins', sans-serif;
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.005em;
    color: ${PALETTE.tealDeep};
    margin: 15px 0 4px 0;
    page-break-after: avoid;
    break-after: avoid;
  }

  /* Never orphan a heading at the foot of a page from the prose it introduces. */
  .print-flow h2 {
    page-break-after: avoid;
    break-after: avoid;
  }

  .print-flow strong {
    font-weight: 700;
    color: ${PALETTE.canvasDeep};
  }

  .print-flow em { font-style: italic; }

  /* Lists: preflight removed the markers AND the indent. Both come back, with
     a brand-coloured marker drawn as a pseudo-element rather than a list-style
     glyph — see the note on missing glyphs in PrintSection.tsx. */
  .print-flow ul,
  .print-flow ol {
    margin: 0 0 7px 0;
    padding: 0 0 0 15px;
    list-style: none;
  }

  .print-flow li {
    position: relative;
    margin: 0 0 3px 0;
    orphans: 2;
    widows: 2;
  }

  .print-flow ul > li::before {
    content: '';
    position: absolute;
    left: -11px;
    top: 6.5px;
    width: 3.5px;
    height: 3.5px;
    border-radius: 50%;
    background: ${PALETTE.teal};
  }

  .print-flow ol { counter-reset: print-ol; }
  .print-flow ol > li { counter-increment: print-ol; }
  .print-flow ol > li::before {
    content: counter(print-ol) '.';
    position: absolute;
    left: -15px;
    top: 0;
    font-weight: 700;
    color: ${PALETTE.teal};
    font-size: 10px;
  }

  /* Content-level rules. The AI occasionally emits a --- between blocks; it
     reads as debris next to real section separators, so it is played down to a
     short centred hairline rather than a full-width divider. */
  .print-flow hr {
    border: 0;
    border-top: 1px solid ${PALETTE.tan};
    width: 40px;
    margin: 12px auto;
    opacity: 0.6;
  }

  .print-flow table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 8px 0;
    font-size: 10px;
  }
  .print-flow th,
  .print-flow td {
    border-bottom: 1px solid ${PALETTE.cream};
    padding: 4px 6px;
    text-align: left;
    vertical-align: top;
  }
  .print-flow th {
    font-family: 'Poppins', sans-serif;
    font-weight: 700;
    color: ${PALETTE.canvasDeep};
    background: ${PALETTE.creamLight};
  }

  /* ─── Callouts ───────────────────────────────────────────────────────────
     Paragraphs the AI marks with a leading ⚠ or ✓. The marker character is
     stripped and redrawn as SVG — see PrintSection.tsx for why. */
  .print-callout {
    display: flex;
    gap: 7px;
    align-items: flex-start;
    margin: 0 0 5px 0;
    padding: 5px 8px 5px 7px;
    border-radius: 3px;
    border-left: 2px solid;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .print-callout--warn {
    border-left-color: ${PALETTE.gold};
    background: rgba(212, 160, 36, 0.07);
  }
  .print-callout--good {
    border-left-color: ${PALETTE.teal};
    background: rgba(39, 161, 161, 0.07);
  }
  .print-callout-icon { flex: 0 0 auto; margin-top: 1.5px; }
  .print-callout-body { flex: 1 1 auto; min-width: 0; }

  /* A marked list item carries its own icon, so suppress the list bullet and
     the indent that positions it. */
  .print-flow li.print-li--marked { margin-left: -15px; }
  .print-flow li.print-li--marked::before { display: none; }

  /* Belt-and-braces against global app chrome reaching the PDF. App.tsx
     already gates the banners on the route (AppChrome), but any future
     fixed-position global would otherwise be burned into every page. */
  #root > [data-app-chrome] {
    display: none !important;
  }

  /* On-screen only: approximate the paper so the layout can be eyeballed in a
     normal browser. Chromium's PDF export ignores this entirely — it paginates
     from the @page rules above, not from these boxes. */
  @media screen {
    body { background: #55606a; }
    .print-sheet--cover {
      margin: 24px auto 0;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
    }
    .print-sheet--paper {
      width: 210mm;
      min-height: 297mm;
      margin: 24px auto 0;
      padding: ${MARGIN_TOP_MM}mm ${MARGIN_SIDE_MM}mm ${MARGIN_BOTTOM_MM}mm;
      box-sizing: border-box;
      background: #ffffff;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
    }
    .print-screen-paper {
      width: 210mm;
      margin: 24px auto;
      padding: ${MARGIN_TOP_MM}mm ${MARGIN_SIDE_MM}mm ${MARGIN_BOTTOM_MM}mm;
      box-sizing: border-box;
      background: #ffffff;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
    }
  }
`;
