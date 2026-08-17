import React from 'react';
import { PALETTE, FONT_DISPLAY, FONT_BODY, SECTION_VISUALS } from '@/components/dashboard/v2/dashboardV2Shared';
import { CareerSlotIcon } from '@/components/dashboard/CareerSlotIcon';
import { iconForSection, groupTitleFor, anchorFor, careerSlotFor } from './printSectionMeta';
import { introFor, type PrintLang } from './printIntros';

// Header for a multi-row group: runner-ups, outside-the-box, dream jobs.
//
// Those three arrive as SEVERAL rows sharing one section_type, one row per
// role. Without this, the group's intro ("Close alternatives to your top
// three…") rendered inside the first role's section, directly under that role's
// title, reading as though it described that one job rather than the set.
//
// It is deliberately NOT a filled banner any more. The first version put the
// group in a cream box, which shouted louder than the roles it introduced and
// competed with the pull quote and the chapter divider, both of which are
// already filled blocks. It now uses exactly the same furniture as any other
// section header — eyebrow, chip, explanation — so a group reads as a peer of
// the personality sections rather than a third kind of banner.

/** Square chip in the section-header slot. Two flavours, matching the
 *  dashboard: a photograph for the About-You sections, and one of the six
 *  "wayfinder" glyphs for career sections. */
export const PrintChip: React.FC<{
  visualKey?: string | null;
  sectionType?: string | null;
  size?: number;
}> = ({ visualKey, sectionType, size = 44 }) => {
  const slot = sectionType ? careerSlotFor(sectionType) : null;
  const v = visualKey ? SECTION_VISUALS[visualKey] : null;

  // Career glyph on a cream chip — the dashboard's own treatment for career
  // rows, which have no photograph. Inline SVG, so no loading risk.
  if (!v && slot) {
    return (
      <span
        style={{
          flex: '0 0 auto',
          width: size,
          height: size,
          borderRadius: 8,
          background: PALETTE.cream,
          border: `1px solid ${PALETTE.tan}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CareerSlotIcon slot={slot} size={Math.round(size * 0.62)} />
      </span>
    );
  }

  if (!v) return null;

  // `loading="eager"` and `decoding="sync"` matter here: the readiness gate
  // awaits img.decode() on every image, and a lazily-loaded image that is not in
  // the viewport never starts loading, so it would hang that wait.
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 8,
        overflow: 'hidden',
        flex: '0 0 auto',
        border: '1px solid rgba(201, 182, 144, 0.6)',
      }}
    >
      <img
        src={v.src}
        alt=""
        loading="eager"
        decoding="sync"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: v.position,
          display: 'block',
        }}
      />
      <span style={{ position: 'absolute', inset: 0, background: v.hue }} />
    </span>
  );
};

/** Back-compat alias — PrintSection imported this name first. */
export const PrintSectionPhoto: React.FC<{ visualKey: string; size?: number }> = ({
  visualKey,
  size,
}) => <PrintChip visualKey={visualKey} size={size} />;

export const PrintGroupHeader: React.FC<{
  sectionType: string;
  lang: PrintLang;
  count: number;
}> = ({ sectionType, lang, count }) => {
  const title = groupTitleFor(sectionType, lang);
  const intro = introFor(sectionType, lang);
  const Icon = iconForSection(sectionType);
  const countLabel =
    lang === 'nl'
      ? `${count} ${count === 1 ? 'rol' : 'rollen'}`
      : `${count} ${count === 1 ? 'role' : 'roles'}`;

  return (
    <div
      id={anchorFor(sectionType)}
      className="print-nobreak print-section-head"
      style={{ margin: '0 0 7mm 0' }}
    >
      {/* The group's name is an h2 so it still owns its roles in the document
          outline and the contents link has something real to point at, but it is
          STYLED as an eyebrow. A full-size heading here competed with the role
          titles it introduces, which are the thing the reader is looking for. */}
      <h2
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 8,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: PALETTE.gold,
          margin: '0 0 7px 0',
        }}
      >
        {Icon && <Icon size={13} aria-hidden="true" />}
        {title}
        <span style={{ color: PALETTE.inkSoft, letterSpacing: '0.06em' }}>· {countLabel}</span>
      </h2>

      {intro && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <PrintChip sectionType={sectionType} />
          <p
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              fontFamily: FONT_BODY,
              fontSize: 12,
              lineHeight: 1.55,
              color: PALETTE.inkMuted,
              margin: 0,
              paddingLeft: 10,
              borderLeft: `2px solid ${PALETTE.tan}`,
              maxWidth: '150mm',
            }}
          >
            {intro}
          </p>
        </div>
      )}
    </div>
  );
};
