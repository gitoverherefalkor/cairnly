import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { useStarterGetStarted } from './useStarterGetStarted';
import { PRICING, currencyForLanguage } from '@/lib/pricing';
import { formatCurrency } from '@/lib/format';

/** One-time-payment pricing card. Amounts come from the shared pricing source of truth. */
const StarterPricing: React.FC = () => {
  const getStarted = useStarterGetStarted();
  const { t, i18n } = useTranslation('starter');

  const currency = currencyForLanguage(i18n.language);
  const { core, original } = PRICING[currency];
  const price = formatCurrency(core, i18n.language, currency.toUpperCase());
  const originalPrice = formatCurrency(original, i18n.language, currency.toUpperCase());

  return (
    <section id="pricing" className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden">
      <div
        className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'rgba(212,160,36,0.10)', filter: 'blur(120px)', marginLeft: -200 }}
      />

      <div className="lp-container relative z-10">
        <Reveal
          className="max-w-2xl mx-auto lp-pricing-card rounded-[2.5rem] overflow-hidden p-10 md:p-14 text-center text-[#122E3B]"
          style={{ boxShadow: '0 40px 80px -30px rgba(0,0,0,0.5)' }}
        >
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('pricing.eyebrow')}</div>
          <h2
            className="font-heading font-bold leading-[1.1] mb-4"
            style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', letterSpacing: '-0.012em' }}
          >
            {t('pricing.title')}
          </h2>
          <p className="text-[16px] text-[#4B6373] font-medium leading-relaxed max-w-md mx-auto mb-10">
            {t('pricing.body')}
          </p>

          <div className="flex items-end justify-center gap-4 mb-10">
            <span style={{ color: '#9CA3AF', textDecoration: 'line-through', fontSize: 22, fontWeight: 600 }}>
              {originalPrice}
            </span>
            <span
              className="font-heading text-[#122E3B]"
              style={{ fontSize: 64, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.02em' }}
            >
              {price}
            </span>
          </div>

          <button
            onClick={getStarted}
            className="lp-btn-primary justify-center"
            style={{ fontSize: 18, padding: '18px 34px' }}
          >
            {t('pricing.cta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>

          <p className="mt-8 text-[13px] text-[#6B7F8B] font-semibold">{t('pricing.note')}</p>
        </Reveal>
      </div>
    </section>
  );
};

export default StarterPricing;
