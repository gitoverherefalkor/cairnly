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
// are themselves longer than a page. Only the cover is a fixed sheet.
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
//
// SIZES ARE IN px BUT THE TARGET IS POINTS. 96px/inch and 72pt/inch, so
// 1pt = 1.333px. The body was 12px = 9pt, which is below what any print
// designer would set for A4 body copy; it now sits at 10pt. The pt equivalent
// is noted on each rule because "is 13.3px big enough?" is unanswerable and
// "is 10pt big enough?" is not.

import { PALETTE } from '@/components/dashboard/v2/dashboardV2Shared';

// One place to change the page geometry.
//
// The side margin sets the measure (line length): 210mm paper − 2 × 19mm =
// 172mm of text, which at 10pt lands near 86 characters per line. That is
// inside the range a print designer would accept without the 48mm margins a
// textbook 75 characters would demand.
//
// Top and bottom are asymmetric because Chromium draws the repeating header and
// footer INTO those margin bands (displayHeaderFooter in the renderer). They
// need to be deep enough to hold a hairline plus a line of 8pt text without
// crowding the body.
const MARGIN_SIDE_MM = 19;
const MARGIN_TOP_MM = 21;
const MARGIN_BOTTOM_MM = 20;

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

  /* A block designed to occupy exactly one page (the cover). */
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

  /* A section header must not be the last thing on a page. Keeping the header
     block intact is not enough on its own — a career title plus its pills was
     landing at the foot of a page with the role's first paragraph overleaf. */
  .print-section-head {
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: avoid;
    break-after: avoid;
  }

  /* ─── Narrative typography ───────────────────────────────────────────────
     Restated from scratch: Tailwind preflight has zeroed all of it. */

  .print-flow {
    font-family: 'Inter', sans-serif;
    font-size: 13.3px; /* 10pt */
    line-height: 1.58;
    color: ${PALETTE.ink};
    /* Chromium hyphenates nothing by default; on an 86-char measure with long
       role titles ("Executive Education Facilitator"), justified text would
       open rivers. Left-aligned ragged-right is the safer choice. */
    text-align: left;
  }

  .print-flow p {
    margin: 0 0 8px 0;
    orphans: 3;
    widows: 3;
  }

  .print-flow p:last-child { margin-bottom: 0; }

  /* Sub-headings.
     Styled by CLASS, not by tag. The model writes its sub-headings as "#####"
     and PrintSection re-renders every one of them at the right level for its
     context — h3 under a top-level section, h4 under a role nested inside a
     group. A tag-based rule would then also catch the nested role TITLE, which
     is itself an h3. Space above is much larger than space below, so a heading
     binds visually to the prose it introduces. */
  .print-flow .print-subhead {
    font-family: 'Poppins', sans-serif;
    font-size: 14px; /* 10.5pt */
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.005em;
    color: ${PALETTE.tealDeep};
    margin: 17px 0 5px 0;
    page-break-after: avoid;
    break-after: avoid;
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  /* Sub-heading icons come from iconForSubsection (the same map the chat uses).
     flex-start + a small nudge optically centres the icon against the
     cap-height of the text, which vertical-align cannot do reliably across a
     page break. */
  .print-flow .print-subhead-icon {
    flex: 0 0 auto;
    margin-top: 2px;
    color: ${PALETTE.teal};
  }

  /* Never orphan a section or role heading from what follows it. */
  .print-flow h2,
  .print-flow h3 {
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
    margin: 0 0 8px 0;
    padding: 0 0 0 17px;
    list-style: none;
  }

  .print-flow li {
    position: relative;
    margin: 0 0 4px 0;
    orphans: 2;
    widows: 2;
  }

  .print-flow ul > li::before {
    content: '';
    position: absolute;
    left: -12px;
    top: 7.5px;
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
    left: -17px;
    top: 0;
    font-weight: 700;
    color: ${PALETTE.teal};
    font-size: 11px;
  }

  /* Content-level rules, played down. */
  .print-flow hr {
    border: 0;
    border-top: 1px solid ${PALETTE.tan};
    width: 40px;
    margin: 13px auto;
    opacity: 0.6;
  }
  .print-flow hr:last-child { display: none; }

  /* Some reports put a --- before EVERY subsection. Once sub-headings carry an
     icon and real space above them, a rule directly above one is pure noise —
     one page of a real report had four. Hidden when the next sibling is a
     sub-heading, kept when it genuinely divides prose.

     :has() is Chromium 105+, well under what @sparticuz/chromium ships. If it
     ever were unsupported the selector is simply ignored and the rules come
     back, which is the harmless direction to fail in. */
  .print-flow hr:has(+ h3),
  .print-flow hr:has(+ h4),
  .print-flow hr:has(+ h5) {
    display: none;
  }

  .print-flow table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 9px 0;
    font-size: 11.3px; /* 8.5pt */
  }
  .print-flow th,
  .print-flow td {
    border-bottom: 1px solid ${PALETTE.cream};
    padding: 5px 7px;
    text-align: left;
    vertical-align: top;
  }
  .print-flow th {
    font-family: 'Poppins', sans-serif;
    font-weight: 700;
    color: ${PALETTE.canvasDeep};
    background: ${PALETTE.creamLight};
  }

  /* Contents-page anchors become real internal links in the PDF (Chromium
     turns same-document hrefs into GoTo annotations). They must not look like
     web links on paper. */
  .print-contents-link,
  .print-contents-link:visited {
    text-decoration: none;
    color: inherit;
  }

  /* ─── Callouts ───────────────────────────────────────────────────────────
     Paragraphs the AI marks with a leading ⚠ or ✓. The marker character is
     stripped and redrawn as SVG — see PrintSection.tsx for why. */
  .print-callout {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    margin: 0 0 6px 0;
    padding: 6px 9px 6px 8px;
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
  .print-callout-icon { flex: 0 0 auto; margin-top: 2px; }
  .print-callout-body { flex: 1 1 auto; min-width: 0; }

  /* A marked list item carries its own icon, so suppress the list bullet and
     the indent that positions it. */
  .print-flow li.print-li--marked { margin-left: -17px; }
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
