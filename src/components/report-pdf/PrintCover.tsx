import React from 'react';
import type { PartnerBrand } from './ReportPrintDocument';

// Cover, ported from the design hand-off ("Cairnly Report Cover (standalone)").
//
// Structure, top to bottom:
//   • a 32mm WHITE band carrying the partner logo (left) and the Cairnly
//     wordmark (right) — the wordmark is the dark one, since the band is white;
//   • a deep field with the locale line, the gold title and a subtitle;
//   • a 134mm photo band, with the outlined cairn glyph registered over the real
//     cairn in the photograph, the "cairn" dictionary panel top-right, and long
//     gradient fades into the canvas at both edges so the photo has no hard
//     seam;
//   • a footer with who the report is for and the date.
//
// ── Why images are safe here now ────────────────────────────────────────────
// This cover uses three raster assets, which an earlier version of this file
// deliberately avoided: readiness gated only on document.fonts.ready, so an
// image that had not finished decoding silently missed the snapshot and left a
// hole in an otherwise successful PDF. ReportPrint now awaits img.decode() on
// every image, which closes that hole. Anything added here must keep
// `loading="eager"` — a lazily-loaded image outside the viewport never starts
// loading, so it would hang that wait and time out the render.
//
// Two of the three assets already existed in the repo byte-for-byte (the
// wordmark and the photograph), so only the outlined glyph was added.
// Print-sized copy. The original is 3548x1774 at 753KB and draws here at 25mm
// tall, so it was embedding roughly 12x the pixels it could show; 1200px wide is
// still ~4x the drawn size at 300dpi. Saves ~620KB per PDF.
const WORDMARK_DARK = '/report/wordmark.png';
const CAIRN_GLYPH = '/logos/cairn_glyph_outline.png';
const HORIZON_PHOTO = '/dashboard/cairn_trail_landscape.jpg';

const NAVY = '#122E3B';

export interface CoverStrings {
  /** Small tracked line above the title, e.g. "Career direction report". */
  coverKicker: string;
  title: (name: string) => string;
  coverSubtitle: string;
  preparedFor: (name: string) => string;
}

