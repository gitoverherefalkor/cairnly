import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import Reveal from './Reveal';
import HeroCarousel from './HeroCarousel';
import IntentChips from './IntentChips';
import { useIntentCopy } from './useIntentCopy';
import IntakeChatPanel from './intake/IntakeChatSection';
import ReportDeliverablesCard from './intake/ReportDeliverablesCard';
import PitchScreenshot from './intake/PitchScreenshot';
import IntakeEmailHatch from './intake/IntakeEmailHatch';
import { useIntakeChatOptional } from './intake/IntakeChatContext';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';
import CairnlyLockup from '@/logos/live/cairnly_logo_wordmark_inverted_tagline.png';

/**
 * Hero + intake chat as one continuous section on the app's nature
 * background (survey-bg starts navy at the top, so the header area stays
 * dark). Left column: copy, intent pills, then the product carousel + CTA.
 * Right column: the intake chat, directly beside the pills that seed it,
 * overlapping the semi-transparent cairn mark.
 */
const Hero: React.FC = () => {
  const { t } = useTranslation('landing');
  const { vt, intent, picked } = useIntentCopy();
  const intakeChat = useIntakeChatOptional();
  // Once the chat delivers its pitch, the right column stops being a generic
  // product tour and itemizes the report the visitor is about to buy.
  const pitched = intakeChat?.stage === 'pitched';

  return (
    <section className="survey-bg relative text-white pt-10 md:pt-14 pb-16 md:pb-20 overflow-hidden">
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
        {/* Header band: the brand lockup (left) sits level with the headline
            (right). The nav stays hidden above the fold, so the page opens on
            the mark + tagline over the landscape, aligned to the H1. */}
        <div className="grid items-start lg:grid-cols-12 gap-x-12 xl:gap-x-16 gap-y-6">
          <a href="/" className="lg:col-span-5 lg:col-start-1 self-start">
            {/* -mt trims the PNG's transparent top so the letters, not the
                bounding box, line up with the H1's first line */}
            <img src={CairnlyLockup} alt="Cairnly — career path clarity" className="h-24 md:h-28 w-auto -mt-2 md:-mt-3" />
          </a>

          {/* Headline (desktop: right column, level with the logo) */}
          <div className="lg:col-span-7 lg:col-start-6">
            {/* min-height reserves 2 title lines on md+ so the rule below
                stays put when a variant's H1 wraps to 1 vs 2 lines */}
            <Reveal
              as="div"
              className="font-heading font-bold leading-[1.15] text-white md:min-h-[2.3em]"
              style={{ fontSize: 'clamp(28px, 3.2vw, 44px)', letterSpacing: '-0.015em' }}
            >
              {/* key={`${picked}-${intent}`} remounts the text so the fade plays on chip switch */}
              <h1 key={`${picked}-${intent}`} className="lp-intent-fade">
                {vt('hero.titleA')} <span className="lp-text-gold-grad">{vt('hero.titleHighlight')}</span>
                {/* life-changed's titleB is a short standalone clause; force it onto its own row
                    instead of letting the browser split it mid-sentence at this width */}
                {intent === 'life-changed' ? <br /> : ' '}
                {vt('hero.titleB')}
              </h1>
            </Reveal>
          </div>
        </div>

        {/* Eyebrow + full-width gold rule: this IS the divider between the
            header band and the content, so the first pill row and the body's
            first line start from the same edge below it. */}
        <Reveal className="flex items-center gap-3 mt-6 mb-8 md:mb-10">
          <span className="whitespace-nowrap text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
            {t('hero.eyebrow')} · {t('intentChips.prompt')}
          </span>
          <span className="h-px flex-1 bg-[#D4A024]/50" />
        </Reveal>

        {/* Content band: pills + chat on the left, body copy and the product
            proof on the right. DOM order (body, interactive, proof) keeps the
            mobile flow sensible; desktop positions are explicit. */}
        <div className="grid items-start lg:grid-cols-12 gap-x-12 xl:gap-x-16 gap-y-8 lg:gap-y-10">
          {/* Body copy (desktop: right column, row 1) */}
          <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1">
            {/* min-height keeps the carousel from jumping as body copy varies */}
            <Reveal as="div" className="max-w-2xl md:min-h-[122px]">
              <p key={`${picked}-${intent}`} className="lp-intent-fade text-base md:text-lg text-white/65 font-medium leading-relaxed">
                {vt('hero.body')}{' '}
                <span className="text-white font-semibold">
                  {vt('hero.bodyEmphasis')}
                </span>
              </p>
            </Reveal>
          </div>

          {/* Pills + chat as ONE left block (spans both rows, so the chat sits
              tight under its pills regardless of the right height) */}
          <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <Reveal as="div">
              <IntentChips />
            </Reveal>
            <Reveal as="div" className="mt-8">
              <IntakeChatPanel />
            </Reveal>
          </div>

          {/* Product proof + CTA (desktop: right column, row 2). Swaps to the
              report deliverables card once the chat pitch lands — that card
              carries its own checkout CTA, so the generic hero CTA and
              reassurance line below step aside to avoid a second, competing
              button; "See how it works" stays as the one remaining, low-key
              way to keep browsing instead of buying. */}
          <Reveal as="div" className="lg:col-span-7 lg:col-start-6 lg:row-start-2">
            {pitched ? (
              <>
                <PitchScreenshot />
                <ReportDeliverablesCard />
              </>
            ) : (
              <HeroCarousel />
            )}
            {pitched ? (
              <>
                {/* Secondary save-my-spot email, moved out of the chat thread. */}
                <IntakeEmailHatch />
                <div className="mt-5 flex justify-center">
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
              </>
            ) : (
              // The pills + chat are the CTA here; a generic "Get Started"
              // that drops straight into the signup form only invites bounces.
              // Keep just the reassurance line under the carousel.
              <p className="mt-8 text-sm text-white/45 font-medium text-center">
                {t('hero.reassurance')}
              </p>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default Hero;
