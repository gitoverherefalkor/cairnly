import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Reveal from './Reveal';
import HeroCarousel from './HeroCarousel';
import IntentChips from './IntentChips';
import { useGetStarted } from './useGetStarted';
import { useIntentCopy } from './useIntentCopy';
import IntakeChatPanel from './intake/IntakeChatSection';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';

/**
 * Hero + intake chat as one continuous section on the app's nature
 * background (survey-bg starts navy at the top, so the header area stays
 * dark). Left column: copy, intent pills, then the product carousel + CTA.
 * Right column: the intake chat, directly beside the pills that seed it,
 * overlapping the semi-transparent cairn mark.
 */
const Hero: React.FC = () => {
  const getStarted = useGetStarted();
  const { t } = useTranslation('landing');
  const { vt, intent } = useIntentCopy();

  return (
    <section className="survey-bg relative text-white pt-12 md:pt-16 pb-16 md:pb-20 overflow-hidden">
      {/* Atmospheric teal bloom */}
      <div
        className="absolute -top-64 -right-64 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{ background: 'rgba(39,161,161,0.15)', filter: 'blur(120px)' }}
      />
      {/* Cairn mark behind the chat column */}
      <div className="absolute bottom-6 right-[-20px] pointer-events-none z-0 hidden lg:block">
        <img src={CairnSymbolInvert} alt="" aria-hidden="true" className="w-[280px] h-auto opacity-[0.08]" />
      </div>

      <div className="lp-container relative z-10">
        {/* Everything the pill controls sits together: pills + chat on the
            left, headline / copy / product screenshot reacting on the right.
            DOM order keeps the mobile flow: headline -> pills -> chat -> proof. */}
        <div className="grid items-start lg:grid-cols-12 gap-x-12 xl:gap-x-16 gap-y-10">
          {/* Headline + body (desktop: right column, row 1) */}
          <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1">
            {/* min-height reserves 3 title lines on md+ so the blocks below
                don't jump when a variant's H1 wraps to 2 vs 3 lines */}
            <Reveal
              as="div"
              className="font-heading font-bold leading-[1.15] text-white md:min-h-[3.45em]"
              style={{ fontSize: 'clamp(28px, 3.2vw, 44px)', letterSpacing: '-0.015em' }}
            >
              {/* key={intent} remounts the text so the fade plays on chip switch */}
              <h1 key={intent} className="lp-intent-fade">
                {vt('hero.titleA')} <span className="lp-text-gold-grad">{vt('hero.titleHighlight')}</span>
                {/* life-changed's titleB is a short standalone clause; force it onto its own row
                    instead of letting the browser split it mid-sentence at this width */}
                {intent === 'life-changed' ? <br /> : ' '}
                {vt('hero.titleB')}
              </h1>
            </Reveal>

            {/* same trick for the body copy: variants run 3-4 lines */}
            <Reveal as="div" className="mt-6 max-w-2xl md:min-h-[122px]">
              <p key={intent} className="lp-intent-fade text-base md:text-lg text-white/65 font-medium leading-relaxed">
                {vt('hero.body')}{' '}
                <span className="text-white font-semibold">
                  {vt('hero.bodyEmphasis')}
                </span>
              </p>
            </Reveal>
          </div>

          {/* Pills + chat as ONE left block (spans both rows, so the chat sits
              tight under its pills regardless of the right column's height) */}
          <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <Reveal className="flex items-center gap-3 mb-6">
              <span className="text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
                {t('hero.eyebrow')}
              </span>
              <span className="h-px w-12 bg-[#D4A024]/40" />
            </Reveal>
            <Reveal as="div">
              <IntentChips />
            </Reveal>
            <Reveal as="div" className="mt-8">
              <IntakeChatPanel />
            </Reveal>
          </div>

          {/* Product proof + CTA (desktop: right column, row 2) */}
          <Reveal as="div" className="lg:col-span-7 lg:col-start-6 lg:row-start-2">
            <HeroCarousel />
            <div className="mt-8 flex flex-col items-center gap-5">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <button onClick={getStarted} className="lp-btn-primary">
                  <span key={intent} className="lp-intent-fade">{vt('hero.ctaPrimary')}</span>
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
              </div>
              <p className="text-sm text-white/45 font-medium text-center">
                {t('hero.reassurance')}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default Hero;
