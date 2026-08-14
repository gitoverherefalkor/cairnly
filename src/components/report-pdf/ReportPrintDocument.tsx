import React from 'react';
import type { ReportSection } from '@/hooks/useReportSections';
import { PrintSheet } from './PrintPage';
import { PrintSection } from './PrintSection';
import { PrintCover } from './PrintCover';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from '@/components/dashboard/v2/dashboardV2Shared';
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

// Sections that exist in report_sections but must NEVER reach a user-facing
// document. `init_summary` is WF1's raw internal extraction (deliberately
// excluded from the AI-tell prompt work for the same reason); `*_feedback`
// rows record what the user told the coach, not report content.
//
// This is a denylist rather than an allowlist because SECTION_ORDER appends
// unrecognised types at the end rather than dropping them — that rule keeps
// genuinely new content visible, but it also silently leaked these two.
function isInternalSection(type: string): boolean {
  return type === 'init_summary' || /_feedback$/.test(type);
}

function orderSections(sections: ReportSection[]): ReportSection[] {
  return [...sections].filter((s) => !isInternalSection(s.section_type)).sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.section_type);
    const bi = SECTION_ORDER.indexOf(b.section_type);
    if (ai === -1 && bi === -1) return (a.order_number ?? 0) - (b.order_number ?? 0);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// ─── Document chrome strings ────────────────────────────────────────────────
// Only the frame is translated. Section titles and body copy are already
// written in the user's language by WF1–WF7; nothing here touches those.
// "Powered by Cairnly" stays English in both locales, consistent with the
// other brand lines kept English in the NL localization batch.
const STRINGS = {
  en: {
    eyebrow: 'Career Report',
    title: (n: string) => (n ? `${n}'s next move` : 'Your next move'),
    preparedFor: 'A personal read on where your experience, temperament and ambitions actually point, and what to do about it next.',
    contents: 'What’s inside',
    chartsTitle: 'Your profile at a glance',
    radarCaption: 'How you scored across the five traits that drive career fit.',
    mapCaption: 'Every role we considered, plotted by how well it matches you and how exposed it is to AI.',
    compareTitle: 'How your top three compare',
    compareCaption: 'The same three roles measured against the working conditions you said matter most.',
    page: 'Page',
  },
  nl: {
    eyebrow: 'Loopbaanrapport',
    title: (n: string) => (n ? `De volgende stap van ${n}` : 'Jouw volgende stap'),
    preparedFor: 'Een persoonlijke kijk op waar je ervaring, karakter en ambities écht naartoe wijzen, en wat je nu het beste kunt doen.',
    contents: 'Wat je hier vindt',
    chartsTitle: 'Jouw profiel in één oogopslag',
    radarCaption: 'Hoe je scoort op de vijf eigenschappen die bepalen welk werk bij je past.',
    mapCaption: 'Alle rollen die we hebben bekeken, uitgezet naar hoe goed ze bij je passen en hoe gevoelig ze zijn voor AI.',
    compareTitle: 'Jouw top drie vergeleken',
    compareCaption: 'Dezelfde drie rollen, afgezet tegen de werkomstandigheden die jij het belangrijkst vindt.',
    page: 'Pagina',
  },
} as const;

type Lang = keyof typeof STRINGS;

/** The report's language, taken from the sections themselves. Falls back to
 *  English for anything unrecognised — a report in an unexpected language
 *  should still render with a sane frame rather than blank labels.
 *
 *  `language` is read through a local narrowing rather than being added to the
 *  shared ReportSection interface. The column is real and every `select('*')`
 *  returns it, but widening that interface makes TypeScript re-check the hook's
 *  whole row shape against the (known-stale) generated Supabase types, which
 *  then fails on an unrelated `score` string/number drift. That drift is worth
 *  fixing on its own; it is not worth dragging into a cosmetics change. */
