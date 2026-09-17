import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Globe } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import DemoStage from '@/components/landing/demo/DemoStage';
import { HeroPersonaProvider } from '@/components/landing/demo/HeroPersonaContext';
import { demoSessionLanguage } from '@/demo/loadFixture';
import { trackCtaClick } from '@/lib/analytics';
import { tArray } from '@/lib/i18nArray';
import { PARTNER_DEMO_PERSONA, PARTNER_DEMO_SEARCH, partnerDemoLink, SAMPLE_ROUTE } from './constants';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';

/**
 * Dark hero on the teal-navy canvas (#213F4F, the app's --background), same
 * atmospheric treatment as the Starter and Encore heroes so the partner page
 * reads as part of the site rather than a bolt-on.
 *
 * The proof is the demo deck: two faux-browser windows (chat and dashboard,
 * minus the job-search screen, because a bureau buys the assessment, the
 * coach and the report). Beside it sits a brief on the session, then the
 * two CTAs.
 *
 * Pinned to Marcel (2026-09-17). It used to render the homepage's Emma /
 * Marcel persona cards with a toggle, which asked a professional buyer to
 * pick a fictional candidate and then ignored the answer: both CTAs here
 * call partnerDemoLink(), which has always hardcoded PARTNER_DEMO_PERSONA.
 * "Which one is you" is a consumer move; a bureau wants the candidate that
 * looks like its caseload, and constants.ts already decided that is Marcel.
 * Dropping the cards also lifts the CTAs to eye level instead of below the
 * whole stage block.
 *
 * Gold belongs to the pilot booking (see landing.css on .lp-btn-gold), so
 * the sample report takes the teal primary and the demo link is an outline
 * beside it. Every click into the deck or a CTA carries `?p=partners`, so
 * the demo's own CTAs point at the pilot call and its PDF is the white-label
 * template.
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

        <HeroPersonaProvider fixed={PARTNER_DEMO_PERSONA} baseSearch={PARTNER_DEMO_SEARCH}>
          {/* Deck right, brief left; deck first in DOM order so phones see the
              picture before the words about it.

              Even 6/6 at the lg breakpoint, 5/7 only from xl: at 5/12 the text
              column is 352px and the Dutch sample-report label wraps its pill
              button onto two lines. */}
          <div className="mt-12 grid items-start lg:grid-cols-12 gap-x-12 xl:gap-x-16 gap-y-10">
            <div className="lg:col-span-6 lg:col-start-7 xl:col-span-7 xl:col-start-6 lg:row-start-1 lg:self-stretch">
              <Reveal as="div" className="lg:h-full">
                <DemoStage screens={['chat', 'dashboard']} showToggle={false} />
              </Reveal>
            </div>
            <div className="lg:col-span-6 xl:col-span-5 lg:col-start-1 lg:row-start-1">
              <Reveal as="div">
                <SessionBrief t={t} />
              </Reveal>
            </div>
          </div>
        </HeroPersonaProvider>
      </div>
    </section>
  );
};

/**
 * What the visitor is looking at, and the two ways in. Same substance as the
 * persona card it replaces (who, intent, what the session shows), minus the
 * "pick one of us" framing, and rendered straight onto the dark canvas
 * rather than on a light card that read as a button.
 */
interface SessionBriefProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const SessionBrief: React.FC<SessionBriefProps> = ({ t }) => {
  const persona = PARTNER_DEMO_PERSONA;
  const sees = tArray<string>(t, `heroDemo.cards.${persona}.see`);
  const traits = tArray<string>(t, `heroDemo.cards.${persona}.traits`);
  const sessionLang = demoSessionLanguage(persona);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#D4A024]">
          {t('hero.stageEyebrow')}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase text-white/70"
          title={t(`heroDemo.sessionLanguage.${sessionLang}`)}
        >
          <Globe size={11} strokeWidth={2.2} />
          {sessionLang.toUpperCase()}
        </span>
      </div>

      <p className="mt-3 font-heading font-bold text-white text-[17px] md:text-[18px] leading-snug">
        {t(`heroDemo.cards.${persona}.who`)}
      </p>
      <p className="mt-1.5 text-[14px] md:text-[15px] italic text-white/60 leading-snug">
        {t(`heroDemo.cards.${persona}.intent`)}
      </p>

      <p className="mt-6 text-[10px] font-bold tracking-[0.2em] uppercase text-[#4FC3C3]">
        {t(`heroDemo.cards.${persona}.seeLabel`)}
      </p>
      <ul className="mt-2 space-y-1 text-[14px] md:text-[15px] text-white/85 font-medium leading-snug">
        {sees.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true" className="text-[#D4A024] mt-[1px]">
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {traits.map((trait) => (
          <span
            key={trait}
            className="rounded-full border border-white/25 px-2.5 py-0.5 text-[11px] font-semibold text-white/65"
          >
            {trait}
          </span>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-start gap-3">
        <Link to={SAMPLE_ROUTE} onClick={() => trackCtaClick('partners_sample')} className="lp-btn-primary">
          {t('hero.sampleCta')}
          <ArrowRight size={18} strokeWidth={2.4} />
        </Link>
        <Link
          to={partnerDemoLink()}
          onClick={() => trackCtaClick('partners_demo_chat')}
          className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-[15px] font-bold text-white/85 transition-colors hover:border-white hover:text-white"
        >
          {t('hero.demoCta')}
          <ArrowUpRight size={16} strokeWidth={2.4} />
        </Link>
      </div>

      <p className="mt-6 text-[13.5px] text-white/55 font-medium leading-relaxed">{t('hero.stageCaption')}</p>
    </div>
  );
};

export default PartnersHero;
