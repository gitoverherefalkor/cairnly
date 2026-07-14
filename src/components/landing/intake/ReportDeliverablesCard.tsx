import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { tArray } from '@/lib/i18nArray';

/**
 * "Everything in your dashboard" card, shown in the hero's right column once
 * the intake chat reaches the pitch (replacing the rotating product carousel).
 * The deliverables mirror the REPORT panel of the engine diagram
 * (WorkflowDiagramV2). Roomy single-column list (the right column has width to
 * spare), with the checkout CTA on the card itself: this is the moment the
 * visitor is looking at exactly what their €39 buys.
 */
const ReportDeliverablesCard: React.FC = () => {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const items = tArray<string>(t, 'intake.report.items');

  return (
    <div
      className="mx-auto w-full max-w-[560px] overflow-hidden rounded-3xl border"
      style={{
        background: '#FDFBF2',
        borderColor: 'rgba(201, 182, 144, 0.6)',
        boxShadow: '0 40px 80px -32px rgba(0,0,0,0.55)',
      }}
    >
      {/* Header */}
      <div className="px-7 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(201,182,144,0.4)' }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#D4A024' }}>
          {t('intake.report.eyebrow')}
        </p>
        <p
          className="mt-1.5 text-[24px] font-bold leading-tight text-[#122E3B]"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t('intake.report.title')}
        </p>
      </div>

      {/* Deliverables — single column, roomy */}
      <ul className="flex flex-col gap-3 px-7 py-6">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-3">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(39,161,161,0.14)' }}
            >
              <Check size={12} strokeWidth={3} style={{ color: '#1F8282' }} />
            </span>
            <span className="text-[15px] leading-snug text-[#1F2937]">{item}</span>
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
        <p className="mt-2.5 text-center text-[12px]" style={{ color: 'rgba(18,46,59,0.55)' }}>
          {t('intake.ctaNote')}
        </p>
      </div>
    </div>
  );
};

export default ReportDeliverablesCard;
