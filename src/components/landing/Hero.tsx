import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Reveal from './Reveal';
import HeroCarousel from './HeroCarousel';
import { useGetStarted } from './useGetStarted';
import CairnSymbolInvert from '@/logos/cairnly-logo/cairn_symbol_invert.png';

const Hero: React.FC = () => {
  const getStarted = useGetStarted();
  const { t } = useTranslation('landing');

  return (
    <section className="relative bg-[#213F4F] text-white pt-12 md:pt-16 pb-24 md:pb-28 overflow-hidden">
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
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Copy */}
          <div className="lg:col-span-7">
            <Reveal className="flex items-center gap-3 mb-8">
              <span className="text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
                {t('hero.eyebrow')}
              </span>
              <span className="h-px w-12 bg-[#D4A024]/40" />
            </Reveal>

            <Reveal
              as="div"
              className="font-heading font-bold leading-[1.15] text-white"
              style={{ fontSize: 'clamp(28px, 3.2vw, 46px)', letterSpacing: '-0.015em', maxWidth: 720 }}
            >
              <h1>
                {t('hero.titleA')} <span className="lp-text-gold-grad">{t('hero.titleHighlight')}</span> {t('hero.titleB')}
              </h1>
            </Reveal>

            <Reveal as="div" className="mt-8 max-w-2xl">
              <p className="text-base md:text-lg text-white/65 font-medium leading-relaxed">
                {t('hero.body')}{' '}
                <span className="text-white font-semibold">
                  {t('hero.bodyEmphasis')}
                </span>
              </p>
            </Reveal>

            <Reveal className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <button onClick={getStarted} className="lp-btn-primary">
                {t('hero.ctaPrimary')}
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>
              <a
                href="#how-it-works"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="lp-btn-secondary-text"
              >
                {t('hero.ctaSecondary')}
                <ChevronDown size={14} strokeWidth={2} />
              </a>
            </Reveal>

            <Reveal as="div" className="mt-7">
              <p className="text-sm text-white/45 font-medium">
                {t('hero.reassurance')}
              </p>
            </Reveal>
          </div>

          {/* Product preview — rotating browser carousel */}
          <Reveal className="lg:col-span-5">
            <HeroCarousel />
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default Hero;
