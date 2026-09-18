import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'lucide-react';
import Reveal from './Reveal';
import CompareLink from './CompareLink';
import DemoVideoStage from './demo/DemoVideoStage';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';
import CairnlyWordmarkInverted from '@/logos/live/cairnly_logo_wordmark_inverted_tight.png';

/**
 * Hero on the app's nature background. The proof is the public demo: one
 * browser window plays a recording of the persona whose session was held
 * in the visitor's language (survey → coach chat → dashboard) and ends on
 * the real "Start your session" button. The persona cards and the deck of
 * stills left the hero on 2026-09-14 (the deck still serves /partners); the
 * intake chat lives in IntakeSection above Pricing.
 */
const Hero: React.FC = () => {
  const { t } = useTranslation('landing');

  const scrollToNext = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById('why-cairnly')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
              src={CairnlyWordmarkInverted}
              alt="Cairnly"
              className="h-[34px] md:h-[40px] w-auto"
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
                {t('hero.titlePrefix') ? `${t('hero.titlePrefix')} ` : ''}
                <span className="lp-text-gold-grad">{t('hero.titleHighlight')}</span> {t('hero.titleB')}
              </h1>
            </Reveal>
          </div>
        </div>

        {/* Eyebrow */}
        <Reveal className="mt-6 mb-8 md:mb-10">
          <span className="whitespace-nowrap text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
            {t('hero.eyebrowDemo')}
          </span>
        </Reveal>

        {/* Content band: intro text and the small CTAs on the left, the
            recording on the right. DOM order (video, text) is the phone order:
            the moving picture first, the words under it. */}
        <div className="grid items-start lg:grid-cols-12 gap-x-12 xl:gap-x-16 gap-y-8">
          <div className="min-w-0 lg:col-span-7 lg:col-start-6 lg:row-start-1">
            <Reveal as="div">
              <DemoVideoStage />
            </Reveal>
          </div>

          <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:pt-8">
            <Reveal as="div">
              {/* Two paragraphs, not one block: the emphasis line is the turn
                  from "here is the problem" to "here is what Cairnly does",
                  and run together they read as one unbroken wall of text. */}
              <p className="text-base md:text-lg text-white/65 font-medium leading-relaxed">
                {t('hero.body')}
              </p>
              <p className="mt-5 text-base md:text-lg text-white font-semibold leading-relaxed">
                {t('hero.bodyEmphasis')}
              </p>
              <div className="mt-7 flex flex-col items-start gap-3">
                <CompareLink label={t('hero.compareLink')} />
                <p className="text-sm text-white/45 font-medium">{t('hero.reassurance')}</p>
              </div>
              <a
                href="#why-cairnly"
                onClick={scrollToNext}
                className="group mt-10 inline-flex items-center gap-2.5 text-[13px] font-semibold text-white/70 hover:text-white"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full border border-white/25 transition-colors group-hover:border-[#D4A024] group-hover:text-[#D4A024]">
                  <ArrowDown size={15} strokeWidth={2.4} className="animate-bounce" />
                </span>
                {t('hero.scrollCue')}
              </a>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
