import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check } from 'lucide-react';
import { tArray } from '@/lib/i18nArray';

/**
 * Compact "everything the full report gives you" card, shown in the hero's
 * right column once the intake chat reaches the pitch (replacing the rotating
 * product carousel). The deliverables mirror the REPORT panel of the engine
 * diagram (WorkflowDiagramV2). The checkout CTA lives here, on the card
 * itself, rather than in the chat thread: this is the moment the visitor is
 * looking at exactly what their €39 buys, so the button belongs right under it.
 */
const ReportDeliverablesCard: React.FC = () => {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const items = tArray<string>(t, 'intake.report.items');

  return (
    <div
      className="mx-auto max-w-[420px] overflow-hidden rounded-3xl border"
      style={{
        background: '#FDFBF2',
        borderColor: 'rgba(201, 182, 144, 0.6)',
        boxShadow: '0 40px 80px -32px rgba(0,0,0,0.55)',
      }}
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(201,182,144,0.4)' }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#D4A024' }}>
          {t('intake.report.eyebrow')}
        </p>
        <p
          className="mt-1 text-[19px] font-bold leading-tight text-[#122E3B]"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t('intake.report.title')}
        </p>
      </div>

      {/* Deliverables */}
      <ul className="grid grid-cols-1 gap-x-4 gap-y-2.5 px-6 py-5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(39,161,161,0.14)' }}
            >
              <Check size={11} strokeWidth={3} style={{ color: '#1F8282' }} />
            </span>
            <span className="text-[13px] leading-snug text-[#1F2937]">{item}</span>
          </li>
        ))}
      </ul>

      {/* CTA: the card's own footer, replacing the old "ready in 5 minutes"
          pill. This is the moment to ask for the click. */}
      <div className="px-6 pb-6">
        <button
          type="button"
          onClick={() => navigate('/payment')}
          className="lp-btn-primary w-full justify-center"
          style={{ fontSize: 16, padding: '15px 22px' }}
        >
          {t('intake.ctaCheckout')}
          <ArrowRight size={17} strokeWidth={2.4} />
        </button>
        <p className="mt-2 text-center text-[12px]" style={{ color: 'rgba(18,46,59,0.55)' }}>
          {t('intake.ctaNote')}
        </p>
      </div>
    </div>
  );
};

export default ReportDeliverablesCard;
