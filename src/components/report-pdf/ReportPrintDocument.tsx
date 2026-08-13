import React from 'react';
import type { ReportSection } from '@/hooks/useReportSections';
import { PrintSheet } from './PrintPage';
import { PrintSection } from './PrintSection';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  // INVERTED, not LOGO_WORDMARK_URL: the cover background is canvasDeep
  // (#122E3B) and the standard wordmark is dark navy ink, so it would be
  // invisible. Both assets are 2:1, so the layout is unchanged.
  LOGO_INVERTED_URL,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { V4PersonalityRadarSVG } from '@/components/dashboard/v2/V4PersonalityRadarSVG';
import { V4CareerMapSVG, V4CareerMapLegend } from '@/components/dashboard/v2/V4CareerMapSVG';
import { V4CompareRadarSVG, V4CompareLegend } from '@/components/dashboard/v2/V4CompareRadarSVG';
import {
  buildRadarAxes,
  buildCareerMapPoints,
  buildCompareCareers,
} from '@/components/dashboard/v2/reportChartData';

// Narrative order for the printed document. Sections absent from the report
// are skipped; anything not listed here is appended at the end in
// order_number order so nothing is ever silently dropped.
const SECTION_ORDER = [
  'exec_summary',
  'approach',
  'personality_team',
  'strengths',
  'development',
  'values',
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
  'dream_jobs',
];

function orderSections(sections: ReportSection[]): ReportSection[] {
  return [...sections].sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.section_type);
    const bi = SECTION_ORDER.indexOf(b.section_type);
    if (ai === -1 && bi === -1) return (a.order_number ?? 0) - (b.order_number ?? 0);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** Minimal partner white-label payload. Scope is deliberately narrow: a logo on
 *  the cover, a logo in a per-page footer, and a credit line. Nothing else. */
export interface PartnerBrand {
  name: string;
  logo_data_uri: string | null;
  powered_by_text: string | null;
}

export const ReportPrintDocument: React.FC<{
  firstName: string;
  sections: ReportSection[];
  generatedAt: string | null;
  partner?: PartnerBrand | null;
}> = ({ firstName, sections, generatedAt, partner }) => {
  const ordered = orderSections(sections);
  const radarAxes = buildRadarAxes(sections);
  const mapPoints = buildCareerMapPoints(sections);
  const compare = buildCompareCareers(sections);

  const dateLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  // Deliberately English in both locales — it's a brand line, consistent with
  // the other strings kept English in the NL localization batch.
  const poweredBy = partner?.powered_by_text ?? 'Powered by Cairnly';

  // NOTE: the repeating per-page partner footer is NOT rendered here. It is
  // drawn by Chromium via the renderer's footerTemplate (see buildFooterHtml in
  // ReportPrint.tsx), which is the only mechanism that repeats on every page of
  // a naturally-paginated flow.

  return (
    <>
      {/* ── Cover ─────────────────────────────────────────────── */}
      <PrintSheet cover>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: PALETTE.canvasDeep,
            padding: '28mm 20mm',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <img
              src={LOGO_INVERTED_URL}
              alt="Cairnly"
              crossOrigin="anonymous"
              style={{ height: 46, width: 'auto' }}
            />
            {partner?.logo_data_uri && (
              <>
                <div style={{ width: 1, height: 34, background: 'rgba(255,255,255,0.28)' }} />
                {/* Inlined as a data: URI by report-print-data. A storage URL
                    here would be silently blocked by the deployed CSP's
                    img-src, producing a PDF with a hole and no error. */}
                <img
                  src={partner.logo_data_uri}
                  alt={partner.name}
                  style={{ height: 40, width: 'auto', maxWidth: 260, objectFit: 'contain' }}
                />
              </>
            )}
          </div>
          <div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color: PALETTE.goldBright,
              }}
            >
              Career Report
            </div>
            <h1
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 44,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                margin: '10px 0 0 0',
              }}
            >
              {firstName ? `${firstName}'s next move` : 'Your next move'}
            </h1>
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
            {partner ? `${dateLabel} · ${poweredBy} · cairnly.io` : `${dateLabel} · cairnly.io`}
          </div>
        </div>
      </PrintSheet>

      {/* ── Charts ────────────────────────────────────────────── */}
      {(radarAxes.length > 0 || mapPoints.length > 0 || compare.length > 0) && (
        <PrintSheet>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 22,
              color: PALETTE.canvasDeep,
              margin: '0 0 8mm 0',
            }}
          >
            Your profile at a glance
          </h2>

          {radarAxes.length > 0 && (
            <div className="print-nobreak" style={{ marginBottom: '8mm', textAlign: 'center' }}>
              <V4PersonalityRadarSVG axes={radarAxes} size={330} />
            </div>
          )}

          {mapPoints.length > 0 && (
            <div className="print-nobreak" style={{ marginBottom: '8mm' }}>
              <V4CareerMapSVG points={mapPoints} />
              <V4CareerMapLegend points={mapPoints} />
            </div>
          )}

          {compare.length > 0 && (
            <div className="print-nobreak">
              {/* variant="full" — the 460-wide viewBox. "compact" exists for the
                  dashboard's hero flip card and is too small for print. */}
              <V4CompareRadarSVG careers={compare} focalRank={1} variant="full" />
              <V4CompareLegend careers={compare} focalRank={1} />
            </div>
          )}
        </PrintSheet>
      )}

      {/* ── Narrative ─────────────────────────────────────────
          Flows naturally; Chromium paginates it. Deliberately NOT chunked
          into fixed sheets: measured against a real 20-section report, fixed
          sheets clipped 7 of 12 pages because single sections exceed a page. */}
      <div className="print-flow print-screen-paper">
        {ordered.map((s) => (
          <PrintSection key={s.id} section={s} />
        ))}
      </div>
    </>
  );
};
