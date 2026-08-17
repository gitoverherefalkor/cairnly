import React from 'react';
import { PALETTE, FONT_DISPLAY, FONT_BODY } from '@/components/dashboard/v2/dashboardV2Shared';
import { CHAPTERS, type Chapter, type PrintLang } from './printIntros';

// Chapter opener. The chat announces the same split inline ("## CHAPTER 2:
// CAREER RECOMMENDATIONS", embedded in top_career_1's intro); on paper it gets
// a divider instead, which is also where the chapter's pull quote lands.
//
// Deliberately NOT a full-page sheet: two blank-ish pages in an 18-page report
// is a lot of paper for two words. It is a banded block that sits in the flow
// and is kept whole by print-nobreak.

export const PrintChapterDivider: React.FC<{
  chapter: Chapter;
  lang: PrintLang;
  children?: React.ReactNode;
}> = ({ chapter, lang, children }) => {
  const c = CHAPTERS[lang][chapter];
  return (
    <div
      className="print-nobreak"
      style={{
        // Chapter two never opens a page cold — break before it so the divider
        // heads a page rather than landing under the tail of a career section.
        breakBefore: chapter === 'careers' ? 'page' : 'auto',
        pageBreakBefore: chapter === 'careers' ? 'always' : 'auto',
        margin: chapter === 'careers' ? '0 0 9mm 0' : '0 0 9mm 0',
      }}
    >
      <div
        style={{
          background: `linear-gradient(150deg, ${PALETTE.canvas} 0%, ${PALETTE.canvasDeep} 100%)`,
          borderRadius: 12,
          padding: '9mm 9mm 8mm',
          color: '#fff',
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: PALETTE.goldBright,
          }}
        >
          {c.kicker}
        </div>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 27,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            margin: '6px 0 0 0',
            color: '#fff',
          }}
        >
          {c.title}
        </h2>
        <div
          style={{
            width: 40,
            height: 2.5,
            background: PALETTE.goldBright,
            borderRadius: 2,
            margin: '12px 0 11px 0',
          }}
        />
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 10.5,
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.78)',
            margin: 0,
            maxWidth: '138mm',
          }}
        >
          {c.blurb}
        </p>
      </div>
      {children}
    </div>
  );
};
