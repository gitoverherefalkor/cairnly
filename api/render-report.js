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
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';

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
const RENDER_VERSION = 'r11-dests-dict';


/** Repair the contents page's internal links after the two-pass merge.
 *
 *  Chromium writes same-document links as NAMED destinations: the annotation
 *  carries `/Dest /sec-exec_summary` and the document resolves that name
 *  elsewhere. pdf-lib's copyPages copies pages and their annotations but NOT the
 *  document-level destination catalogue, so after the merge every link pointed
 *  at a name that no longer resolved. The links were all present and all dead:
 *  11 of them, silently.
 *
 *  PDF has TWO places that catalogue can live and Chromium uses the older one:
 *    • `/Root /Dests`          — a plain dictionary (PDF 1.1)
 *    • `/Root /Names /Dests`   — a name tree (PDF 1.2+)
 *  Reading only the name tree found nothing, which is why the first attempt at
 *  this fix changed nothing. Both are read now.
 *
 *  Each link is rewritten to an EXPLICIT destination — `[pageRef, /XYZ, …]` —
 *  which needs no catalogue entry and cannot be dropped by a later copy.
 *
 *  `offset` is how many pages precede the body in the merged file (the cover).
 *  Returns how many links it repaired, which the response reports so a silent
 *  regression here is visible without opening the PDF.
 */
