import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from '../Reveal';
import IntentChips from '../IntentChips';
import IntakeChatPanel from './IntakeChatSection';
import ReportDeliverablesCard from './ReportDeliverablesCard';
import { useIntakeChatOptional } from './IntakeChatContext';
import { useDemoHref } from '../demo/HeroPersonaContext';
import { DEMO_SURVEY_ROUTE } from '@/demo/constants';
import { trackCtaClick } from '@/lib/analytics';
import CairnSymbolInvert from '@/logos/live/cairn_symbol_invert.png';

/** Anchor for the hero's "tell us what brings you here" link (block top, not the panel). */
export const INTAKE_SECTION_ANCHOR = 'intake';

/**
 * The intake chat as a dark block inside "Is Cairnly for you?": the five
 * "what brings you here?" pills seed a short conversation with the coach
 * (and reorder the fit bullets right above), whose pitch ends in the report
 * deliverables card and its checkout button. Moved out of the hero on
 * 2026-09-03 so the hero can show the demo instead.
 */
const IntakeSection: React.FC = () => {
  const { t } = useTranslation('landing');
  const intakeChat = useIntakeChatOptional();
  const demoHref = useDemoHref();
  const pitched = intakeChat?.stage === 'pitched';

  return (
    <div
      id={INTAKE_SECTION_ANCHOR}
      className="survey-bg relative text-white rounded-[28px] overflow-hidden px-6 py-10 md:px-12 md:py-14 scroll-mt-24"
      style={{ boxShadow: '0 40px 80px -30px rgba(18,46,59,0.55)' }}
    >
      <div className="absolute bottom-4 right-[-20px] pointer-events-none z-0 hidden lg:block">
        <img src={CairnSymbolInvert} alt="" aria-hidden="true" className="w-[240px] h-auto opacity-[0.08]" />
      </div>

      <div className="relative z-10">
        <Reveal className="max-w-3xl mb-8 md:mb-10">
          <div className="lp-eyebrow text-[#D4A024] mb-4">{t('intakeSection.eyebrow')}</div>
          <h3
            className="font-heading font-bold text-white leading-[1.12]"
            style={{ fontSize: 'clamp(24px, 2.6vw, 34px)', letterSpacing: '-0.012em' }}
          >
            {t('intakeSection.title')}
          </h3>
          <p className="mt-4 text-[17px] text-white/65 font-medium leading-relaxed max-w-2xl">
            {t('intakeSection.subtitle')}
          </p>
        </Reveal>

        <Reveal as="div" className="mb-8">
          <IntentChips />
        </Reveal>

        <div className="grid items-start lg:grid-cols-12 gap-x-10 xl:gap-x-14 gap-y-8">
          <Reveal as="div" className="lg:col-span-7">
            <IntakeChatPanel />
          </Reveal>

          <Reveal as="div" className="lg:col-span-5">
            {pitched ? (
              <ReportDeliverablesCard />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-[10px] font-heading font-bold tracking-[0.2em] uppercase text-[#D4A024]">
                  {t('intakeSection.asideTitle')}
                </p>
                <p className="mt-3 text-[15px] text-white/70 font-medium leading-relaxed">
                  {t('intakeSection.asideBody')}
                </p>
              </div>
            )}
            <Link
              to={demoHref(DEMO_SURVEY_ROUTE)}
              onClick={() => trackCtaClick('intake_survey_link')}
              className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-white/75 hover:text-white underline decoration-[#D4A024]/60 underline-offset-4 hover:decoration-[#D4A024] transition-colors"
            >
              {t('intakeSection.surveyLink')}
              <ArrowRight size={14} strokeWidth={2.4} />
            </Link>
          </Reveal>
        </div>
      </div>
    </div>
  );
};

export default IntakeSection;
