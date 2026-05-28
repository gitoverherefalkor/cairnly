import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from './Reveal';
import CairnSymbolInvert from '@/logos/cairnly-logo/cairn_symbol_invert.png';

const WhyWeBuiltThis: React.FC = () => {
  const { t } = useTranslation('landing');

  return (
    <section
      id="about"
      className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden"
    >
      <div className="absolute right-[-20px] md:right-[20px] top-1/2 -translate-y-1/2 pointer-events-none opacity-[0.09]">
        <img src={CairnSymbolInvert} alt="" className="w-[210px] md:w-[270px] h-auto" />
      </div>
      <div className="lp-container relative z-10">
        <Reveal className="max-w-3xl">
          <div className="lp-eyebrow text-[#D4A024] mb-6">{t('whyBuilt.eyebrow')}</div>
          <h2
            className="font-heading font-bold leading-[1.1]"
            style={{ fontSize: 'clamp(28px, 3.5vw, 52px)', letterSpacing: '-0.015em' }}
          >
            {t('whyBuilt.titleA')}{' '}
            <br />
            {t('whyBuilt.titleB')} <span className="lp-text-gold-grad">{t('whyBuilt.titleHighlight')}</span>{t('whyBuilt.titleC')}
          </h2>
          <div className="mt-10 space-y-6 text-lg text-white/75 font-medium leading-relaxed">
            <p>{t('whyBuilt.p1')}</p>
            <p>{t('whyBuilt.p2')}</p>
          </div>
          <div className="mt-12 flex items-center gap-3 text-white/40">
            <div className="h-px w-12 bg-white/20" />
            <span className="text-[12px] uppercase tracking-[0.22em] font-bold">
              {t('whyBuilt.signature')}
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default WhyWeBuiltThis;
