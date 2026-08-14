// Vercel serverless function: render /report/print to a PDF via headless
// Chromium.
//
// Called only by the render-report-pdf Supabase edge function, authenticated
// with a shared secret. It never talks to the database — it is handed a
// fully-formed print URL containing a single-use render token.
//
// Requires Vercel Pro: maxDuration 60s and 2048MB memory are set in
// vercel.json. Chromium OOMs at the default 1024MB on content-heavy reports.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const READY_TIMEOUT_MS = 30_000;

// ── Deploy fingerprint ───────────────────────────────────────────────────────
// BUMP THIS whenever you change this file, then poll it before judging a render:
//
//   curl -s https://www.cairnly.io/api/render-report   # → {"renderVersion":"…"}
//
// Why this exists: three consecutive renders once came back byte-for-byte
// identical across two real code changes, because the readiness check only
// proved the endpoint responded — and the OLD code responds identically. An
// hour went into debugging a fix that had never deployed. A "did it respond"
// check cannot tell you "is it new". This can.
//
// The print page carries its own independent fingerprint (PRINT_BUILD in
// src/components/report-pdf/printBuild.ts), because most cosmetic work changes
// the SPA bundle and not this file. Every POST echoes both back, so the render
// response itself states which two builds produced the PDF.
const RENDER_VERSION = 'r7-always-footer';

export default async function handler(req, res) {
  // Unauthenticated on purpose: a build marker is not a secret, and requiring
  // the shared secret to answer "are you deployed yet?" makes the check
  // annoying enough that it stops being run.
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ renderVersion: RENDER_VERSION });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.RENDER_SHARED_SECRET;
  if (!secret || req.headers['x-render-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { printUrl } = req.body || {};
  if (typeof printUrl !== 'string' || !printUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'printUrl must be an https URL' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 }, // A4 @ ~150dpi
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    // domcontentloaded, not networkidle: we gate on the app's own readiness
    // flag, which is a stronger signal than an idle network.
    await page.goto(printUrl, { waitUntil: 'domcontentloaded', timeout: READY_TIMEOUT_MS });

    // On timeout, report what actually loaded. The single most common cause is
    // the print URL and the renderer being on different deployments, where the
    // SPA catch-all serves NotFound and no readiness flag is ever set.
    try {
      await page.waitForFunction(
        () => window.__REPORT_READY__ === true || typeof window.__REPORT_ERROR__ === 'string',
        { timeout: READY_TIMEOUT_MS },
      );
    } catch {
      // location.pathname only — the full URL carries the render token.
      const seen = await page.evaluate(() => ({
        path: location.pathname,
        title: document.title,
      }));
      return res.status(504).json({
        error:
          `Print page never signalled readiness. Loaded ${seen.path} (title: "${seen.title}"). ` +
          `If that looks like a 404 page, SITE_URL and the deployment running this renderer ` +
          `are different origins.`,
      });
    }

    const renderError = await page.evaluate(() => window.__REPORT_ERROR__ || null);
    if (renderError) {
      return res.status(422).json({ error: `Print page failed: ${renderError}` });
    }

    // Which SPA build actually drew this PDF. Returned to the caller so a
    // render can never again be judged against code that was not deployed.
    const printBuild = await page.evaluate(() => window.__PRINT_BUILD__ || 'unknown');

    // The page builds its own footer markup (it is the only thing that knows
    // the partner branding). Chromium repeats it into the @page bottom margin
    // on every page — the only mechanism that works for a naturally-paginated
    // flow, where there are no per-sheet DOM nodes to pin a footer to.
    const footerTemplate = await page.evaluate(
      () => window.__PDF_FOOTER_HTML__ || '<div></div>',
    );

    // Every report now gets a footer, because every report wants page numbers.
    //
    // This was previously gated off, on the belief that displayHeaderFooter
    // reserves its own margin band and stops honouring `@page :first
    // { margin: 0 }`, shrinking the full-bleed cover. That diagnosis was
    // wrong: the culprit was `format: 'A4'` fighting preferCSSPageSize (see
    // the note on page.pdf below). With format gone, the cover bleeds and the
    // footer draws into the @page bottom margin as intended — the cover keeps
    // its zero margin, so it gets no footer band and stays clean.
    //
    // If white gutters ever reappear on the cover, re-test these two settings
    // TOGETHER, and check the deploy fingerprint before believing the result.
    const hasFooter = footerTemplate.trim() !== '<div></div>';

    const pdf = await page.pdf({
      // NO `format` here. Passing format alongside preferCSSPageSize gives
      // Chromium two conflicting page sizes and it scales the content to fit,
      // which shrank the full-bleed cover to ~89% on both axes and left white
      // gutters down the right and bottom. The stylesheet's `@page { size: A4 }`
      // is the single source of truth.
      printBackground: true,
      // Page size AND margins come from the stylesheet's @page rules, which is
      // what lets `@page :first { margin: 0 }` give the cover a full bleed
      // while every other page keeps its margins.
      preferCSSPageSize: true,
      ...(hasFooter
        ? { displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate }
        : {}),
    });

    return res.status(200).json({
      pdfBase64: Buffer.from(pdf).toString('base64'),
      renderVersion: RENDER_VERSION,
      printBuild,
    });
  } catch (err) {
    console.error('[render-report] failed:', err);
    return res.status(500).json({ error: String((err && err.message) || err) });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Best effort — the lambda is about to be frozen anyway.
      }
    }
  }
}
