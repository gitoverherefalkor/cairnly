// /report/print — the printable report, rendered for headless Chromium.
//
// Not linked from the app UI. Auth is the single-use render token in ?rt=,
// exchanged via the public report-print-data function. When rendering and
// font loading are both finished it sets window.__REPORT_READY__, which the
// Vercel renderer polls before calling page.pdf(). Waiting on that flag is far
// more reliable than networkidle, which fires before webfonts settle and
// produces PDFs with fallback-font metrics.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReportSection } from '@/hooks/useReportSections';
import {
  ReportPrintDocument,
  resolveLang,
  documentHeaderLabel,
} from '@/components/report-pdf/ReportPrintDocument';
import { PRINT_CSS } from '@/components/report-pdf/printStyles';
import { PRINT_BUILD } from '@/components/report-pdf/printBuild';

declare global {
  interface Window {
    __REPORT_READY__?: boolean;
    __REPORT_ERROR__?: string;
    // Which SPA build drew this page. Set at module scope so it is readable the
    // moment the chunk evaluates, long before readiness. See printBuild.ts.
    __PRINT_BUILD__?: string;
    // Read by the Vercel renderer and handed to page.pdf({ headerTemplate,
    // footerTemplate }). Chromium draws these into the @page margins on EVERY
    // page, which is the only way to repeat page furniture across a
    // naturally-paginated flow.
    __PDF_FOOTER_HTML__?: string;
    __PDF_HEADER_HTML__?: string;
  }
}

// Module scope, not an effect: the fingerprint must be readable even if the
// data fetch fails or readiness never fires, since "which build is this?" is
// exactly the question you ask when a render misbehaves.
if (typeof window !== 'undefined') window.__PRINT_BUILD__ = PRINT_BUILD;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Footer markup for Chromium's footerTemplate. Must be self-contained: the
 *  template renders in its own context with no access to the page's styles, so
 *  everything is inlined and the base font-size must be set explicitly (it
 *  defaults to something tiny).
 *
 *  `.pageNumber` and `.totalPages` are Chromium's own substitution hooks — it
 *  replaces the contents of elements carrying those classes. This is the only
 *  way to number a naturally-paginated flow: Chromium does not support the CSS
 *  Paged Media margin boxes (`@bottom-right { content: counter(page) }`) that
 *  would otherwise do it, and there are no per-sheet DOM nodes to pin a number
 *  to.
 *
 *  IMPORTANT — the cover is NOT exempt. Chromium draws these templates on every
 *  page including page 1, on top of page content, and `@page :first
 *  { margin: 0 }` does not stop it: verified on a real render, where the cover
 *  came back with a footer over its artwork. The templates have no way to test
 *  the page number, so there is no conditional to write. That is why the cover
 *  no longer draws a footer of its own — the brand line would print twice on
 *  page 1.
 *
 *  Both bands carry a hairline and span the full text measure (19mm to 191mm)
 *  so they read as page furniture rather than as stray text near an edge. */
const FURNITURE_GREY = '#98A6AE';

/** Repeating page header. Holds the partner mark on white-labelled reports and
 *  the document's own title on the right. Space for the logo is reserved on
 *  every page whether or not a partner exists, so pagination does not shift
 *  when white-labelling is switched on. */
function buildHeaderHtml(partner: PrintData['partner'], docTitle: string): string {
  const left = partner?.logo_data_uri
    ? `<img src="${partner.logo_data_uri}" style="height:11px;width:auto;opacity:0.9" />`
    : partner
      ? escapeHtml(partner.name)
      : '';
  return `
    <div style="width:100%;font-family:Inter,sans-serif;font-size:8px;font-weight:400;
                color:${FURNITURE_GREY};padding:0 19mm;box-sizing:border-box;">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;
                  gap:12px;min-height:13px;padding-bottom:4px;
                  border-bottom:0.5px solid #DCD3C0;">
        <span>${left}</span>
        <span>${escapeHtml(docTitle)}</span>
      </div>
    </div>`;
}

/** Repeating page footer: the brand line, and the page number.
 *
 *  Carries a little brand colour rather than a full tinted band. A teal or green
 *  strip across the foot of all 25 pages is a lot of ink for a document people
 *  print at home, and it would fight the cream chips and callouts that already
 *  do the work of breaking the page up. The wordmark in tealDeep, the tagline in
 *  grey and a tan rule get the same lift for none of the cost. */
function buildFooterHtml(): string {
  return `
    <div style="width:100%;font-family:Inter,sans-serif;font-size:8px;font-weight:400;
                color:${FURNITURE_GREY};padding:0 19mm;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:space-between;
                  gap:12px;padding-top:5px;border-top:0.5px solid #C9B690;">
        <span><span style="color:#1F8282;font-weight:600">cairnly.io</span> - career path clarity.</span>
        <span class="pageNumber" style="color:#1F8282;font-variant-numeric:tabular-nums"></span>
      </div>
    </div>`;
}

