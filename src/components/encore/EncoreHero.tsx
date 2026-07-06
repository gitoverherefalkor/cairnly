import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { useEncoreGetStarted } from './useEncoreGetStarted';
import CairnSymbolInvert from '@/logos/cairnly-logo/cairn_symbol_invert.png';

/**
 * Encore hero. Same visual language as the starter hero, but the whole flavor
 * runs a size up: this audience is older and the copy must be effortless to
 * read. Scale, not redesign.
 */
const EncoreHero: React.FC = () => {
  const getStarted = useEncoreGetStarted();
  const { t } = useTranslation('encore');

  const titleB = t('hero.titleB');

  return (
    <section className="relative bg-[#213F4F] text-white pt-16 md:pt-24 pb-24 md:pb-28 overflow-hidden">
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
        <div className="max-w-3xl">
          <Reveal className="flex items-center gap-3 mb-8">
            <span className="text-[11px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
              {t('hero.eyebrow')}
            </span>
            <span className="h-px w-12 bg-[#D4A024]/40" />
          </Reveal>

          <Reveal as="div">
            <h1
              className="font-heading font-bold leading-[1.15] text-white"
              style={{ fontSize: 'clamp(30px, 3.4vw, 50px)', letterSpacing: '-0.015em', maxWidth: 760 }}
            >
              {t('hero.titleA')}{' '}
              <span className="lp-text-gold-grad">{t('hero.titleHighlight')}</span>
              {titleB ? <> {titleB}</> : null}
            </h1>
          </Reveal>

          <Reveal as="div" className="mt-8 max-w-2xl">
            <p className="text-lg md:text-xl text-white/70 font-medium leading-relaxed">
              {t('hero.body')}{' '}
              <span className="text-white font-semibold">{t('hero.bodyEmphasis')}</span>
            </p>
          </Reveal>

          <Reveal as="div" className="mt-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <button onClick={getStarted} className="lp-btn-primary" style={{ fontSize: 18, padding: '18px 32px' }}>
                {t('hero.ctaPrimary')}
                <ArrowRight size={19} strokeWidth={2.4} />
              </button>
              <a
                href="#how-it-works"
                onClick={(e) => {
                  e.preventDefault();
                  document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="lp-btn-secondary-text"
                style={{ fontSize: 16 }}
              >
                {t('hero.ctaSecondary')}
                <ChevronDown size={15} strokeWidth={2} />
              </a>
            </div>
            <p className="mt-6 text-[15px] text-white/50 font-medium">{t('hero.trust')}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default EncoreHero;
