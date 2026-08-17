import React from 'react';
import { PALETTE, FONT_DISPLAY, FONT_BODY, SECTION_VISUALS } from '@/components/dashboard/v2/dashboardV2Shared';
import { iconForSection, groupTitleFor, anchorFor } from './printSectionMeta';
import { introFor, type PrintLang } from './printIntros';

// Header for a multi-row group: runner-ups, outside-the-box, dream jobs.
//
// Those three arrive as SEVERAL rows sharing one section_type, one row per
// role. Without this, the group's intro ("Close alternatives to your top
// three…") rendered inside the first role's section, directly under that role's
// title, reading as though it described that one job rather than the set.
//
// The group owns the intro and the h2; the roles beneath it drop to h3 (see
// PrintSection's `level` prop) so the outline stays honest about what contains
// what.

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
      style={{
        margin: '4mm 0 7mm 0',
        padding: '6mm 7mm',
        background: PALETTE.creamLight,
        border: '1px solid rgba(201, 182, 144, 0.55)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 8,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: PALETTE.gold,
          }}
        >
          {Icon && <Icon size={13} aria-hidden="true" />}
          {lang === 'nl' ? 'Loopbaansuggesties' : 'Career suggestions'}
        </span>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 9,
            fontWeight: 700,
            color: PALETTE.inkSoft,
            letterSpacing: '0.04em',
          }}
        >
          {countLabel}
        </span>
      </div>

      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 23,
          lineHeight: 1.15,
          letterSpacing: '-0.025em',
          color: PALETTE.canvasDeep,
          margin: 0,
        }}
      >
        {title}
      </h2>

      {intro && (
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            lineHeight: 1.55,
            color: PALETTE.inkMuted,
            margin: '7px 0 0 0',
            maxWidth: '150mm',
          }}
        >
          {intro}
        </p>
      )}
    </div>
  );
};

/** Square photo chip, the print counterpart of the dashboard's section
 *  visuals. Same asset, same tint, sized for a printed section header.
 *
 *  `loading="eager"` and `decoding="sync"` matter here: the readiness gate
 *  awaits img.decode() on every image, and a lazily-loaded image that is not in
 *  the viewport never starts loading, so it would hang that wait. */
export const PrintSectionPhoto: React.FC<{ visualKey: string; size?: number }> = ({
  visualKey,
  size = 44,
}) => {
  const v = SECTION_VISUALS[visualKey];
  if (!v) return null;
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