function resolveLang(sections: ReportSection[]): Lang {
  const found = sections
    .map((s) => (s as { language?: string | null }).language)
    .find((l): l is string => typeof l === 'string' && l.length > 0);
  return found?.toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

/** Minimal partner white-label payload. Scope is deliberately narrow: a logo on
 *  the cover, a logo in a per-page footer, and a credit line. Nothing else. */
export interface PartnerBrand {
  name: string;
  logo_data_uri: string | null;
  powered_by_text: string | null;
}

/** Heading for a full-page chart sheet. */
const ChartHeading: React.FC<{ title: string; caption?: string }> = ({ title, caption }) => (
  <div className="print-nobreak" style={{ marginBottom: '7mm' }}>
    <h2
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: 21,
        letterSpacing: '-0.02em',
        color: PALETTE.canvasDeep,
        margin: 0,
      }}
    >
      {title}
    </h2>
    {caption && (
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 10.5,
          lineHeight: 1.5,
          color: PALETTE.inkMuted,
          margin: '5px 0 0 0',
          maxWidth: '150mm',
        }}
      >
        {caption}
      </p>
    )}
  </div>
);

/** Caption under an individual chart. */
const ChartCaption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      fontFamily: FONT_BODY,
      fontSize: 9.5,
      lineHeight: 1.45,
      color: PALETTE.inkSoft,
      margin: '6px 0 0 0',
      textAlign: 'center',
    }}
  >
    {children}
  </p>
);

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
  const lang = resolveLang(sections);
  const t = STRINGS[lang];

  const dateLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', {
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

  const hasProfileCharts = radarAxes.length > 0 || mapPoints.length > 0;

  return (
    <>
      {/* ── Cover ─────────────────────────────────────────────── */}
      <PrintSheet cover>
        <PrintCover
          firstName={firstName}
          dateLabel={dateLabel}
          partner={partner}
          poweredBy={poweredBy}
          strings={t}
        />
      </PrintSheet>

      {/* ── Charts ────────────────────────────────────────────────
          Two deliberate sheets, not one overflowing one. Previously all three
          charts sat in a single PrintSheet that was no longer height-capped,
          so it spilled a third page holding one chart and 60% white space. */}
      {hasProfileCharts && (
        <PrintSheet>
          <ChartHeading title={t.chartsTitle} />
          {radarAxes.length > 0 && (
            <div className="print-nobreak" style={{ marginBottom: '9mm', textAlign: 'center' }}>
              <V4PersonalityRadarSVG axes={radarAxes} size={330} />
              <ChartCaption>{t.radarCaption}</ChartCaption>
            </div>
          )}
          {mapPoints.length > 0 && (
            <div className="print-nobreak">
              <V4CareerMapSVG points={mapPoints} />
              <V4CareerMapLegend points={mapPoints} print />
              <ChartCaption>{t.mapCaption}</ChartCaption>
            </div>
          )}
        </PrintSheet>
      )}

      {compare.length > 0 && (
        <PrintSheet>
          <ChartHeading title={t.compareTitle} caption={t.compareCaption} />
          <div className="print-nobreak" style={{ textAlign: 'center' }}>
            {/* variant="full" — the 460-wide viewBox. "compact" exists for the
                dashboard's hero flip card and is too small for print. */}
            <V4CompareRadarSVG careers={compare} focalRank={1} variant="full" />
          </div>
          <div style={{ marginTop: '6mm' }}>
            <V4CompareLegend careers={compare} focalRank={1} />
          </div>
        </PrintSheet>
      )}

      {/* ── Narrative ─────────────────────────────────────────
          Flows naturally; Chromium paginates it. Deliberately NOT chunked
          into fixed sheets: measured against a real 20-section report, fixed
          sheets clipped 7 of 12 pages because single sections exceed a page. */}
      <div className="print-flow print-screen-paper">
        {ordered.map((s, i) => (
          <PrintSection key={s.id} section={s} first={i === 0} />
        ))}
      </div>
    </>
  );
};
