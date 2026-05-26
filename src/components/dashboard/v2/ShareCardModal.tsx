// Share Card — the 1200×627 LinkedIn-ready export artifact. The card is
// rendered at natural size off-screen and exported to PNG with html-to-image.
// The modal shows a scaled preview and lets the user pick between two share
// types (Personality / Best-fit role), which section or career to feature,
// and which quote line goes on the card.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Download, Loader2, X } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LOGO_WORDMARK_URL,
} from './dashboardV2Shared';
import CairnSymbolInvert from '@/logos/cairnly-logo/cairn_symbol_invert.png';
import CairnImageHero from '@/logos/Cairn_image_hero.png';

const CARD_W = 1200;
const CARD_H = 627;
const PREVIEW_W = 680;
const SCALE = PREVIEW_W / CARD_W;

export interface PersonalityShare {
  sectionType: string;
  title: string;
  quotes: string[];
}

export interface RoleShare {
  sectionType: string;
  title: string;
  matchPct: number | null;
  quotes: string[];
  isOutsideBox: boolean;
}

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  firstName: string;
  personalityShares: PersonalityShare[];
  roleShares: RoleShare[];
}

type CardType = 'personality' | 'role';

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  open,
  onClose,
  firstName,
  personalityShares,
  roleShares,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Default to whichever type actually has data. Prefer role.
  const initialType: CardType =
    roleShares.length > 0 ? 'role' : personalityShares.length > 0 ? 'personality' : 'role';
  const [cardType, setCardType] = useState<CardType>(initialType);
  const [roleIdx, setRoleIdx] = useState(0);
  const [personalityIdx, setPersonalityIdx] = useState(0);
  const [quoteIdx, setQuoteIdx] = useState(0);
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

  // Reset quote index when the user switches type or picks a different
  // section / role — otherwise the index can land out of bounds for the new
  // quotes array.
  useEffect(() => {
    setQuoteIdx(0);
  }, [cardType, roleIdx, personalityIdx]);

  const activeQuotes = useMemo(() => {
    if (cardType === 'role') return roleShares[roleIdx]?.quotes ?? [];
    return personalityShares[personalityIdx]?.quotes ?? [];
  }, [cardType, roleIdx, personalityIdx, roleShares, personalityShares]);

  const quote = activeQuotes[quoteIdx] || activeQuotes[0] || '';
  const role = roleShares[roleIdx];
  const personality = personalityShares[personalityIdx];

  if (!open) return null;

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
      const slug =
        cardType === 'role'
          ? `role-${(role?.title || 'career').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
          : `personality-${(personality?.title || 'me').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
      link.download = `cairnly-${slug}-${(firstName || 'me').toLowerCase()}.png`;
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

        {/* Card-type toggle */}
        <CardTypeToggle
          value={cardType}
          onChange={setCardType}
          roleAvailable={roleShares.length > 0}
          personalityAvailable={personalityShares.length > 0}
        />

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
            margin: '14px auto 0',
          }}
        >
          <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
            <div ref={cardRef}>
              <ShareCard
                cardType={cardType}
                firstName={firstName}
                quote={quote}
                role={role ?? null}
                personality={personality ?? null}
              />
            </div>
          </div>
        </div>

        {/* Section / role picker — depends on card type */}
        {cardType === 'role' && roleShares.length > 0 && (
          <PickerList
            label="Pick the career"
            items={roleShares.map((r) => ({
              key: r.sectionType + ':' + r.title,
              primary: r.title,
              secondary: r.matchPct != null ? `${r.matchPct}% match` : r.isOutsideBox ? 'Outside-the-box' : null,
            }))}
            activeIndex={roleIdx}
            onSelect={setRoleIdx}
          />
        )}
        {cardType === 'personality' && personalityShares.length > 0 && (
          <PickerList
            label="Pick the section"
            items={personalityShares.map((p) => ({
              key: p.sectionType + ':' + p.title,
              primary: p.title,
              secondary: null,
            }))}
            activeIndex={personalityIdx}
            onSelect={setPersonalityIdx}
          />
        )}

        {/* Quote picker */}
        {activeQuotes.length > 0 && (
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
              {activeQuotes.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuoteIdx(i)}
                  style={{
                    textAlign: 'left',
                    background: i === quoteIdx ? 'rgba(39,161,161,0.12)' : '#fff',
                    border: `1px solid ${i === quoteIdx ? PALETTE.teal : PALETTE.tan}`,
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

// ── Card-type toggle ────────────────────────────────────────
const CardTypeToggle: React.FC<{
  value: CardType;
  onChange: (v: CardType) => void;
  roleAvailable: boolean;
  personalityAvailable: boolean;
}> = ({ value, onChange, roleAvailable, personalityAvailable }) => {
  const options: { key: CardType; label: string; available: boolean }[] = [
    { key: 'role', label: 'Best-fit role', available: roleAvailable },
    { key: 'personality', label: 'Personality', available: personalityAvailable },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        padding: 4,
        background: '#fff',
        border: `1px solid ${PALETTE.tan}`,
        borderRadius: 9999,
        gap: 4,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={!opt.available}
            onClick={() => onChange(opt.key)}
            style={{
              background: active ? PALETTE.teal : 'transparent',
              color: active ? '#fff' : opt.available ? PALETTE.tealDeep : PALETTE.inkSoft,
              border: 'none',
              padding: '8px 16px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 12.5,
              letterSpacing: '0.02em',
              cursor: opt.available ? 'pointer' : 'not-allowed',
              opacity: opt.available ? 1 : 0.5,
              transition: 'background 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

// ── Generic picker list — used for both role and section selection ───
const PickerList: React.FC<{
  label: string;
  items: { key: string; primary: string; secondary: string | null }[];
  activeIndex: number;
  onSelect: (i: number) => void;
}> = ({ label, items, activeIndex, onSelect }) => (
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
      {label}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(i)}
            style={{
              textAlign: 'left',
              background: active ? 'rgba(39,161,161,0.12)' : '#fff',
              border: `1px solid ${active ? PALETTE.teal : PALETTE.tan}`,
              borderRadius: 12,
              padding: '10px 14px',
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 500,
              color: PALETTE.ink,
              cursor: 'pointer',
              lineHeight: 1.4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontWeight: 600 }}>{item.primary}</span>
            {item.secondary && (
              <span style={{ fontSize: 11.5, color: PALETTE.inkSoft, fontWeight: 600 }}>{item.secondary}</span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

// ── The 1200×627 card itself ────────────────────────────────
const ShareCard: React.FC<{
  cardType: CardType;
  firstName: string;
  quote: string;
  role: RoleShare | null;
  personality: PersonalityShare | null;
}> = ({ cardType, firstName, quote, role, personality }) => (
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
    {/* LEFT — cream paper with the quote */}
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
        <div style={{ marginTop: 28 }}>
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
            {cardType === 'role' && role
              ? `Why ${role.title} fits ${firstName || 'me'}, per Cairnly.`
              : `Cairnly, on what ${firstName || 'I'} bring${firstName ? 's' : ''}.`}
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

    {/* RIGHT — dark photo panel with cairn symbol watermark + content callout */}
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Cairn hero photo backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${CairnImageHero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(0.9)',
        }}
      />
      {/* Dark gradient so text stays legible over the photo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(18,46,59,0.55) 0%, rgba(18,46,59,0.92) 80%, ${PALETTE.canvasDeep} 100%)`,
        }}
      />
      {/* Faint cairn-symbol watermark — same treatment as About section */}
      <img
        src={CairnSymbolInvert}
        alt=""
        crossOrigin="anonymous"
        style={{
          position: 'absolute',
          right: -20,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 270,
          height: 'auto',
          opacity: 0.09,
          pointerEvents: 'none',
        }}
      />
      {/* Foreground content */}
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
          <img
            src={CairnSymbolInvert}
            alt=""
            crossOrigin="anonymous"
            style={{ height: 64, width: 'auto', opacity: 0.95 }}
          />
        </div>
        {cardType === 'role' && role ? (
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
              {role.isOutsideBox ? 'OUTSIDE-THE-BOX · MY CAIRNLY MATCH' : 'BEST-FIT CAREER · MY CAIRNLY MATCH'}
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
              {role.title}
            </h2>
            {role.matchPct != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.14)', borderRadius: 9999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${role.matchPct}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${PALETTE.teal} 0%, ${PALETTE.goldBright} 100%)`,
                      boxShadow: '0 0 14px rgba(212,160,36,0.45)',
                    }}
                  />
                </div>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: PALETTE.goldBright }}>
                  {role.matchPct}%
                </span>
              </div>
            )}
          </div>
        ) : (
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
              MY PERSONALITY · CAIRNLY REPORT
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
              {personality?.title || 'My read on me'}
            </h2>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 15,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.78)',
              }}
            >
              {firstName ? `${firstName}'s Cairnly profile` : 'Cairnly profile'}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