interface PrintData {
  report: { id: string; title: string | null; updated_at: string | null; created_at: string };
  sections: ReportSection[];
  // `last_name` is NOT selected by report-print-data yet, so it is read
  // defensively: the cover falls back to the first name alone until that
  // function's select list gains it.
  profile: {
    first_name: string;
    country: string | null;
    last_name?: string | null;
    // Drives the printed document's language (language contract).
    preferred_language?: string | null;
  };
  partner: { name: string; logo_data_uri: string | null; powered_by_text: string | null } | null;
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-print-data`;

const ReportPrint: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('rt');
  // Render-time flag, deliberately not stored on the report.
  const sample = params.get('sample') === '1';
  // Render-time partner-name override, same class of thing as ?sample=1: a
  // property of THIS RENDER, never of the data.
  //
  // It exists for partner outreach. A bureau evaluating Cairnly wants to see the
  // document with its own name in it, and a blank template (`?pn=[partnernaam]`)
  // shows where that name lands. Neither should cost a row in `partners` or a
  // pipeline run — the alternative was seeding a throwaway partner per prospect.
  //
  // The logo is deliberately dropped rather than inherited: another bureau's
  // wordmark above this bureau's name would be worse than no mark at all. So the
  // cover shows only the Cairnly wordmark and the running header prints the
  // overridden name as text, which is exactly what an unlogo'd partner gets.
  const partnerNameOverride = (params.get('pn') ?? '').trim();
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing render token');
      window.__REPORT_ERROR__ = 'Missing render token';
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(FUNCTIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error(`report-print-data returned ${res.status}`);
        const json = (await res.json()) as PrintData;
        if (cancelled) return;
        setData(json);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        window.__REPORT_ERROR__ = msg;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Flip the readiness flag only after the DOM has painted AND webfonts have
  // finished loading.
  //
  // Two rAFs would normally guarantee a committed frame, but rAF NEVER FIRES
  // when document.visibilityState is 'hidden', which is exactly the state a
  // headless/backgrounded page is in. Relying on rAF alone means the flag is
  // never set and every render dies at the renderer's 30s timeout. Verified
  // against the deployed page: fonts resolve, rAF does not fire.
  //
  // So: schedule both. rAF wins on a visible page (~32ms, a genuinely
  // committed frame); the timer guarantees we still signal when hidden.
  // Whichever lands first sets the flag, and setting it twice is harmless.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const timers: number[] = [];
    (async () => {
      try {
        await document.fonts.ready;
      } catch {
        // Font loading API unavailable — proceed rather than hang the render.
      }
      if (cancelled) return;
      // Wait for images too. The section photographs are same-origin and
      // permitted by the CSP, but readiness previously gated only on fonts, so
      // a photo that had not finished decoding simply missed the snapshot and
      // left a hole in the page with a successful 200 from the renderer. That
      // silent-failure mode is the reason the report avoided images at all.
      // decode() resolves per image; a failure is swallowed deliberately,
      // because one broken photo must not cost the whole PDF.
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
        ),
      );
      if (cancelled) return;

      const settle = () => {
        if (cancelled) return;
        const name = data.profile.first_name?.trim();
        // Same resolver the document uses, so the header cannot disagree with
        // the body about what language this PDF is in.
        const docLang = resolveLang(
          data.sections,
          (data.profile as { preferred_language?: string | null }).preferred_language,
        );
        window.__PDF_HEADER_HTML__ = buildHeaderHtml(
          partnerNameOverride
            ? { name: partnerNameOverride, logo_data_uri: null, powered_by_text: null }
            : data.partner,
          documentHeaderLabel(docLang, name ?? ''),
        );
        window.__PDF_FOOTER_HTML__ = buildFooterHtml();
        window.__REPORT_READY__ = true;
      };
      requestAnimationFrame(() => requestAnimationFrame(settle));
      timers.push(window.setTimeout(settle, 400));
    })();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [data, partnerNameOverride]);

  if (error) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Render error: {error}</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading report…</div>;
  }

  return (
    <>
      <style>{PRINT_CSS}</style>
      <ReportPrintDocument
        firstName={data.profile.first_name}
        lastName={(data.profile as { last_name?: string | null }).last_name ?? null}
        sections={data.sections}
        generatedAt={data.report.updated_at ?? data.report.created_at}
        sample={sample}
        partner={
          partnerNameOverride
            ? { name: partnerNameOverride, logo_data_uri: null, powered_by_text: null }
            : data.partner
        }
        preferredLanguage={data.profile.preferred_language ?? null}
      />
    </>
  );
};

export default ReportPrint;
