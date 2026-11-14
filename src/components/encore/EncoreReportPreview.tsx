import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';

/**
 * Anonymised preview of one report direction (a fictional profile, copy in
 * encore.json under "preview"). Shows what the buyer gets before they pay.
 * No match percentage, matching the report itself (hidden for Encore).
 */
const EncoreReportPreview: React.FC = () => {
  const { t } = useTranslation('encore');
  const row = (labelKey: string, bodyKey: string, accent = false) => (
    <div className={accent ? 'rounded-2xl p-5' : ''} style={accent ? { background: 'rgba(212,160,36,0.10)', border: '1px solid rgba(212,160,36,0.3)' } : undefined}>
      <div className="lp-eyebrow text-[#1F8282] mb-2">{t(`preview.card.${labelKey}`)}</div>
      <p className="text-[17px] text-[#122E3B] font-medium leading-relaxed">{t(`preview.card.${bodyKey}`)}</p>
    </div>
  );

  return (
    <section id="report-preview" className="bg-[#ECE4D2] py-24 md:py-32 scroll-mt-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-14">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('preview.eyebrow')}</div>
          <h2 className="font-heading font-bold text-[#122E3B] leading-[1.12]" style={{ fontSize: 'clamp(28px, 3.2vw, 42px)', letterSpacing: '-0.012em' }}>
            {t('preview.title')}
          </h2>
          <p className="mt-6 text-lg md:text-xl text-[#4B6373] font-medium leading-relaxed">{t('preview.intro')}</p>
        </Reveal>

        <Reveal>
          <article
            className="max-w-4xl rounded-3xl p-7 md:p-10 shadow-[0_24px_60px_-28px_rgba(18,46,59,0.35)]"
            style={{ background: '#FBF6E8', border: '1px solid rgba(201,182,144,0.7)' }}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5">
              <span className="text-[11px] font-heading font-bold tracking-[0.22em] uppercase text-[#C8891A]">{t('preview.card.tag')}</span>
              <span className="text-[13px] text-[#6B7F8B] font-medium italic">{t('preview.card.exampleNote')}</span>
            </div>
            <h3 className="font-heading font-bold text-[#122E3B] mb-7" style={{ fontSize: 'clamp(24px, 2.6vw, 32px)', letterSpacing: '-0.012em' }}>
              {t('preview.card.title')}
            </h3>
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-7">
              <div className="md:col-span-2">{row('fitLabel', 'fit')}</div>
              {row('hoursLabel', 'hours')}
              {row('wayInLabel', 'wayIn')}
              <div className="md:col-span-2">{row('honestLabel', 'honest', true)}</div>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
};

export default EncoreReportPreview;
