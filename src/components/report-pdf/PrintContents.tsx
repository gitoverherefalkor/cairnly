import React from 'react';
import type { ReportSection } from '@/hooks/useReportSections';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from '@/components/dashboard/v2/dashboardV2Shared';
import { iconForSection, anchorFor } from './printSectionMeta';
import type { PrintLang } from './printIntros';

// "What's inside" — the printed equivalent of the chat's report sidebar.
//
// Structure, grouping and row labels mirror ALL_SECTIONS in
// components/chat/ReportSidebar.tsx, including its habit of collapsing the
// multi-row sections into one row with a count ("2 alternatives") rather than
// listing every runner-up separately. Exec summary IS listed here, unlike the
// sidebar, which hides it via HIDDEN_SECTION_IDS because it does not exist yet
// while the chat is running. By the time a PDF is rendered it does.
//
// The labels are duplicated rather than imported for two reasons. Importing
// ALL_SECTIONS drags react-i18next, createPortal and the Button component into
// the print bundle. More importantly the sidebar translates its titles through
// the APP's i18n locale, and the printed report follows the language the
// SECTIONS were written in — a Dutch-speaking user reading an English report
// must get an English contents page. Those two are not the same signal.
//
// No page numbers: Chromium paginates the flow itself and gives the DOM no way
// to learn which page a node landed on, so a page number here would be a lie.

interface Row {
  /** Section types this row stands for, in priority order. */
  types: string[];
  label: string;
  /** Rows that count their occurrences instead of naming one. */
  countLabel?: (n: number) => string;
  /** Top-3 rows carry a rank badge instead of an icon. */
  rank?: number;
}

const ROWS: Record<PrintLang, { group: string; rows: Row[] }[]> = {
  en: [
    {
      group: 'About you',
      rows: [
        { types: ['exec_summary'], label: 'Executive Summary' },
        { types: ['approach', 'personality_team'], label: 'Your Approach' },
        { types: ['strengths'], label: 'Your Strengths' },
        { types: ['development'], label: 'Development Areas' },
        { types: ['values'], label: 'Career Values' },
      ],
    },
    {
      group: 'Career suggestions for you',
      rows: [
        { types: ['top_career_1'], label: 'Primary Career Match', rank: 1 },
        { types: ['top_career_2'], label: 'Second Career Match', rank: 2 },
        { types: ['top_career_3'], label: 'Third Career Match', rank: 3 },
        {
          types: ['runner_ups'],
          label: 'Runner-up Careers',
          countLabel: (n) => `${n} alternative${n === 1 ? '' : 's'}`,
        },
        {
          types: ['outside_box'],
          label: 'Outside the Box',
          countLabel: (n) => `${n} unconventional path${n === 1 ? '' : 's'}`,
        },
        {
          types: ['dream_jobs'],
          label: 'Dream Job Assessment',
          countLabel: (n) => `${n} dream job${n === 1 ? '' : 's'}`,
        },
      ],
    },
  ],
  nl: [
    {
      group: 'Over jou',
      rows: [
        { types: ['exec_summary'], label: 'Samenvatting' },
        { types: ['approach', 'personality_team'], label: 'Jouw aanpak' },
        { types: ['strengths'], label: 'Jouw sterke punten' },
        { types: ['development'], label: 'Ontwikkelpunten' },
        { types: ['values'], label: 'Jouw loopbaanwaarden' },
      ],
    },
    {
      group: 'Loopbaansuggesties voor jou',
      rows: [
        { types: ['top_career_1'], label: 'Beste match', rank: 1 },
        { types: ['top_career_2'], label: 'Tweede match', rank: 2 },
        { types: ['top_career_3'], label: 'Derde match', rank: 3 },
        {
          types: ['runner_ups'],
          label: 'Runner-up loopbanen',
          countLabel: (n) => `${n} alternatie${n === 1 ? 'f' : 'ven'}`,
        },
        {
          types: ['outside_box'],
          label: 'Outside the box',
          countLabel: (n) => `${n} onconventione${n === 1 ? 'el pad' : 'le paden'}`,
        },
        {
          types: ['dream_jobs'],
          label: 'Droombaan-analyse',
          countLabel: (n) => `${n} droombaan${n === 1 ? '' : 'en'}`,
        },
      ],
    },
  ],
};

