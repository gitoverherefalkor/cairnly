import React from 'react';
import { Activity, Map as MapIcon, Scale } from 'lucide-react';
import type { ReportSection } from '@/hooks/useReportSections';
import { hasTranslation, sectionTitle } from '@/lib/sectionText';
import { PrintSheet } from './PrintPage';
import { PrintSection } from './PrintSection';
import { PrintCover } from './PrintCover';
import { PrintContents } from './PrintContents';
import { PrintChapterDivider } from './PrintChapterDivider';
import { PrintGroupHeader } from './PrintGroupHeader';
import { PrintPullQuote, shareQuoteFor } from './PrintPullQuote';
import { PrintClosing } from './PrintClosing';
import { isGroupType, breaksPage } from './printSectionMeta';
import { chapterFor, type Chapter, type PrintLang } from './printIntros';
import { stripHtml, PALETTE, FONT_BODY } from '@/components/dashboard/v2/dashboardV2Shared';
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
    coverKicker: 'Career direction report',
    coverKickerSample: 'Sample report',
    title: (n: string) => (n ? `${n}'s next move` : 'Your next move'),
    coverSubtitle:
      'Where your strengths, values and the market meet, and the routes that follow from it.',
    preparedFor: (n: string) => (n ? `Prepared for ${n}` : 'Prepared for you'),
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
    chartMoreBefore: 'For further details regarding this graph, consult your ',
    chartMoreLink: 'dashboard',
    chartMoreAfter: '.',
  },
  nl: {
    coverKicker: 'Loopbaanrapport',
    coverKickerSample: 'Voorbeeldrapport',
    title: (n: string) => (n ? `De volgende stap van ${n}` : 'Jouw volgende stap'),
    coverSubtitle:
      'Waar je sterke punten, je waarden en de markt samenkomen, en welke routes daaruit volgen.',
    preparedFor: (n: string) => (n ? `Opgesteld voor ${n}` : 'Voor jou opgesteld'),
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
    chartMoreBefore: 'Bekijk je ',
    chartMoreLink: 'dashboard',
    chartMoreAfter: ' voor meer details bij deze grafiek.',
  },
} as const;

/** The printed document's language, under the language contract: the user's
 *  preferred_language, honoured only when EVERY translatable section carries
 *  that translation — all-or-nothing, so chrome and prose always agree and a
 *  PDF is never mixed-language. Anything else renders fully in English (the
 *  canonical content, always present). chat_highlights is natively in the
 *  user's language and never translated, so it is excluded from the check. */
export function resolveLang(sections: ReportSection[], preferred: string | null | undefined): PrintLang {
  const lang = String(preferred ?? 'en').slice(0, 2).toLowerCase();
  if (lang !== 'nl') return 'en'; // PrintLang currently supports en | nl
  const translatable = sections.filter(
    (s) =>
      !isInternalSection(s.section_type) &&
      s.section_type !== 'chat_highlights' &&
      (s.content ?? '').length > 0,
  );
  const complete =
    translatable.length > 0 && translatable.every((s) => hasTranslation(s, lang));
  return complete ? 'nl' : 'en';
}

/** Running-header text, in the DOCUMENT's language. Exported because the header
 *  is built in ReportPrint.tsx (Chromium needs it as a template string before
 *  the document renders), and it must not be the one bit of English left on a
 *  Dutch report. */
