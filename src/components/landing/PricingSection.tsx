import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Sparkles, ArrowRight, Lock, Shield, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Reveal from './Reveal';
import { tArray } from '@/lib/i18nArray';
import { MatchPill, MovePill, AIImpactPill } from '@/components/dashboard/v2/dashboardV2Shared';
import PriceCountdown from './PriceCountdown';
import { getProPricing } from '@/lib/pricing';
import { formatCurrency } from '@/lib/format';

const PricingSection: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('landing');
  const features = tArray<string>(t, 'pricing.features');
  const bonusItems = tArray<string>(t, 'pricing.bonusItems');

  // Price and anchor come from the shared source, so the switch to the regular
  // price on 15 Oct 2026 happens here, in the checkout and in the intake chat
  // at the same moment. `anchor` goes null at the switch: no invented discount.
  const { core, anchor, isIntro, currency } = getProPricing();
  const price = formatCurrency(core, i18n.language, currency);

  return (
    <section id="pricing" className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden">
      <div
        className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'rgba(212,160,36,0.10)', filter: 'blur(120px)', marginLeft: -200 }}
      />

      <div className="lp-container relative z-10">
        <Reveal
          className="max-w-6xl mx-auto lp-pricing-card rounded-[2.5rem] overflow-hidden grid lg:grid-cols-12"
          style={{ boxShadow: '0 40px 80px -30px rgba(0,0,0,0.5)' }}
        >
          {/* Value list */}
          <div className="lg:col-span-7 p-10 md:p-14 text-[#122E3B]">
            <div className="lp-eyebrow text-[#1F8282] mb-5">{t('pricing.eyebrow')}</div>
            <h2
              className="font-heading font-bold leading-[1.1] mb-10"
              style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', letterSpacing: '-0.012em' }}
            >
              {t('pricing.titleA')} <span className="lp-text-teal-grad">{t('pricing.titleHighlight')}</span>
            </h2>
            <ul className="space-y-3.5">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-4 text-[15px] font-bold text-[#374151]">
                  <CheckCircle2 size={20} strokeWidth={2.2} color="#27A1A1" className="shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* Live example of the rating pills shown on every suggested role in the report */}
            <div className="mt-6 rounded-2xl p-5" style={{ background: '#122E3B' }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50 mb-3">
                {t('pricing.pillPreviewLabel')}
              </p>
              <div className="flex flex-wrap gap-2">
                <MatchPill pct={87} />
                <MovePill level="Reframe" />
                <AIImpactPill label="Minimal" />
              </div>
            </div>

            <ul className="space-y-3.5 mt-6">
              {bonusItems.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-[15px] font-bold" style={{ color: '#D4A024' }}>
                  <Sparkles size={20} strokeWidth={2.2} color="#D4A024" className="shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Price panel */}
          <div
            className="lg:col-span-5 p-10 md:p-14 flex flex-col justify-center items-center text-center"
            style={{ background: '#F4ECDA', borderLeft: '1px solid rgba(201,182,144,0.6)' }}
          >
            {/* Flex gap rather than a margin on the pill: the countdown renders
                nothing outside its window, and a gap collapses with it. */}
            <div className="flex flex-col items-center gap-4 mb-8">
              <div
                className="px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ background: '#D4A024', color: '#1A1A1A' }}
              >
                {t(isIntro ? 'pricing.betaPill' : 'pricing.regularPill')}
              </div>

              <PriceCountdown tone="light" />
            </div>

            <div className="flex items-end gap-4 mb-3">
              {anchor !== null && (
                <span style={{ color: '#9CA3AF', textDecoration: 'line-through', fontSize: 22, fontWeight: 600 }}>
                  {formatCurrency(anchor, i18n.language, currency)}
                </span>
              )}
              <span
                className="font-heading text-[#122E3B]"
                style={{ fontSize: 64, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.02em' }}
              >
                {price}
              </span>
            </div>
            <p className="text-[#6B7F8B] font-bold uppercase tracking-[0.22em] text-[10px] mb-10">
              {t('pricing.oneOff')}
            </p>

            <button
              onClick={() => navigate('/payment')}
              className="lp-btn-primary w-full justify-center"
              style={{ fontSize: 18, padding: '18px 28px' }}
            >
              {t('pricing.cta')}
              <ArrowRight size={18} strokeWidth={2.4} />
            </button>

            <div className="mt-8 flex items-center justify-center gap-5 text-[#6B7F8B] text-[12px] font-semibold">
              <span className="flex items-center gap-1.5"><Lock size={14} strokeWidth={2} />{t('pricing.trust.stripe')}</span>
              <span className="flex items-center gap-1.5"><Shield size={14} strokeWidth={2} />{t('pricing.trust.gdpr')}</span>
              <span className="flex items-center gap-1.5"><ClipboardCheck size={14} strokeWidth={2} />{t('pricing.trust.noSub')}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default PricingSection;