/** Strip tags AND stray markdown bold. WF4 writes `company_size_type` as a
 *  fragment of markup ("<h4><strong>Small (11-50) / Boutique</strong></h4>"),
 *  so a plain render prints the tags. Mirrors `cleanField` in ReportSidebar,
 *  which exists for this exact field. */
function cleanField(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
}

const RANK_COLOR: Record<number, string> = { 1: '#d97706', 2: '#6366f1', 3: '#0d9488' };

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => (
  <span
    style={{
      width: 15,
      height: 15,
      borderRadius: 999,
      background: RANK_COLOR[rank],
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 9,
      flexShrink: 0,
    }}
  >
    {rank}
  </span>
);

export const PrintContents: React.FC<{
  sections: ReportSection[];
  lang: PrintLang;
  title: string;
}> = ({ sections, lang, title }) => {
  const groups = ROWS[lang];

  return (
    <div>
      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 21,
          letterSpacing: '-0.02em',
          color: PALETTE.canvasDeep,
          margin: '0 0 8mm 0',
        }}
      >
        {title}
      </h2>

      {groups.map(({ group, rows }) => {
        // Only render a group that has something in it — a report missing its
        // exec summary should not print an empty heading.
        const present = rows
          .map((r) => {
            const matches = sections.filter((s) => r.types.includes(s.section_type));
            if (matches.length === 0) return null;
            return { row: r, matches };
          })
          .filter(Boolean) as { row: Row; matches: ReportSection[] }[];
        if (present.length === 0) return null;

        return (
          <div key={group} className="print-nobreak" style={{ marginBottom: '7mm' }}>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 7.5,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: PALETTE.gold,
                paddingBottom: 5,
                borderBottom: `1px solid ${PALETTE.cream}`,
                marginBottom: 4,
              }}
            >
              {group}
            </div>

            {present.map(({ row, matches }) => {
              const Icon = iconForSection(row.types[0]);
              // Named rows show the real role title from the report; counted
              // rows show how many there are, as the sidebar does.
              const detail = row.countLabel
                ? row.countLabel(matches.length)
                : row.rank
                  ? cleanField(matches[0].title)
                  : null;
              const size = row.rank ? cleanField(matches[0].company_size_type) : null;

              return (
                // An <a> with a same-document href becomes a real internal PDF
                // link: Chromium turns it into a GoTo annotation pointing at the
                // element with that id. Section ids come from anchorFor(), which
                // PrintSection and PrintGroupHeader use to stamp them, so the
                // two sides cannot drift.
                <a
                  key={row.label}
                  href={`#${anchorFor(row.types[0])}`}
                  className="print-contents-link"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    padding: '5px 0',
                    borderBottom: `1px solid rgba(236, 228, 210, 0.6)`,
                  }}
                >
                  {/* marginTop optically centres the glyph against the label's cap-height.
                      flex-start keeps it put when the detail line wraps, but at
                      marginTop 1 the icons sat visibly high. */}
                  <span style={{ flex: '0 0 auto', marginTop: 3, color: PALETTE.tealDeep, display: 'inline-flex' }}>
                    {row.rank ? <RankBadge rank={row.rank} /> : Icon ? <Icon size={14} /> : null}
                  </span>
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: FONT_DISPLAY,
                        fontWeight: 700,
                        fontSize: 11.5,
                        color: PALETTE.canvasDeep,
                      }}
                    >
                      {row.label}
                    </span>
                    {detail && (
                      <span
                        style={{
                          display: 'block',
                          fontFamily: FONT_BODY,
                          fontSize: 10,
                          lineHeight: 1.4,
                          color: PALETTE.inkMuted,
                          marginTop: 1,
                        }}
                      >
                        {detail}
                        {size ? ` · ${size}` : ''}
                      </span>
                    )}
                  </span>
                </a>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
