import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Sparkles, Lock, Shield, ClipboardCheck } from 'lucide-react';
import { tArray } from '@/lib/i18nArray';
import {
  Eyebrow,
  MatchPill,
  MovePill,
  AIImpactPill,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';

/**
 * The package card shown in the hero's right column once the intake chat
 * reaches the pitch (replacing the rotating product carousel). Content mirrors
 * the pricing section's card (same i18n keys, so EN/NL stay in sync); styling
 * mirrors the in-app dashboard's top-career cards (DashboardV4): dark glass,
 * gold glow + eyebrow, Poppins display title, the real rating pills. It reads
 * as the product surface the visitor is about to unlock, with the checkout CTA
 * on the card — this is the moment they see what €39 buys.
 */
const ReportDeliverablesCard: React.FC = () => {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const features = tArray<string>(t, 'pricing.features');
  const bonusItems = tArray<string>(t, 'pricing.bonusItems');

  return (
    <div
      className="relative mx-auto w-full max-w-[480px] overflow-hidden"
      style={{
        background: 'rgba(18, 46, 59, 0.62)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: 28,
        boxShadow: '0 40px 80px -28px rgba(0,0,0,0.55)',
      }}
    >
      {/* Soft gold glow, same as the dashboard hero career card */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: -60,
          right: -60,
          width: 320,
          height: 320,
          background: 'radial-gradient(circle, rgba(212,160,36,0.20) 0%, rgba(212,160,36,0) 70%)',
        }}
      />

      <div className="relative flex flex-col gap-5 p-7">
        {/* Eyebrow + title */}
        <div className="flex flex-col gap-2">
          <Eyebrow>{t('pricing.eyebrow')}</Eyebrow>
          <h3
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              color: '#fff',
              margin: 0,
            }}
          >
            {t('pricing.titleA')} <span className="lp-text-teal-grad">{t('pricing.titleHighlight')}</span>
          </h3>
        </div>

        {/* Deliverables */}
        <ul className="flex flex-col gap-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <CheckCircle2 size={17} strokeWidth={2.2} color="#2ABFBF" className="mt-0.5 shrink-0" />
              <span
                style={{ fontFamily: FONT_BODY, fontWeight: 500, fontSize: 14, lineHeight: 1.45, color: 'rgba(255,255,255,0.88)' }}
              >
                {f}
              </span>
            </li>
          ))}
        </ul>

        {/* Live example of the rating pills on every suggested role */}
        <div className="rounded-2xl px-4 py-3.5" style={{ background: 'rgba(9,26,35,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p
            className="mb-2.5"
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {t('pricing.pillPreviewLabel')}
          </p>
          <div className="flex flex-wrap gap-2">
            <MatchPill pct={87} />
            <MovePill level="Reframe" />
            <AIImpactPill label="Minimal" />
          </div>
        </div>

        {/* Bonus tools */}
        <ul className="flex flex-col gap-2.5">
          {bonusItems.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Sparkles size={17} strokeWidth={2.2} color="#EFBE48" className="mt-0.5 shrink-0" />
              <span style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13.5, lineHeight: 1.45, color: '#EFBE48' }}>
                {item}
              </span>
            </li>
          ))}
        </ul>

        {/* Price + CTA footer */}
        <div className="flex flex-col items-center gap-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 18 }}>
          <span
            className="rounded-full px-4 py-1.5"
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              background: '#D4A024',
              color: '#1A1A1A',
            }}
          >
            {t('pricing.betaPill')}
          </span>
          <div className="mt-3 flex items-end gap-3">
            <span style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through', fontSize: 18, fontWeight: 600 }}>
              {t('pricing.originalPrice')}
            </span>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 44, lineHeight: 1, letterSpacing: '-0.02em', color: '#fff' }}>
              {t('pricing.price')}
            </span>
          </div>
          <p
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            {t('pricing.oneOff')}
          </p>

          <button
            type="button"
            onClick={() => navigate('/payment')}
            className="lp-btn-primary mt-4 w-full justify-center"
            style={{ fontSize: 16, padding: '16px 22px' }}
          >
            {t('pricing.cta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
          <p className="mt-2 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {t('intake.ctaNote')}
          </p>

          <div className="mt-3 flex items-center justify-center gap-5 text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span className="flex items-center gap-1.5"><Lock size={13} strokeWidth={2} />{t('pricing.trust.stripe')}</span>
            <span className="flex items-center gap-1.5"><Shield size={13} strokeWidth={2} />{t('pricing.trust.gdpr')}</span>
            <span className="flex items-center gap-1.5"><ClipboardCheck size={13} strokeWidth={2} />{t('pricing.trust.noSub')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDeliverablesCard;
