import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import DemoStage from '@/components/landing/demo/DemoStage';
import { HeroPersonaProvider } from '@/components/landing/demo/HeroPersonaContext';
import { trackCtaClick } from '@/lib/analytics';
import { PARTNER_DEMO_PERSONA, PARTNER_DEMO_SEARCH, partnerDemoLink, SAMPLE_ROUTE } from './constants';
import CandidateStartWindow from './CandidateStartWindow';
import PartnerChatPanel from './prechat/PartnerChatPanel';
import { usePartnerChat } from './prechat/usePartnerChat';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';

/**
 * The /partners hero: headline, a two-line subtext, and one screen with two
 * columns (reorg of 2026-10-06, after a mockup Sjoerd approved).
 *
 * Left, the main element: the pre-chat in a blue-glass panel. A practitioner
 * arrives with "does it belong in my practice?", and the chat is the only
 * thing on the page that answers that and asks for something back, so it
 * sits where the eye lands. It used to start more than a screen down.
 *
 * Right, supporting: the demo deck (chat and dashboard, Marcel) and the two
 * ways into the demo. The rating pills moved down to the deliverables in
 * "Zie het werken", next to the cards that explain them. The
 * session brief that sat beside the deck moved to "Zie het werken" under the
 * hero. Once the pitch lands, the column under the demo shows the candidate's
 * start page: the offer card says "your own start page", this shows it.
 *
 * The two eyebrows (gold for the check, grey for the demo) share one line,
 * and the glass panel starts level with the top of the deck.
 *
 * Every click into the deck or a CTA carries `?p=partners`, so the demo's own
 * CTAs point at the pilot call and its PDF is the white-label template.
 */
const PartnersHero: React.FC = () => {
  const { t, i18n } = useTranslation('partners');
  const lang = (i18n.language || 'nl').slice(0, 2) === 'en' ? 'en' : 'nl';
  const chat = usePartnerChat(lang);
  const pitched = chat.stage === 'pitched';

  return (
    <section className="relative bg-[#213F4F] text-white pt-14 md:pt-20 pb-20 md:pb-24 overflow-hidden">
      {/* Two soft blooms: the glass panel needs something behind it to read as glass. */}
      <div
        className="absolute -top-64 -right-64 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{ background: 'rgba(39,161,161,0.15)', filter: 'blur(120px)' }}
      />
      <div
        className="absolute top-[30%] -left-64 w-[720px] h-[720px] rounded-full pointer-events-none"
        style={{ background: 'rgba(212,160,36,0.10)', filter: 'blur(120px)' }}
      />
      <div className="lp-container relative z-10">
        <div className="relative">
          <Reveal as="div">
            <h1
              className="font-heading font-bold leading-[1.15] text-white"
              style={{ fontSize: 'clamp(28px, 3.4vw, 48px)', letterSpacing: '-0.015em', maxWidth: 820 }}
            >
              {t('hero.title')}
            </h1>
          </Reveal>
          {/* Absolute, so a portrait watermark cannot stretch the header row.
              It lands in the space the 820px headline leaves on the right. */}
          <img
            src={CairnSymbolInvert}
            alt=""
            aria-hidden="true"
            className="hidden lg:block absolute right-0 top-[-8px] w-[100px] xl:w-[112px] h-auto opacity-[0.10] pointer-events-none"
          />
        </div>

        {/* Hidden on a phone: there it ran five lines and pushed the chat's
            starters below the fold, and the chat says the same in its reply. */}
        <Reveal as="div" className="mt-5 max-w-3xl hidden md:block">
          <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed">{t('hero.body')}</p>
        </Reveal>

        <HeroPersonaProvider fixed={PARTNER_DEMO_PERSONA} baseSearch={PARTNER_DEMO_SEARCH}>
          <div className="mt-8 md:mt-10 grid items-start lg:grid-cols-12 gap-x-10 xl:gap-x-14 gap-y-12">
            {/* The check. First in DOM order, so a phone shows it before the demo. */}
            <div id="praktijk-check" className="lg:col-span-7 scroll-mt-24 min-w-0">
              <p className="mb-3 text-[11px] font-heading font-bold tracking-[0.18em] uppercase text-[#EFBE48]">
                {t('prechat.eyebrow')}
              </p>
              <PartnerChatPanel chat={chat} />
            </div>

            <div className="lg:col-span-5 min-w-0">
              {/* step=24: with two windows the dashboard has to peek out far
                  enough to read as a second screen, not as a drop shadow. */}
              <DemoStage screens={['chat', 'dashboard']} showToggle={false} step={24} />

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  to={partnerDemoLink()}
                  onClick={() => trackCtaClick('partners_demo_chat')}
                  className="lp-btn-primary lp-btn-ghost"
                >
                  {t('hero.demoCta')}
                  <ArrowRight size={18} strokeWidth={2.4} />
                </Link>
                <Link
                  to={SAMPLE_ROUTE}
                  onClick={() => trackCtaClick('partners_sample')}
                  className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-white/80 underline decoration-white/40 underline-offset-4 hover:text-white hover:decoration-white"
                >
                  {t('hero.sampleCta')}
                  <ArrowUpRight size={15} strokeWidth={2.4} />
                </Link>
              </div>

              {pitched && (
                <div className="mt-14">
                  <p className="mb-3 text-[11px] font-heading font-bold tracking-[0.18em] uppercase text-white/55">
                    {t('hero.startEyebrow')}
                  </p>
                  <CandidateStartWindow />
                  <p className="mt-3 text-[13px] leading-relaxed text-white/65">{t('hero.startCaption')}</p>
                </div>
              )}
            </div>
          </div>
        </HeroPersonaProvider>
      </div>
    </section>
  );
};

export default PartnersHero;
