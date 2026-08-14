// Deploy fingerprint for the printable report.
//
// BUMP THIS on every change to anything under src/components/report-pdf/ or
// src/pages/ReportPrint.tsx, and confirm the new value is live before judging a
// render. Two ways to read it:
//
//   • in the browser at /report/print?rt=…  →  window.__PRINT_BUILD__
//   • in the render response                →  { "printBuild": "…" }
//
// api/render-report.js reads it off the page and echoes it back with the PDF,
// so a render always states which SPA build drew it. Without this, a Vercel
// build that silently didn't happen is indistinguishable from a fix that
// didn't work — an hour was lost to exactly that on 2026-08-13.
//
// Keep it short and ordered (p1, p2, …) so "is this newer?" is obvious.
export const PRINT_BUILD = 'p2-typography-cover-charts';
