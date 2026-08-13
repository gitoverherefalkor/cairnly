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
import { ReportPrintDocument } from '@/components/report-pdf/ReportPrintDocument';
import { PRINT_CSS } from '@/components/report-pdf/printStyles';

declare global {
  interface Window {
    __REPORT_READY__?: boolean;
    __REPORT_ERROR__?: string;
    // Read by the Vercel renderer and handed to page.pdf({ footerTemplate }).
    // Chromium draws this into the @page bottom margin on EVERY page, which is
    // the only way to repeat page furniture across a naturally-paginated flow.
    __PDF_FOOTER_HTML__?: string;
  }
}

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
 *  defaults to something tiny). */
function buildFooterHtml(partner: PrintData['partner']): string {
  const poweredBy = partner?.powered_by_text ?? 'Powered by Cairnly';
  const left = partner?.logo_data_uri
    ? `<img src="${partner.logo_data_uri}" style="height:9px;width:auto;opacity:0.85" />`
    : partner
      ? escapeHtml(partner.name)
      : '';
  // Unbranded reports get no footer at all — clean sheets, as before.
  if (!partner) return '<div></div>';
  return `
    <div style="width:100%;font-family:Inter,sans-serif;font-size:7px;color:#6b7280;
                padding:0 14mm;display:flex;align-items:center;
                justify-content:space-between;">
      <span>${left}</span>
      <span>${escapeHtml(poweredBy)}</span>
    </div>`;
}

interface PrintData {
  report: { id: string; title: string | null; updated_at: string | null; created_at: string };
  sections: ReportSection[];
  profile: { first_name: string; country: string | null };
  partner: { name: string; logo_data_uri: string | null; powered_by_text: string | null } | null;
}

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-print-data`;

const ReportPrint: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('rt');
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
      const settle = () => {
        if (cancelled) return;
        window.__PDF_FOOTER_HTML__ = buildFooterHtml(data.partner);
        window.__REPORT_READY__ = true;
      };
      requestAnimationFrame(() => requestAnimationFrame(settle));
      timers.push(window.setTimeout(settle, 400));
    })();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [data]);

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
        sections={data.sections}
        generatedAt={data.report.updated_at ?? data.report.created_at}
        partner={data.partner}
      />
    </>
  );
};

export default ReportPrint;