export const PrintCover: React.FC<{
  firstName: string;
  lastName?: string | null;
  dateLabel: string;
  partner?: PartnerBrand | null;
  lang: 'en' | 'nl';
  strings: CoverStrings;
}> = ({ firstName, lastName, dateLabel, partner, lang, strings }) => {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || firstName;

  return (
    <div style={{ position: 'absolute', inset: 0, background: NAVY, overflow: 'hidden' }}>
      {/* ── White band: partner left, Cairnly right ───────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '32mm',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16mm',
        }}
      >
        {/* The hand-off drew a dashed "Partner logo" placeholder here. That is a
            mockup device, not output: an unbranded report shows nothing. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7mm' }}>
          {partner?.logo_data_uri && (
            <img
              src={partner.logo_data_uri}
              alt={partner.name}
              loading="eager"
              decoding="sync"
              style={{ maxHeight: '10mm', maxWidth: '61mm', width: 'auto', display: 'block' }}
            />
          )}
        </div>
        <img
          src={WORDMARK_DARK}
          alt="Cairnly"
          loading="eager"
          decoding="sync"
          style={{ height: '25mm', width: 'auto', display: 'block' }}
        />
      </div>

      {/* ── Deep field: locale, title, subtitle ───────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '32mm',
          left: 0,
          right: 0,
          height: '80mm',
          padding: '14mm 16mm 0',
        }}
      >
        <p
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '9pt',
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#C9B690',
            margin: '0 0 8mm 0',
          }}
        >
          {strings.coverKicker}&nbsp; /&nbsp; {lang.toUpperCase()}
        </p>
        <h1
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            fontSize: 46,
            lineHeight: 1.14,
            letterSpacing: '-0.01em',
            color: '#EFBE48',
            margin: 0,
            maxWidth: '140mm',
          }}
        >
          {strings.title(firstName)}
        </h1>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '12.5pt',
            fontWeight: 400,
            lineHeight: 1.45,
            color: '#9FB6BF',
            margin: '6mm 0 0 0',
            maxWidth: '118mm',
          }}
        >
          {strings.coverSubtitle}
        </p>
      </div>

      {/* ── Photo band ────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '112mm',
          left: 0,
          right: 0,
          height: '134mm',
          overflow: 'hidden',
          background: '#0E242E',
        }}
      >
        <img
          src={HORIZON_PHOTO}
          alt=""
          loading="eager"
          decoding="sync"
          style={{
            position: 'absolute',
            left: '-4.6mm',
            top: '-3.5mm',
            width: '262mm',
            // maxWidth:none is load-bearing. Tailwind preflight sets
            // `img { max-width: 100% }`, which silently clamped this to the
            // 210mm page width, dropped the photo to 117mm tall inside a 134mm
            // band and left a strip of bare backdrop under it. Same class of bug
            // as preflight zeroing the narrative's margins.
            maxWidth: 'none',
            height: 'auto',
            display: 'block',
          }}
        />
        {/* Outlined glyph, registered over the real cairn in the photograph. */}
        <img
          src={CAIRN_GLYPH}
          alt=""
          loading="eager"
          decoding="sync"
          style={{
            position: 'absolute',
            left: '22.3mm',
            bottom: '4.9mm',
            height: '106mm',
            width: 'auto',
            maxWidth: 'none',
            display: 'block',
            opacity: 0.9,
          }}
        />

        {/* Dictionary panel — the same treatment as the social share card.
            Deliberately English in both locales: it explains the brand name,
            and the headword and pronunciation are English to begin with. */}
        <div
          style={{
            position: 'absolute',
            top: '13mm',
            right: '11mm',
            width: '104mm',
            background: 'rgba(18,46,59,0.88)',
            border: '1px solid rgba(201,182,144,0.28)',
            borderRadius: 5,
            padding: '7mm 8mm 8mm',
          }}
        >
          <span
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '16pt',
              fontWeight: 700,
              fontStyle: 'italic',
              color: '#D4A024',
              letterSpacing: '0.01em',
            }}
          >
            cairn
          </span>
          <span
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '13pt',
              fontWeight: 400,
              fontStyle: 'italic',
              color: '#F5EFE2',
              marginLeft: '4mm',
              letterSpacing: '0.01em',
            }}
          >
            /keərn/ noun
          </span>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '12.5pt',
              fontStyle: 'italic',
              lineHeight: 1.34,
              color: '#FFFFFF',
              margin: '4.5mm 0 0 0',
            }}
          >
            a mound of rough stones used to mark a trail, route, or summit, guiding travelers by
            showing the way forward, especially where the path isn&rsquo;t otherwise clear.
          </p>
        </div>

        {/* Long fades so the photograph dissolves into the canvas rather than
            butting against it. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: '24mm',
            background:
              'linear-gradient(#122E3B 0%, rgba(18,46,59,0.88) 22%, rgba(18,46,59,0.6) 48%, rgba(18,46,59,0.26) 72%, rgba(18,46,59,0) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '22mm',
            background:
              'linear-gradient(rgba(18,46,59,0) 0%, rgba(18,46,59,0.22) 30%, rgba(18,46,59,0.58) 56%, rgba(18,46,59,0.86) 80%, #122E3B 100%)',
          }}
        />
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: '16mm',
          right: '16mm',
          bottom: '26mm',
          paddingTop: '5mm',
          borderTop: '1px solid rgba(201,182,144,0.32)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <span style={{ fontSize: '9.5pt', letterSpacing: '0.06em', color: '#9FB6BF' }}>
          {strings.preparedFor(fullName)}
        </span>
        <span style={{ fontSize: '9.5pt', letterSpacing: '0.06em', color: '#C9B690' }}>
          {dateLabel}
        </span>
      </div>
    </div>
  );
};