function relinkNamedDests(merged, bodySrc, offset) {
  if (!bodySrc) return 0;

  // Destination name -> page index within the body document.
  const nameToIndex = new Map();
  const srcPageRefs = bodySrc.getPages().map((p) => p.ref.toString());

  const record = (key, value) => {
    if (key === undefined || key === null) return;
    const arr =
      value instanceof PDFArray ? value : value?.lookupMaybe?.(PDFName.of('D'), PDFArray);
    if (!arr || arr.size() === 0) return;
    const idx = srcPageRefs.indexOf(arr.get(0)?.toString());
    if (idx === -1) return;
    // Keys arrive as PDFName ("/sec-x") or PDFString ("sec-x"). Store bare.
    const bare = String(key.decodeText ? key.decodeText() : key).replace(/^\//, '');
    nameToIndex.set(bare, idx);
  };

  // (a) plain /Dests dictionary — what Chromium actually emits.
  const destsDict = bodySrc.catalog.lookupMaybe(PDFName.of('Dests'), PDFDict);
  if (destsDict) {
    for (const [key, value] of destsDict.entries()) record(key, destsDict.context.lookup(value));
  }

  // (b) /Names /Dests name tree, for completeness.
  const walk = (node) => {
    if (!node) return;
    const names = node.lookupMaybe(PDFName.of('Names'), PDFArray);
    if (names) {
      for (let i = 0; i + 1 < names.size(); i += 2) record(names.get(i), names.lookup(i + 1));
    }
    const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
    if (kids) for (let i = 0; i < kids.size(); i++) walk(kids.lookup(i, PDFDict));
  };
  walk(bodySrc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict)?.lookupMaybe(PDFName.of('Dests'), PDFDict));

  if (nameToIndex.size === 0) return 0;

  const mergedPages = merged.getPages();
  let fixed = 0;
  for (const pg of mergedPages) {
    const annots = pg.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annots) continue;
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i, PDFDict);
      if (!a) continue;
      if (a.get(PDFName.of('Subtype'))?.toString() !== '/Link') continue;
      const dest = a.get(PDFName.of('Dest'));
      if (!dest || dest instanceof PDFArray) continue; // already explicit
      const key = String(dest.decodeText ? dest.decodeText() : dest).replace(/^\//, '');
      const idx = nameToIndex.get(key);
      if (idx === undefined) continue;
      const targetPage = mergedPages[idx + offset];
      if (!targetPage) continue;
      a.set(
        PDFName.of('Dest'),
        merged.context.obj([targetPage.ref, PDFName.of('XYZ'), null, null, null]),
      );
      fixed++;
    }
  }
  return fixed;
}

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

    // The page builds its own header/footer markup (it is the only thing that
    // knows the partner branding and the reader's name). Chromium repeats them
    // into the @page margins on every page — the only mechanism that works for
    // a naturally-paginated flow, where there are no per-sheet DOM nodes to pin
    // page furniture to.
    const footerTemplate = await page.evaluate(
      () => window.__PDF_FOOTER_HTML__ || '<div></div>',
    );
    const headerTemplate = await page.evaluate(
      () => window.__PDF_HEADER_HTML__ || '<div></div>',
    );

    // Every report now gets a footer, because every report wants page numbers.
    //
    // This was previously gated off, on the belief that displayHeaderFooter
    // reserves its own margin band and stops honouring `@page :first
    // { margin: 0 }`, shrinking the full-bleed cover. That diagnosis was
    // wrong: the culprit was `format: 'A4'` fighting preferCSSPageSize (see
    // the note on page.pdf below). With format gone, the cover bleeds to all
    // four edges with the footer enabled — measured, not assumed.
    //
    // Chromium draws the templates on page 1 as well and nothing in a template
    // can suppress that, so the cover is exported in a SEPARATE pass with the
    // furniture off and the two PDFs are merged. See the two-pass block below.
    //
    // If white gutters ever reappear on the cover, re-test these two settings
    // TOGETHER, and check the deploy fingerprint before believing the result.
    const hasFooter = footerTemplate.trim() !== '<div></div>';

    // Shared across both passes below.
    //
    // NO `format` here. Passing format alongside preferCSSPageSize gives
    // Chromium two conflicting page sizes and it scales the content to fit,
    // which shrank the full-bleed cover to ~89% on both axes and left white
    // gutters down the right and bottom. The stylesheet's `@page { size: A4 }`
    // is the single source of truth.
    //
    // Page size AND margins come from the stylesheet's @page rules, which is
    // what lets `@page :first { margin: 0 }` give the cover a full bleed while
    // every other page keeps its margins.
    const baseOptions = { printBackground: true, preferCSSPageSize: true };

    // ── Two passes, then merge ────────────────────────────────────────────
    // Chromium draws the header/footer templates on EVERY page including the
    // first, and nothing in a template can test the page number — so a cover
    // always got the running header stamped across it. With a white band at the
    // top of the cover that is plainly a defect, not a subtlety.
    //
    // Exporting the cover on its own with the furniture OFF, the body with it
    // ON, and stitching the two is the only way to get a genuinely clean cover.
    // Both passes reuse the SAME already-rendered page, so the second export is
    // cheap — no reload, no second readiness wait.
    //
    // This also retires a constraint that had shaped the design: the cover no
    // longer has to avoid carrying its own brand line.
    //
    // The cover is unnumbered either way, which is the normal book convention.
    // Whether the body's first page then reads "1" or "2" depends on whether
    // Chromium renumbers within a pageRanges export — both are acceptable, so
    // this deliberately does not try to force one. Check a render before
    // asserting which it is.
    let pdf;
    let linksRepaired = 0;
    if (hasFooter) {
      const [coverPdf, bodyPdf] = await Promise.all([
        page.pdf({ ...baseOptions, pageRanges: '1' }),
        page.pdf({ ...baseOptions, pageRanges: '2-', displayHeaderFooter: true, headerTemplate, footerTemplate }),
      ]);
      const merged = await PDFDocument.create();
      let bodySrc = null;
      for (const part of [coverPdf, bodyPdf]) {
        const src = await PDFDocument.load(part);
        const pages = await merged.copyPages(src, src.getPageIndices());
        if (part === bodyPdf) bodySrc = src;
        pages.forEach((p) => merged.addPage(p));
      }
      linksRepaired = relinkNamedDests(merged, bodySrc, merged.getPageCount() - bodySrc.getPageCount());
      pdf = await merged.save();
    } else {
      pdf = await page.pdf(baseOptions);
    }

    return res.status(200).json({
      pdfBase64: Buffer.from(pdf).toString('base64'),
      renderVersion: RENDER_VERSION,
      printBuild,
      // Contents-page links repaired after the merge. 0 on a report that has a
      // contents page means the destination catalogue moved again — see
      // relinkNamedDests.
      linksRepaired,
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
