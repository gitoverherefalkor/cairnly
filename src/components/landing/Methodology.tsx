import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Lock, Trash2 } from 'lucide-react';
import Reveal from './Reveal';
import WorkflowDiagramV2 from './WorkflowDiagramV2';

const Methodology: React.FC = () => {
  const { t } = useTranslation('landing');

  return (
    <section
      id="methodology"
      className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden"
    >
      <div className="lp-container relative z-10">
        <Reveal className="text-center max-w-3xl mx-auto mb-16">
          <div className="lp-eyebrow text-[#D4A024] mb-5">{t('methodology.eyebrow')}</div>
          <h2
            className="font-heading font-bold leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 44px)', letterSpacing: '-0.012em' }}
          >
            {t('methodology.titleA')}{' '}
            <br />
            <span className="lp-text-gold-grad">{t('methodology.titleHighlight')}</span>
          </h2>
          <p className="mt-7 text-lg text-white/65 font-medium leading-relaxed">
            {t('methodology.intro')}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
          {/* Old approach */}
          <Reveal
            className="rounded-3xl p-8 md:p-10"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span
              className="inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase mb-7"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}
            >
              {t('methodology.oldCard.pill')}
            </span>
            <h3 className="font-heading font-bold text-2xl md:text-3xl text-white mb-5" style={{ letterSpacing: '-0.012em' }}>
              {t('methodology.oldCard.title')}
            </h3>
            <p className="text-[15px] text-white/65 font-medium leading-relaxed mb-5">
              {t('methodology.oldCard.p1')}
            </p>
            <p className="text-[15px] text-white/65 font-medium leading-relaxed">
              {t('methodology.oldCard.p2')}
            </p>
          </Reveal>

          {/* Cairnly approach */}
          <Reveal
            className="rounded-3xl p-8 md:p-10"
            style={{
              background: '#FBF6E8',
              border: '1px solid #D4A024',
              color: '#122E3B',
              boxShadow: '0 30px 60px -25px rgba(212,160,36,0.4)',
            }}
          >
            <span
              className="inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase mb-7"
              style={{ background: '#D4A024', color: '#1A1A1A', letterSpacing: '0.12em' }}
            >
              {t('methodology.newCard.pill')}
            </span>
            <h3 className="font-heading font-bold text-2xl md:text-3xl text-[#122E3B] mb-5" style={{ letterSpacing: '-0.012em' }}>
              {t('methodology.newCard.title')}
            </h3>
            <p className="text-[15px] text-[#4B6373] font-medium leading-relaxed mb-5">
              {t('methodology.newCard.p1')}{' '}
              <strong className="text-[#122E3B]">{t('methodology.newCard.p1Emphasis')}</strong>
            </p>
            <p className="text-[15px] text-[#4B6373] font-medium leading-relaxed">
              {t('methodology.newCard.p2')}
            </p>
          </Reveal>
        </div>

        {/* Engine diagram - the methodology made visible */}
        <Reveal as="div" className="max-w-7xl mx-auto mt-20 md:mt-24">
          <div className="text-center mb-8 md:mb-10">
            <div className="lp-eyebrow text-[#D4A024] mb-4">{t('methodology.engineEyebrow')}</div>
            <h3
              className="font-heading font-bold text-white leading-[1.15]"
              style={{ fontSize: 'clamp(22px, 2.4vw, 34px)', letterSpacing: '-0.012em' }}
            >
              {t('methodology.engineTitle')}
            </h3>
            <p className="mt-4 text-base md:text-lg text-white/60 font-medium leading-relaxed max-w-2xl mx-auto">
              {t('methodology.engineSubtitle')}
            </p>
          </div>
          <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(212,160,36,0.25)', boxShadow: '0 40px 80px -30px rgba(0,0,0,0.5)' }}>
            <WorkflowDiagramV2 />
          </div>

          {/* Trust statements */}
          <div className="mt-8 md:mt-10 flex items-center justify-center gap-x-8 gap-y-3 flex-wrap text-[12px] font-medium text-white/65">
            <div className="flex items-center gap-2">
              <Shield size={14} strokeWidth={2} className="text-[#D4A024]" />
              <span><strong className="text-white font-semibold">{t('methodology.trust.gdpr')}</strong> · {t('methodology.trust.gdprDetail')}</span>
            </div>
            <span className="text-white/15">·</span>
            <div className="flex items-center gap-2">
              <Lock size={14} strokeWidth={2} className="text-[#D4A024]" />
              <span><strong className="text-white font-semibold">{t('methodology.trust.stripe')}</strong> · {t('methodology.trust.stripeDetail')}</span>
            </div>
            <span className="text-white/15">·</span>
            <div className="flex items-center gap-2">
              <Trash2 size={14} strokeWidth={2} className="text-[#D4A024]" />
              <span><strong className="text-white font-semibold">{t('methodology.trust.delete')}</strong> · {t('methodology.trust.deleteDetail')}</span>
            </div>
          </div>
        </Reveal>

        <Reveal as="div" className="max-w-3xl mx-auto mt-14">
          <p className="text-center text-base md:text-lg text-white/55 italic font-medium leading-relaxed">
            {t('methodology.closer')}
          </p>
        </Reveal>
      </div>
    </section>
  );
};

export default Methodology;
