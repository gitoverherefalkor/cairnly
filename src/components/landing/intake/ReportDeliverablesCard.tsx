import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { tArray } from '@/lib/i18nArray';

/**
 * "The clarity Cairnly offers" card, shown in the hero's right column once the
 * intake chat reaches the pitch (replacing the rotating product carousel). It
 * borrows the in-app dashboard's dark-glass card styling (see DashboardV4 /
 * dashboardV2Shared) — translucent navy, blur, bright text and teal accents —
 * so it reads as the same product surface the visitor is about to unlock. The
 * checkout CTA lives on the card: this is the moment they see what €39 buys.
 */
const ReportDeliverablesCard: React.FC = () => {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const items = tArray<string>(t, 'intake.report.items');

  return (
    <div
      className="mx-auto w-full max-w-[560px] overflow-hidden rounded-3xl"
      style={{
        background: 'rgba(18, 46, 59, 0.62)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 30px 60px -24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header: price as the eyebrow, then the title */}
      <div className="px-7 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <p
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#EFBE48',
          }}
        >
          {t('intake.report.priceLine')}
        </p>
        <p
          className="mt-2 text-[24px] font-bold leading-tight"
          style={{ fontFamily: "'Poppins', sans-serif", color: '#F4ECDA' }}
        >
          {t('intake.report.title')}
        </p>
      </div>

      {/* Deliverables — single column, roomy, bright on dark */}
      <ul className="flex flex-col gap-3 px-7 py-6">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-3">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(42,191,191,0.16)' }}
            >
              <Check size={12} strokeWidth={3} style={{ color: '#2ABFBF' }} />
            </span>
            <span className="text-[15px] leading-snug" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {item}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA: the card's own footer. This is the moment to ask for the click. */}
      <div className="px-7 pb-7">
        <button
          type="button"
          onClick={() => navigate('/payment')}
          className="lp-btn-primary w-full justify-center"
          style={{ fontSize: 16, padding: '16px 22px' }}
        >
          {t('intake.ctaCheckout')}
          <ArrowRight size={18} strokeWidth={2.4} />
        </button>
        <p className="mt-2.5 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {t('intake.ctaNote')}
        </p>
      </div>
    </div>
  );
};

export default ReportDeliverablesCard;
