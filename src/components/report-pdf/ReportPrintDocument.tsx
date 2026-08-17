import React from 'react';
import { Activity, Map as MapIcon, Scale } from 'lucide-react';
import type { ReportSection } from '@/hooks/useReportSections';
import { PrintSheet } from './PrintPage';
import { PrintSection } from './PrintSection';
import { PrintCover } from './PrintCover';
import { PrintContents } from './PrintContents';
import { PrintChapterDivider } from './PrintChapterDivider';
import { PrintPullQuote, shareQuoteFor } from './PrintPullQuote';
import { chapterFor, type Chapter, type PrintLang } from './printIntros';
import { stripHtml } from '@/components/dashboard/v2/dashboardV2Shared';
import { V4ChartBanner } from '@/components/dashboard/v2/V4ChartBanner';
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
// Section intros and chapter framing live in printIntros.ts.
//
// The chart banners reuse the dashboard's own eyebrow / title / blurb copy
// (see DashboardV4's V4ChartBanner call sites) so the printed charts read the
// same as the ones on screen.
const STRINGS = {
  en: {
    eyebrow: 'Career Report',
    title: (n: string) => (n ? `${n}'s next move` : 'Your next move'),
    preparedFor:
      'A personal read on where your experience, temperament and ambitions actually point, and what to do about it next.',
    contents: 'What’s inside',
    radarEyebrow: 'Personality radar',
    radarTitle: 'How you actually work',
    radarBlurb:
      'Your operating profile across five dimensions, built from the assessment and pressure-tested by your coach.',
    radarMeta: (n: number) => `${n} axes`,
    mapEyebrow: 'Career map',
    mapTitle: 'Where the matches sit',
    mapBlurb:
      'Your roles plotted by match strength against AI-exposure risk. Sweet spot is top-left; bottom-right is the walk-away zone.',
    compareEyebrow: 'Top three compared',
    compareTitle: 'How your top three stack up',
    compareBlurb:
      'The same three roles measured against the working conditions you said matter most.',
  },
  nl: {
    eyebrow: 'Loopbaanrapport',
    title: (n: string) => (n ? `De volgende stap van ${n}` : 'Jouw volgende stap'),
    preparedFor:
      'Een persoonlijke kijk op waar je ervaring, karakter en ambities écht naartoe wijzen, en wat je nu het beste kunt doen.',
    contents: 'Wat je hier vindt',
    radarEyebrow: 'Persoonlijkheidsradar',
    radarTitle: 'Hoe je echt werkt',
    radarBlurb:
      'Je werkprofiel op vijf dimensies, opgebouwd uit de vragenlijst en getoetst in het gesprek met je coach.',
    radarMeta: (n: number) => `${n} assen`,
    mapEyebrow: 'Loopbaankaart',
    mapTitle: 'Waar de matches liggen',
    mapBlurb:
      'Je rollen uitgezet naar hoe goed ze passen tegenover het risico op AI-impact. De sweet spot is linksboven; rechtsonder is de zone om weg te lopen.',
    compareEyebrow: 'Top drie vergeleken',
    compareTitle: 'Hoe je top drie zich verhoudt',
    compareBlurb:
      'Dezelfde drie rollen, afgezet tegen de werkomstandigheden die jij het belangrijkst vindt.',
  },
} as const;

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
function resolveLang(sections: ReportSection[]): PrintLang {
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

/** Where the reader goes to change the share line. There is no deep link to the
 *  share modal yet, so this points at the dashboard that hosts it. */
const SHARE_URL = 'cairnly.io/dashboard';

/** Pick the section a chapter's pull quote should come from.
 *
 *  About-you: the exec summary reads as the report's thesis, so it makes the
 *  strongest single line; strengths is the fallback when WF7 has not run.
 *  Careers: the top match, which is what anyone would actually share. */
function quoteSectionFor(chapter: Chapter, sections: ReportSection[]): ReportSection | null {
  const pick = (types: string[]) =>
    types.map((t) => sections.find((s) => s.section_type === t)).find(Boolean) ?? null;
  return chapter === 'about-you'
    ? pick(['exec_summary', 'strengths', 'approach', 'personality_team'])
    : pick(['top_career_1', 'top_career_2', 'outside_box']);
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

  // Pull quotes, one per chapter, lifted from the LinkedIn share feature.
  const quoteFor = (chapter: Chapter) => {
    const src = quoteSectionFor(chapter, sections);
    if (!src) return null;
    const quote = shareQuoteFor(src);
    if (!quote) return null;
    return { quote, attribution: stripHtml(src.title || '') || null };
  };
  const aboutQuote = quoteFor('about-you');
  const careerQuote = quoteFor('careers');

  // Chapter dividers are emitted inline, ahead of the first section of each
  // chapter, so they paginate with the flow rather than forcing blank sheets.
  const seenChapters = new Set<Chapter>();
  // Intros are per section TYPE; runner-ups and dream jobs arrive as several
  // rows sharing one type, and repeating the intro above each would be noise.
  const seenIntroTypes = new Set<string>();

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

      {/* ── What's inside ─────────────────────────────────────── */}
      <PrintSheet>
        <PrintContents sections={ordered} lang={lang} title={t.contents} />
      </PrintSheet>

      {/* ── Charts ────────────────────────────────────────────────
          One per sheet, each in the dashboard's own cream banner so the printed
          and on-screen versions read as the same object. See printStyles.ts
          (.print-sheet--chart) for why they are not packed together. */}
      {radarAxes.length > 0 && (
        <PrintSheet chart>
          <div className="print-nobreak">
            <V4ChartBanner
              print
              layout="vertical"
              eyebrow={t.radarEyebrow}
              icon={<Activity size={12} />}
              title={t.radarTitle}
              blurb={t.radarBlurb}
              meta={t.radarMeta(radarAxes.length)}
              chart={<V4PersonalityRadarSVG axes={radarAxes} size={360} />}
            />
          </div>
        </PrintSheet>
      )}

      {mapPoints.length > 0 && (
        <PrintSheet chart>
          <div className="print-nobreak">
            <V4ChartBanner
              print
              layout="vertical"
              eyebrow={t.mapEyebrow}
              icon={<MapIcon size={12} />}
              title={t.mapTitle}
              blurb={t.mapBlurb}
              chart={<V4CareerMapSVG points={mapPoints} />}
              legend={<V4CareerMapLegend points={mapPoints} print />}
            />
          </div>
        </PrintSheet>
      )}

      {compare.length > 0 && (
        <PrintSheet chart>
          <div className="print-nobreak">
            <V4ChartBanner
              print
              layout="vertical"
              eyebrow={t.compareEyebrow}
              icon={<Scale size={12} />}
              title={t.compareTitle}
              blurb={t.compareBlurb}
              chart={
                /* variant="full" — the 460-wide viewBox. "compact" exists for
                   the dashboard's hero flip card and is too small for print. */
                <V4CompareRadarSVG careers={compare} focalRank={1} variant="full" maxHeight={440} />
              }
              legend={<V4CompareLegend careers={compare} focalRank={1} />}
            />
          </div>
        </PrintSheet>
      )}

      {/* ── Narrative ─────────────────────────────────────────
          Flows naturally; Chromium paginates it. Deliberately NOT chunked
          into fixed sheets: measured against a real 20-section report, fixed
          sheets clipped 7 of 12 pages because single sections exceed a page. */}
      <div className="print-flow print-screen-paper">
        {ordered.map((s, i) => {
          const chapter = chapterFor(s.section_type);
          const opensChapter = !seenChapters.has(chapter);
          if (opensChapter) seenChapters.add(chapter);

          const showIntro = !seenIntroTypes.has(s.section_type);
          if (showIntro) seenIntroTypes.add(s.section_type);

          const q = chapter === 'about-you' ? aboutQuote : careerQuote;

          return (
            <React.Fragment key={s.id}>
              {opensChapter && (
                <PrintChapterDivider chapter={chapter} lang={lang}>
                  {q && (
                    <PrintPullQuote
                      quote={q.quote}
                      attribution={q.attribution}
                      lang={lang}
                      shareUrl={SHARE_URL}
                    />
                  )}
                </PrintChapterDivider>
              )}
              <PrintSection
                section={s}
                lang={lang}
                first={i === 0 || opensChapter}
                showIntro={showIntro}
              />
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
};
