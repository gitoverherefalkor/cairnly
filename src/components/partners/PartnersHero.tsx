import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import PartnerRadarSlot from './PartnerRadarSlot';
import { SAMPLE_ROUTE } from './constants';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';

/**
 * Dark hero on the teal-navy canvas (#213F4F, the app's --background), same
 * atmospheric treatment as the Starter and Encore heroes so the partner page
 * reads as part of the site rather than a bolt-on.
 */
const PartnersHero: React.FC = () => {
  const { t } = useTranslation('partners');

  return (
    <section className="relative bg-[#213F4F] text-white pt-16 md:pt-24 pb-20 md:pb-24 overflow-hidden">
      {/* Atmospheric teal bloom */}
      <div
        className="absolute -top-64 -right-64 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{ background: 'rgba(39,161,161,0.15)', filter: 'blur(120px)' }}
      />
      {/* Cairn silhouette */}
      <div className="absolute left-[-30px] bottom-[-50px] pointer-events-none opacity-[0.07]">
        <img src={CairnSymbolInvert} alt="" className="w-[200px] md:w-[260px] h-auto" />
      </div>

      <div className="lp-container relative z-10">
        <Reveal as="div">
          <h1
            className="font-heading font-bold leading-[1.15] text-white"
            style={{ fontSize: 'clamp(28px, 3.4vw, 48px)', letterSpacing: '-0.015em', maxWidth: 820 }}
          >
            {t('hero.title')}
          </h1>
        </Reveal>

        <Reveal as="div" className="mt-8 max-w-3xl">
          <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed">
            {t('hero.body')}
          </p>
        </Reveal>

        <Reveal as="div" className="mt-12 max-w-3xl">
          <PartnerRadarSlot />
        </Reveal>

        <Reveal as="div" className="mt-8">
          <Link to={SAMPLE_ROUTE} className="lp-btn-primary">
            {t('hero.sampleCta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersHero;
