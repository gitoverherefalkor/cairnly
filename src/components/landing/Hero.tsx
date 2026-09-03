import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';
import PriceCountdown from './PriceCountdown';
import CompareLink from './CompareLink';
import DemoPersonaCards from './demo/DemoPersonaCards';
import DemoStage from './demo/DemoStage';
import { INTAKE_SECTION_ANCHOR } from './intake/IntakeSection';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';
import CairnlyLockup from '@/logos/live/cairnly_logo_wordmark_inverted_tagline.png';

/**
 * Hero on the app's nature background. The proof is the public demo: two
 * persona cards (left) open a real coaching session, and the stage beside
 * them (right) plays an excerpt of the active persona's chat in front of the
 * dashboard and job screens that follow it. The intake chat that used to
 * live here has its own section above Pricing (IntakeSection).
 */
const Hero: React.FC = () => {
  const { t } = useTranslation('landing');

  const scrollToIntake = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById(INTAKE_SECTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="survey-bg relative text-white pt-10 md:pt-14 pb-16 md:pb-20 overflow-hidden">
      {/* Atmospheric teal bloom */}
      <div
        className="absolute -top-64 -right-64 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{ background: 'rgba(39,161,161,0.15)', filter: 'blur(120px)' }}
      />
      {/* Cairn mark behind the stage */}
      <div className="absolute bottom-6 right-[-20px] pointer-events-none z-0 hidden lg:block">
        <img src={CairnSymbolInvert} alt="" aria-hidden="true" className="w-[280px] h-auto opacity-[0.08]" />
      </div>

      <div className="lp-container relative z-10">
        {/* Header band: the brand lockup (left) sits level with the headline (right). */}
        <div className="grid items-start lg:grid-cols-12 gap-x-12 xl:gap-x-16 gap-y-6">
          <a href="/" className="lg:col-span-5 lg:col-start-1 self-start">
            <img
              src={CairnlyLockup}
              alt="Cairnly — career path clarity"
              className="w-[160px] md:w-[190px] h-auto"
              style={{ marginTop: 6 }}
            />
          </a>

          <div className="lg:col-span-7 lg:col-start-6">
            <Reveal
              as="div"
              className="font-heading font-bold leading-[1.15] text-white"
              style={{ fontSize: 'clamp(28px, 3.2vw, 44px)', letterSpacing: '-0.015em' }}
            >
              <h1>
                {t('hero.titleA')}
                <br />
                <span className="lp-text-gold-grad">{t('hero.titleHighlight')}</span> {t('hero.titleB')}
              </h1>
            </Reveal>
          </div>
        </div>

        {/* Eyebrow + full-width gold rule */}
        <Reveal className="flex items-center gap-3 mt-6 mb-8 md:mb-10">
          <span className="whitespace-nowrap text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
            {t('hero.eyebrowDemo')}
          </span>
          <span className="h-px flex-1 bg-[#D4A024]/50" />
        </Reveal>

        {/* Lead paragraph, full width under the rule. */}
        <Reveal as="div" className="max-w-3xl mb-8 md:mb-10">
          <p className="text-base md:text-lg text-white/65 font-medium leading-relaxed">
            {t('hero.body')}{' '}
            <span className="text-white font-semibold">{t('hero.bodyEmphasis')}</span>
          </p>
        </Reveal>

        {/* Content band. DOM order (stage, cards) is the mobile order: the
            moving picture first, the choice right under it. Desktop puts the
            cards left and the stage right; the stage stretches to the cards'
            height so both columns end on the same line. */}
        <div className="grid items-start lg:grid-cols-12 gap-x-12 xl:gap-x-16 gap-y-8">
          <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:self-stretch">
            <Reveal as="div" className="lg:h-full">
              <DemoStage />
            </Reveal>
          </div>

          <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1">
            <Reveal as="div">
              <DemoPersonaCards />
              <p className="mt-5 text-[14px] text-white/55 font-medium">
                {t('hero.neitherLine')}{' '}
                <a
                  href={`#${INTAKE_SECTION_ANCHOR}`}
                  onClick={scrollToIntake}
                  className="inline-flex items-center gap-1 text-white/85 font-semibold underline decoration-[#D4A024]/60 underline-offset-4 hover:text-white hover:decoration-[#D4A024]"
                >
                  {t('hero.neitherCta')}
                  <ArrowRight size={13} strokeWidth={2.4} />
                </a>
              </p>
            </Reveal>
          </div>

          {/* Price deadline, the free-alternatives link and the reassurance line, under both columns. */}
          <Reveal as="div" className="lg:col-span-12 mt-4 md:mt-6 flex flex-col items-center gap-3">
            <PriceCountdown tone="gold" leadWithPrice href="#pricing" />
            <CompareLink label={t('hero.compareLink')} />
            <p className="text-sm text-white/45 font-medium text-center">{t('hero.reassurance')}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default Hero;
