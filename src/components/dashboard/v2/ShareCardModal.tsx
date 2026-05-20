// Share Card B — the 1200×627 LinkedIn-ready export artifact (handoff prototype:
// share-cards.jsx, ShareCardB). The card is rendered at natural size off-screen
// and exported to PNG with html-to-image. The modal shows a scaled preview and
// lets the user pick which report quote appears on the card.

import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Loader2, X } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  CairnGlyph,
  CAIRN_TRAIL_URL,
  LOGO_WORDMARK_URL,
} from './dashboardV2Shared';

const CARD_W = 1200;
const CARD_H = 627;
const PREVIEW_W = 680;
const SCALE = PREVIEW_W / CARD_W;

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  firstName: string;
  heroTitle: string;
  heroShape: string | null;
  heroMatchPct: number;
  quotes: string[];
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  open,
  onClose,
  firstName,
  heroTitle,
  heroShape,
  heroMatchPct,
  quotes,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  // Body scroll lock + Escape to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const quote = quotes[quoteIndex] || quotes[0] || '';

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        width: CARD_W,
        height: CARD_H,
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `cairnly-career-card-${(firstName || 'me').toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Share card export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(8, 22, 29, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: PALETTE.cream,
          borderRadius: 24,
          border: `1px solid ${PALETTE.tan}`,
          padding: 28,
          maxWidth: PREVIEW_W + 56,
          width: '100%',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: PALETTE.tealDeep,
              }}
            >
              SHARE · LINKEDIN-READY
            </div>
            <h3 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: PALETTE.canvasDeep, margin: '6px 0 0 0' }}>
              Your career card
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: `1px solid ${PALETTE.tan}`,
              borderRadius: 9999,
              padding: 8,
              cursor: 'pointer',
              color: PALETTE.inkMuted,
              display: 'inline-flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scaled preview viewport. The card itself renders at natural size; the
            viewport clips the CSS-scaled copy. cardRef targets the natural-size
            node so the PNG export is full 1200×627. */}
        <div
          style={{
            width: PREVIEW_W,
            height: CARD_H * SCALE,
            maxWidth: '100%',
            overflow: 'hidden',
            borderRadius: 14,
            boxShadow: '0 18px 40px -16px rgba(0,0,0,0.4)',
            margin: '0 auto',
          }}
        >
          <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
            <div ref={cardRef}>
              <ShareCardB
                firstName={firstName}
                quote={quote}
                heroTitle={heroTitle}
                heroShape={heroShape}
                heroMatchPct={heroMatchPct}
              />
            </div>
          </div>
        </div>

        {/* Quote picker */}
        {quotes.length > 1 && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: PALETTE.inkSoft,
                marginBottom: 8,
              }}
            >
              Choose the line
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quotes.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuoteIndex(i)}
                  style={{
                    textAlign: 'left',
                    background: i === quoteIndex ? 'rgba(39,161,161,0.12)' : '#fff',
                    border: `1px solid ${i === quoteIndex ? PALETTE.teal : PALETTE.tan}`,
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    fontWeight: 500,
                    color: PALETTE.ink,
                    cursor: 'pointer',
                    lineHeight: 1.45,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              color: PALETTE.tealDeep,
              border: `1px solid ${PALETTE.tan}`,
              padding: '12px 20px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={exporting}
            style={{
              background: PALETTE.teal,
              color: '#fff',
              border: 'none',
              padding: '12px 22px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 13.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: exporting ? 'wait' : 'pointer',
              opacity: exporting ? 0.7 : 1,
              boxShadow: '0 10px 22px -8px rgba(39,161,161,0.5)',
            }}
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {exporting ? 'Exporting…' : 'Download PNG'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Share Card B (1200×627) ───────────────────────────────────
const ShareCardB: React.FC<{
  firstName: string;
  quote: string;
  heroTitle: string;
  heroShape: string | null;
  heroMatchPct: number;
}> = ({ firstName, quote, heroTitle, heroShape, heroMatchPct }) => (
  <div
    style={{
      width: CARD_W,
      height: CARD_H,
      position: 'relative',
      background: PALETTE.cream,
      overflow: 'hidden',
      fontFamily: FONT_BODY,
      display: 'grid',
      gridTemplateColumns: '1.35fr 1fr',
    }}
  >
    {/* LEFT — cream paper, the honest quote */}
    <div style={{ padding: 72, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
      <div>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: PALETTE.tealDeep,
          }}
        >
          FROM MY REPORT
        </span>
        <div style={{ marginTop: 28, position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              left: -22,
              top: -12,
              fontFamily: FONT_DISPLAY,
              fontSize: 96,
              fontWeight: 700,
              color: PALETTE.gold,
              lineHeight: 1,
              opacity: 0.5,
            }}
          >
            &ldquo;
          </div>
          <p
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              color: PALETTE.canvasDeep,
              margin: 0,
            }}
          >
            {quote || 'A clear, honest read on where you do your best work.'}
          </p>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: PALETTE.inkMuted, marginTop: 18 }}>
            Cairnly, on what {firstName || 'I'} bring{firstName ? 's' : ''}.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 32 }}>
        <img src={LOGO_WORDMARK_URL} alt="Cairnly" style={{ height: 52, width: 'auto' }} crossOrigin="anonymous" />
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: PALETTE.inkMuted, textAlign: 'right' }}>
          One-shot career clarity · <span style={{ color: PALETTE.tealDeep, fontWeight: 700 }}>cairnly.io</span>
        </div>
      </div>
    </div>

    {/* RIGHT — dark photo panel with the match callout */}
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${CAIRN_TRAIL_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(0.88)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(18,46,59,0.55) 0%, rgba(18,46,59,0.92) 80%, ${PALETTE.canvasDeep} 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: 56,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#fff',
        }}
      >
        <div>
          <CairnGlyph kind="capstone" size={64} color="rgba(236,228,210,0.95)" accent={PALETTE.goldBright} />
        </div>
        <div>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.26em',
              textTransform: 'uppercase',
              color: PALETTE.goldBright,
            }}
          >
            BEST-FIT CAREER
          </span>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 38,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              margin: '12px 0 14px 0',
              color: '#fff',
            }}
          >
            {heroTitle}
          </h2>
          {heroShape && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
                fontFamily: FONT_BODY,
                fontSize: 14,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.75)',
              }}
            >
              <span>{heroShape}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.14)', borderRadius: 9999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${heroMatchPct}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${PALETTE.teal} 0%, ${PALETTE.goldBright} 100%)`,
                  boxShadow: '0 0 14px rgba(212,160,36,0.45)',
                }}
              />
            </div>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: PALETTE.goldBright }}>
              {heroMatchPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
