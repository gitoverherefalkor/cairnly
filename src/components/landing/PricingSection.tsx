import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Sparkles, ArrowRight, Lock, Shield, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Reveal from './Reveal';
import { tArray } from '@/lib/i18nArray';
import { getProPricing } from '@/lib/pricing';
import { formatCurrency } from '@/lib/format';
import { trackCtaClick } from '@/lib/analytics';

const PricingSection: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('landing');
  const features = tArray<string>(t, 'pricing.features');
  const bonusItems = tArray<string>(t, 'pricing.bonusItems');

  // One flat price from the shared source, so the panel, the checkout and the
  // intake chat can never quote different numbers.
  const { core, currency } = getProPricing();
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
            {/* The heading moved to the price panel on 2026-09-16 so the
                tagline sits directly above the number it is arguing for. */}
            <div className="lp-eyebrow text-[#1F8282] mb-7">{t('pricing.eyebrow')}</div>
            <ul className="space-y-3.5">
              {features.map((f, i) => (
                <li key={i} className="flex items-start gap-4 text-[15px] font-bold text-[#374151]">
                  <CheckCircle2 size={20} strokeWidth={2.2} color="#27A1A1" className="shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* The rated-role pills moved to Methodology on 2026-09-16: a dark
                box inside this cream column read as pasted in, and the pills
                belong next to the description of what the engine produces. */}
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
            <h2
              className="font-heading font-bold leading-[1.15] mb-7 text-[#122E3B]"
              style={{ fontSize: 'clamp(21px, 1.9vw, 27px)', letterSpacing: '-0.012em' }}
            >
              {t('pricing.titleA')} <span className="lp-text-teal-grad">{t('pricing.titleHighlight')}</span>
            </h2>

            {/* Just the price. The "limited offer" pill, the countdown and the
                strike-through anchor were retired with the intro price on
                2026-09-16 — three urgency devices on one panel read as an
                infomercial to an audience weighing a real decision, and an
                anchor with no higher price behind it is an invented discount.
                The "no subscription" chip below carries the reassurance. */}
            <div className="flex items-end mb-8">
              <span
                className="font-heading text-[#122E3B]"
                style={{ fontSize: 64, lineHeight: 1, fontWeight: 600, letterSpacing: '-0.02em' }}
              >
                {price}
              </span>
            </div>

            <button
              onClick={() => { trackCtaClick('pricing'); navigate('/payment'); }}
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
