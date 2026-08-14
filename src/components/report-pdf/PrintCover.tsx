import React from 'react';
import { PALETTE, FONT_DISPLAY, FONT_BODY, LOGO_INVERTED_URL } from '@/components/dashboard/v2/dashboardV2Shared';
import type { PartnerBrand } from './ReportPrintDocument';

// The cover art is DRAWN, not photographed.
//
// A photographic cover would look richer, but images are the one asset class
// that fails silently in this pipeline: the deployed CSP restricts img-src, and
// a blocked image yields a hole in the page and a 200 OK from the renderer.
// The readiness gate waits on document.fonts.ready, not on image decode, so a
// slow image can also simply miss the snapshot. An inline SVG has neither
// failure mode — it is part of the DOM, it is painted with the first frame, and
// it cannot be blocked.
//
// A cairn is also the literal brand mark, so this is on-theme rather than
// decorative filler.

/** Stacked-stone cairn silhouette.
 *
 *  Each stone's centre is placed exactly one radius below the one above, so the
 *  stones TOUCH. Spaced apart they stop reading as a stack and turn into a
 *  column of floating discs, which is what the first attempt looked like. Only
 *  the capstone is gold; the rest sit close to the background value so the mark
 *  behaves as texture behind the title rather than competing with it. */
const STONES = [
  // cy, rx, ry, fill, opacity — bottom to top, centres computed to touch.
  { cy: 228, rx: 70, ry: 17, fill: '#1B3B4A', o: 1 },
  { cy: 196, rx: 56, ry: 15, fill: '#204657', o: 1 },
  { cy: 168, rx: 45, ry: 13, fill: '#1B3B4A', o: 1 },
  { cy: 143.5, rx: 36, ry: 11.5, fill: '#255463', o: 1 },
  { cy: 122.5, rx: 28, ry: 9.5, fill: '#1B3B4A', o: 1 },
  { cy: 105, rx: 20, ry: 8, fill: PALETTE.tan, o: 0.5 },
  { cy: 90.5, rx: 13, ry: 6.5, fill: PALETTE.goldBright, o: 0.85 },
] as const;

const CairnMark: React.FC<{ width: number; opacity?: number }> = ({ width, opacity = 1 }) => (
  <svg
    width={width}
    height={width * 1.24}
    viewBox="0 0 200 248"
    fill="none"
    aria-hidden="true"
    style={{ opacity }}
  >
    {STONES.map((s, i) => (
      <ellipse key={i} cx={100} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill} fillOpacity={s.o} />
    ))}
  </svg>
);

/** Contour lines, as on a topographic map. Pure geometry, no assets.
 *
 *  They run the full height rather than banding along the bottom: the first
 *  pass left the top third of the cover completely empty, and texture fills it
 *  without adding words nobody asked for. Opacity tapers upward so the density
 *  sits under the title block, not around the logo. */
const ContourField: React.FC = () => (
  <svg
    viewBox="0 0 600 400"
    preserveAspectRatio="none"
    aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
  >
    {Array.from({ length: 11 }, (_, i) => {
      const y = 62 + i * 26;
      // Fade in from the top edge, then taper again toward the foot.
      const near = Math.min(i / 3.2, 1);
      return (
        <path
          key={i}
          d={`M -50 ${y + 46} Q 150 ${y - 22} 320 ${y + 14} T 650 ${y - 26}`}
          fill="none"
          stroke={PALETTE.tan}
          strokeWidth="1"
          opacity={0.035 + near * 0.075}
        />
      );
    })}
  </svg>
);

export const PrintCover: React.FC<{
  firstName: string;
  dateLabel: string;
  partner?: PartnerBrand | null;
  poweredBy: string;
  strings: { eyebrow: string; title: (name: string) => string; preparedFor: string };
}> = ({ firstName, dateLabel, partner, poweredBy, strings }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      // A flat fill read as "unfinished" at A4; the gradient gives the page
      // depth without adding an asset.
      background: `linear-gradient(160deg, ${PALETTE.canvas} 0%, ${PALETTE.canvasDeep} 58%, #0C2029 100%)`,
      color: '#fff',
      overflow: 'hidden',
    }}
  >
    <ContourField />

    {/* Bottom-right, fully in frame and clear of the footer rule. Bleeding it
        off the edge cut the stones mid-shape; sitting it at the footer let the
        rule draw a line straight through the stack. */}
    <div style={{ position: 'absolute', right: '20mm', bottom: '44mm' }}>
      <CairnMark width={150} opacity={0.95} />
    </div>

    {/* Foreground content. Three bands, but unlike the previous
        space-between layout the middle band now carries the title, so the
        page has a focal point instead of a void. */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '26mm 22mm',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src={LOGO_INVERTED_URL} alt="Cairnly" crossOrigin="anonymous" style={{ height: 50, width: 'auto' }} />
        {partner?.logo_data_uri && (
          <>
            <div style={{ width: 1, height: 34, background: 'rgba(255,255,255,0.28)' }} />
            {/* Inlined as a data: URI by report-print-data. A storage URL here
                would be silently blocked by the deployed CSP's img-src,
                producing a PDF with a hole and no error. */}
            <img
              src={partner.logo_data_uri}
              alt={partner.name}
              style={{ height: 38, width: 'auto', maxWidth: 230, objectFit: 'contain' }}
            />
          </>
        )}
        {/* Date sits at the top so the footer carries one idea, not three. */}
        <div
          style={{
            marginLeft: 'auto',
            fontFamily: FONT_BODY,
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {dateLabel}
        </div>
      </div>

      {/* Title block, optically centred: pushed to ~46% of the page height,
          which reads as centred to the eye better than true centring does. */}
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: '18mm' }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: PALETTE.goldBright,
          }}
        >
          {strings.eyebrow}
        </div>
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 46,
            lineHeight: 1.03,
            letterSpacing: '-0.035em',
            margin: '12px 0 0 0',
            maxWidth: '132mm',
          }}
        >
          {strings.title(firstName)}
        </h1>
        <div
          style={{
            width: 52,
            height: 3,
            background: PALETTE.goldBright,
            borderRadius: 2,
            margin: '18px 0 16px 0',
          }}
        />
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.72)',
            maxWidth: '110mm',
          }}
        >
          {strings.preparedFor}
        </div>
      </div>

      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 9.5,
          letterSpacing: '0.04em',
          color: 'rgba(255,255,255,0.55)',
          borderTop: '1px solid rgba(255,255,255,0.14)',
          paddingTop: 10,
        }}
      >
        {partner ? `${poweredBy}  ·  cairnly.io` : 'cairnly.io'}
      </div>
    </div>
  </div>
);
