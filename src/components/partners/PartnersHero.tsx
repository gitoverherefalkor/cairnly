import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import DemoStage from '@/components/landing/demo/DemoStage';
import { HeroPersonaProvider } from '@/components/landing/demo/HeroPersonaContext';
import { trackCtaClick } from '@/lib/analytics';
import { PARTNER_DEMO_PERSONA, PARTNER_DEMO_SEARCH, partnerDemoLink, SAMPLE_ROUTE } from './constants';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';

/**
 * Dark hero on the teal-navy canvas (#213F4F, the app's --background), same
 * atmospheric treatment as the Starter and Encore heroes so the partner page
 * reads as part of the site rather than a bolt-on.
 *
 * The proof is the same demo deck the homepage uses, pinned to Marcel (the
 * Dutch candidate) and without the job search: a bureau buys the assessment,
 * the coach and the report, the job-landing toolkit is the consumer's story.
 * Every click into the deck carries `?p=partners`, so the demo's CTAs point
 * at the pilot call and its PDF is the white-label template.
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
          <HeroPersonaProvider fixed={PARTNER_DEMO_PERSONA} baseSearch={PARTNER_DEMO_SEARCH}>
            <DemoStage screens={['chat', 'dashboard']} showToggle={false} label={t('hero.stageLabel')} />
          </HeroPersonaProvider>
          <p className="mt-4 text-[14px] text-white/55 font-medium leading-relaxed">{t('hero.stageCaption')}</p>
        </Reveal>

        <Reveal as="div" className="mt-8 flex flex-wrap items-center gap-4">
          <Link to={SAMPLE_ROUTE} onClick={() => trackCtaClick('partners_sample')} className="lp-btn-primary">
            {t('hero.sampleCta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </Link>
          <Link
            to={partnerDemoLink()}
            onClick={() => trackCtaClick('partners_demo_chat')}
            className="lp-btn-primary lp-btn-gold"
          >
            {t('hero.demoCta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </Link>
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersHero;
