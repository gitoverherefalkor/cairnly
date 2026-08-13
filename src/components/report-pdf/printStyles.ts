// Print-only CSS for the /report/print route. Injected as a <style> tag by
// ReportPrint.tsx rather than living in Tailwind, because these rules must
// apply to the headless-Chromium render and must not leak into the app.

export const PRINT_CSS = `
  @page {
    size: A4;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Each .print-page is exactly one A4 sheet. height (not min-height) keeps
     Chromium from spilling a sliver onto a following blank page. */
  .print-page {
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
  }

  .print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  /* Never split a pill, chart or heading across a page boundary. */
  .print-nobreak {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Belt-and-braces against global app chrome reaching the PDF. App.tsx
     already gates the banners on the route (AppChrome), but any future
     fixed-position global would otherwise be burned into every page. */
  #root > [data-app-chrome] {
    display: none !important;
  }

  /* On-screen only: show sheet edges while developing. Chromium's PDF export
     ignores this because it prints at the @page size with no viewport chrome. */
  @media screen {
    body { background: #55606a; padding: 24px 0; }
    .print-page {
      margin: 0 auto 24px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.35);
      background: #ffffff;
    }
  }
`;
