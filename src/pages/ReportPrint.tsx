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
  }
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
  // finished loading. Two rAFs guarantee a committed frame.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.ready;
      } catch {
        // Font loading API unavailable — proceed rather than hang the render.
      }
      if (cancelled) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) window.__REPORT_READY__ = true;
        }),
      );
    })();
    return () => {
      cancelled = true;
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
