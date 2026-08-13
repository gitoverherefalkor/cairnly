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
// are themselves longer than a page. Only the cover and the charts page are
// fixed sheets, because each is designed to occupy exactly one page.
//
// `@page :first { margin: 0 }` is what lets the cover bleed to the paper edge
// while every other page keeps real margins. Chromium supports this.

export const PRINT_CSS = `
  @page {
    size: A4;
    /* Bottom margin is deeper than the top: it doubles as the band Chromium
       draws the repeating footer into (displayHeaderFooter in the renderer). */
    margin: 16mm 14mm 18mm;
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

  /* Never orphan a heading at the foot of a page from the prose it introduces. */
  .print-flow h2,
  .print-flow h3,
  .print-flow h4 {
    page-break-after: avoid;
    break-after: avoid;
  }

  .print-flow p,
  .print-flow li {
    orphans: 3;
    widows: 3;
  }

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
      padding: 16mm 14mm 18mm;
      box-sizing: border-box;
      background: #ffffff;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
    }
  }
`;
