import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { useEncoreGetStarted } from './useEncoreGetStarted';
import { ENCORE_PRICING, currencyForLanguage } from '@/lib/pricing';
import { formatCurrency } from '@/lib/format';

/**
 * One-time-payment pricing card. Encore has its own premium price and shows it
 * plainly: no strike-through anchor, this audience smells a fake discount.
 */
const EncorePricing: React.FC = () => {
  const getStarted = useEncoreGetStarted();
  const { t, i18n } = useTranslation('encore');

  const currency = currencyForLanguage(i18n.language);
  const { core } = ENCORE_PRICING[currency];
  const price = formatCurrency(core, i18n.language, currency.toUpperCase());

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
            style={{ fontSize: 'clamp(26px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('pricing.title')}
          </h2>
          <p className="text-[17px] text-[#4B6373] font-medium leading-relaxed max-w-md mx-auto mb-10">
            {t('pricing.body')}
          </p>

          <div className="flex items-end justify-center mb-10">
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

          <p className="mt-8 text-[14px] text-[#6B7F8B] font-semibold">{t('pricing.note')}</p>
        </Reveal>
      </div>
    </section>
  );
};

export default EncorePricing;