export function documentHeaderLabel(lang: PrintLang, firstName: string): string {
  const doc = lang === 'nl' ? 'Loopbaanrapport' : 'Career Report';
  return firstName ? `${firstName} · ${doc}` : doc;
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

/** Real href for every dashboard link in the document. */
export const DASHBOARD_URL = 'https://www.cairnly.io/dashboard';

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
  /** Marks the cover as a specimen. Set from `?sample=1` on the print URL, not
   *  from data: it is a property of THIS RENDER, not of the report. A demo sent
   *  to prospects must not be mistakable for a real client's document. */
  sample?: boolean;
  /** Optional — report-print-data does not select it yet, so the cover falls
   *  back to the first name alone. Adding `last_name` to that function's select
   *  is the only change needed for "Prepared for Mirko van der Velde". */
  lastName?: string | null;
  sections: ReportSection[];
  generatedAt: string | null;
  partner?: PartnerBrand | null;
  /** profiles.preferred_language, shipped by report-print-data. */
  preferredLanguage?: string | null;
}> = ({ firstName, lastName, sections, generatedAt, partner, preferredLanguage, sample = false }) => {
  const ordered = orderSections(sections);
  const lang = resolveLang(sections, preferredLanguage);
  const radarAxes = buildRadarAxes(sections);
  const mapPoints = buildCareerMapPoints(sections, lang);
  const compare = buildCompareCareers(sections, lang);
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

  // Pull quotes, one per chapter, lifted from the LinkedIn share feature. The
  // quote is kept on white-labelled reports; only its "make a share card"
  // footer is dropped, because that footer sells a Cairnly-branded LinkedIn
  // asset to someone the bureau is handing a document to. Same reasoning as the
  // partner closing page in PrintClosing.
  const quoteFor = (chapter: Chapter) => {
    const src = quoteSectionFor(chapter, sections);
    if (!src) return null;
    const quote = shareQuoteFor(src, lang);
    if (!quote) return null;
    return { quote, attribution: stripHtml(sectionTitle(src, lang) || '') || null };
  };
  const aboutQuote = quoteFor('about-you');
  const careerQuote = quoteFor('careers');

  // ── Charts ─────────────────────────────────────────────────────────────
  // Each chapter OPENS on its own page carrying three things: the divider, the
  // chapter's pull quote, and the chapter's headline chart. That page is the
  // chapter's front door — the reader gets the framing, a line worth sharing and
  // the one picture that summarises what follows, before any prose.
  //
  //   • Chapter one: the personality radar, built from `approach`'s scores.
  //   • Chapter two: the top-three comparison, which is what the whole chapter
  //     is arguing about.
  //
  // The career map is NOT a chapter chart. It plots every role including the
  // runner-ups, so it stays down in the flow just ahead of the first grouped
  // set, where it does the work of saying "here is everything, not just the top
  // three".
  //
  // Charts keep the dashboard's cream V4ChartBanner so printed and on-screen
  // read as the same object, and each carries a line pointing at the dashboard,
  // where the same chart is interactive.
  const chartCard = (node: React.ReactNode) => (
    <div className="print-nobreak" style={{ margin: '0 0 4mm 0' }}>
      {node}
      {/* Only the word "dashboard" is the link, and it is a REAL one: an
          external href becomes a URI action annotation, which unlike the
          contents page's internal links survives the two-pass merge untouched
          (no page reference to remap). */}
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 9,
          lineHeight: 1.4,
          color: PALETTE.inkSoft,
          margin: '5px 0 0 0',
        }}
      >
        {t.chartMoreBefore}
        <a
          href={DASHBOARD_URL}
          style={{ color: PALETTE.tealDeep, textDecoration: 'underline', fontWeight: 600 }}
        >
          {t.chartMoreLink}
        </a>
        {t.chartMoreAfter}
      </p>
    </div>
  );

  const radarCard =
    radarAxes.length > 0
      ? chartCard(
          <V4ChartBanner
            print
            layout="vertical"
            eyebrow={t.radarEyebrow}
            icon={<Activity size={13} />}
            title={t.radarTitle}
            blurb={t.radarBlurb}
            meta={t.radarMeta(radarAxes.length)}
            chart={<V4PersonalityRadarSVG axes={radarAxes} size={300} lang={lang} />}
          />,
        )
      : null;

  const compareCard =
    compare.length > 0
      ? chartCard(
          <V4ChartBanner
            print
            layout="vertical"
            eyebrow={t.compareEyebrow}
            icon={<Scale size={13} />}
            title={t.compareTitle}
            blurb={t.compareBlurb}
            chart={
              /* variant="full" — the 460-wide viewBox. "compact" exists for the
                 dashboard's hero flip card and is too small for print. */
              <V4CompareRadarSVG careers={compare} focalRank={1} variant="full" maxHeight={300} lang={lang} />
            }
            legend={<V4CompareLegend careers={compare} focalRank={1} />}
          />,
        )
      : null;

  const mapCard =
    mapPoints.length > 0
      ? chartCard(
          <V4ChartBanner
            print
            layout="vertical"
            eyebrow={t.mapEyebrow}
            icon={<MapIcon size={13} />}
            title={t.mapTitle}
            blurb={t.mapBlurb}
            chart={<V4CareerMapSVG points={mapPoints} numbered lang={lang} />}
            legend={<V4CareerMapLegend points={mapPoints} print lang={lang} />}
          />,
        )
      : null;

  // Chapter dividers are emitted inline, ahead of the first section of each
  // chapter, so they paginate with the flow rather than forcing blank sheets.
  const seenChapters = new Set<Chapter>();
  // Intros are per section TYPE; runner-ups and dream jobs arrive as several
  // rows sharing one type, and repeating the intro above each would be noise.
  const seenIntroTypes = new Set<string>();
  const seenGroups = new Set<string>();
  // How many roles each grouped type holds, for the group header's count.
  const groupCounts = ordered.reduce<Record<string, number>>((acc, s) => {
    if (isGroupType(s.section_type)) acc[s.section_type] = (acc[s.section_type] ?? 0) + 1;
    return acc;
  }, {});
  // The map is placed once, ahead of whichever grouped set comes first. A
  // mutable flag rather than state: this is a single synchronous render pass.
  const placedMap = { done: false };

  return (
    <>
      {/* ── Cover ─────────────────────────────────────────────── */}
      <PrintSheet cover>
        <PrintCover
          firstName={firstName}
          lastName={lastName}
          dateLabel={dateLabel}
          partner={partner}
          lang={lang}
          strings={t}
          sample={sample}
        />
      </PrintSheet>

      {/* ── What's inside ─────────────────────────────────────── */}
      <PrintSheet>
        <PrintContents sections={ordered} lang={lang} title={t.contents} />
      </PrintSheet>

      {/* ── Narrative ─────────────────────────────────────────
          Flows naturally; Chromium paginates it. Deliberately NOT chunked
          into fixed sheets: measured against a real 20-section report, fixed
          sheets clipped 7 of 12 pages because single sections exceed a page. */}
      <div className="print-flow print-screen-paper">
        {ordered.map((s, i) => {
          const chapter = chapterFor(s.section_type);
          const opensChapter = !seenChapters.has(chapter);
          if (opensChapter) seenChapters.add(chapter);

          // Grouped types (runner-ups, outside-the-box, dream jobs) arrive as
          // several rows of one type. The FIRST row triggers a group header that
          // owns the type's intro; every row renders as a nested role.
          const grouped = isGroupType(s.section_type);
          const opensGroup = grouped && !seenGroups.has(s.section_type);
          if (opensGroup) seenGroups.add(s.section_type);

          const showIntro = !grouped && !seenIntroTypes.has(s.section_type);
          if (showIntro) seenIntroTypes.add(s.section_type);

          // Both chapters carry their quote on the opener page, alongside the
          // chapter's headline chart.
          const q = chapter === 'about-you' ? aboutQuote : careerQuote;

          // Major sections open a fresh page; the four personality sections do
          // not (see breaksPage). A section that already follows a chapter
          // divider is skipped, otherwise the divider and its pull quote would
          // be stranded alone on a page of their own.
          // Outside-the-box roles run consistently under a page each, so
          // letting them flow leaves every one of them straddling a page break
          // for no reason. One role per page is both neater and, for a set whose
          // whole point is that each idea is unexpected, easier to read as
          // separate ideas. Runner-ups and dream jobs are longer and less
          // uniform, so they keep flowing.
          const perPageRole = grouped && s.section_type === 'outside_box' && !opensGroup;

          const startsPage =
            (!opensChapter && !grouped && i > 0 && breaksPage(s.section_type)) || perPageRole;
          const groupStartsPage = opensGroup && !opensChapter;
          const pageBreak = groupStartsPage
            ? ({ breakBefore: 'page', pageBreakBefore: 'always' } as React.CSSProperties)
            : undefined;

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
                      showShareCta={!partner}
                    />
                  )}
                  {/* The quote and the chart are separate objects and were
                      butting together on the opener page. */}
                  <div style={{ marginTop: '7mm' }}>
                    {chapter === 'about-you' ? radarCard : compareCard}
                  </div>
                </PrintChapterDivider>
              )}

              {/* The career map introduces the wider field, so it sits just
                  ahead of the first grouped set (normally the runner-ups). */}
              {opensGroup && !placedMap.done && ((placedMap.done = true), mapCard)}

              {opensGroup && (
                <div style={pageBreak}>
                  <PrintGroupHeader
                    sectionType={s.section_type}
                    lang={lang}
                    count={groupCounts[s.section_type] ?? 1}
                  />
                </div>
              )}

              <PrintSection
                section={s}
                lang={lang}
                first={i === 0 || opensChapter || opensGroup}
                level={grouped ? 'nested' : 'top'}
                showIntro={showIntro}
                breakBefore={startsPage}
              />

            </React.Fragment>
          );
        })}

        {/* Sign-off and the toolkit CTAs. Generated from UNLOCK_LADDER so the
            printed promise cannot drift from the live one. */}
        <PrintClosing lang={lang} partnerName={partner?.name ?? null} />
      </div>
    </>
  );
};
