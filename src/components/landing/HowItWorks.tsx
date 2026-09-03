import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import Reveal from './Reveal';
import ScreenshotSlot from './ScreenshotSlot';
import WorkflowDiagramSimple from './WorkflowDiagramSimple';
import CairnProgress from '@/components/survey/CairnProgress';
import { tArray } from '@/lib/i18nArray';
import { trackCtaClick } from '@/lib/analytics';
import { DEMO_DASHBOARD_ROUTE, DEMO_JOBS_ROUTE, DEMO_ROUTE, DEMO_SURVEY_ROUTE } from '@/demo/constants';
import { useDemoHref } from './demo/HeroPersonaContext';

interface StepCopy {
  eyebrow: string;
  body: string;
  extra?: string;
  extraEmphasis?: string;
  extraLink?: string;
  screenshotMeta?: string;
  screenshotAlt?: string;
  screenshotLabel?: string;
  screenshotDesc?: string;
}

/** A step's door into the public demo: the screen this step produces. */
interface DemoEntry {
  slug: 'survey' | 'chat' | 'dashboard' | 'jobs';
  route: string;
}

const HowItWorks: React.FC = () => {
  const { t } = useTranslation('landing');
  const demoHref = useDemoHref();
  const [activeStep, setActiveStep] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const stepTitles = tArray<string>(t, 'howItWorks.stepTitles');
  const steps = tArray<StepCopy>(t, 'howItWorks.steps');

  // The active step is the last row whose top has scrolled past a reference
  // line ~42% down the viewport. A scroll computation (rather than a
  // visibility-threshold observer) keeps tracking reliable even for step rows
  // that are taller than the viewport.
  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * 0.42;
      let active = 0;
      rowRefs.current.forEach((row, i) => {
        if (row && row.getBoundingClientRect().top <= line) active = i;
      });
      setActiveStep(active);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const activeCount = activeStep + 1;

  const Step: React.FC<{
    idx: number;
    eyebrow: string;
    body: React.ReactNode;
    visual: React.ReactNode;
    imageLeft: boolean;
    extra?: React.ReactNode;
    demo?: DemoEntry;
  }> = ({ idx, eyebrow, body, visual, imageLeft, extra, demo }) => {
    const copy = (
      <div className={`md:col-span-7 ${imageLeft ? 'order-1 md:order-2' : ''}`}>
        <div className="flex items-center gap-4 mb-4">
          <span className="font-heading font-bold text-[#C9B690] text-[60px] leading-none">
            {String(idx + 1).padStart(2, '0')}
          </span>
          <span className="text-[#1F8282] font-bold text-[11px] tracking-[0.22em] uppercase">{eyebrow}</span>
        </div>
        <p className="text-[17px] text-[#4B6373] font-medium leading-relaxed max-w-xl">{body}</p>
        {extra}
      </div>
    );
    // The demo pill sits bottom-left; the slot's own zoom button owns bottom-right.
    const visualCol = (
      <div className={`md:col-span-5 ${imageLeft ? 'order-2 md:order-1' : ''}`}>
        {demo ? (
          <div className="relative">
            {visual}
            <Link
              to={demoHref(demo.route)}
              onClick={() => trackCtaClick(`howitworks_demo_${demo.slug}`)}
              className="absolute bottom-3 left-3 z-[3] inline-flex items-center gap-1.5 rounded-full bg-[#D4A024] text-[#122E3B] px-3.5 py-1.5 text-[12px] font-bold shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] hover:bg-[#C08F1B] transition-colors"
            >
              {t('howItWorks.demoLabel')}
              <ArrowRight size={13} strokeWidth={2.6} />
            </Link>
          </div>
        ) : (
          visual
        )}
      </div>
    );
    return (
      <div
        ref={(el) => (rowRefs.current[idx] = el)}
        data-step={idx}
        className="grid md:grid-cols-12 gap-8 items-center"
      >
        {imageLeft ? <>{visualCol}{copy}</> : <>{copy}{visualCol}</>}
      </div>
    );
  };

  return (
    <section id="how-it-works" className="bg-[#ECE4D2] py-24 md:py-32 scroll-mt-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-16">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('howItWorks.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            {t('howItWorks.titleA')} <span className="lp-text-teal-grad">{t('howItWorks.titleHighlight')}</span>{t('howItWorks.titleB')}
          </h2>
          <p className="mt-6 text-lg text-[#4B6373] font-medium leading-relaxed max-w-2xl">
            {t('howItWorks.subtitle')}
          </p>
        </Reveal>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-10">
          {/* Sticky cairn rail */}
          <aside className="hidden lg:block col-span-2">
            <div className="lp-cairn-rail">
              <div className="lp-cairn-rail__label mb-1" style={{ color: '#27A1A1' }}>
                {t('howItWorks.stickyLabel', { n: activeCount })}
              </div>
              <div className="text-[12px] font-medium text-[#6B7F8B] mb-6 leading-snug">
                {stepTitles[activeStep]}
              </div>
              {/* Brand-icon cairn — one stone per step (5 steps = 5 stones),
                  gold capstone on the final step. Same asset set the survey
                  progress cairn uses (/public/cairn). */}
              <CairnProgress
                key={activeCount}
                filled={activeCount}
                crowned={activeCount >= 5}
                animate={activeCount >= 5 ? 'crown' : 'stone'}
                width={104}
                className="mx-auto"
              />
            </div>
          </aside>

          {/* Steps. 1, 3, 4 and 5 each open the demo screen they produce. */}
          <div className="col-span-12 lg:col-span-10 space-y-20 md:space-y-24">
            <Step
              idx={0}
              eyebrow={steps[0]?.eyebrow}
              imageLeft
              body={steps[0]?.body}
              demo={{ slug: 'survey', route: DEMO_SURVEY_ROUTE }}
              visual={
                <ScreenshotSlot
                  aspect="aspect-[4/3]"
                  meta={steps[0]?.screenshotMeta}
                  src="/images/live/landing/take_assessment_jun26.png"
                  alt={steps[0]?.screenshotAlt}
                />
              }
            />
            <Step
              idx={1}
              eyebrow={steps[1]?.eyebrow}
              imageLeft={false}
              body={steps[1]?.body}
              extra={
                <>
                  <p className="text-[15px] text-[#6B7F8B] font-medium leading-relaxed max-w-xl mt-4">
                    {steps[1]?.extra}{' '}
                    <span className="text-[#122E3B] font-semibold">{steps[1]?.extraEmphasis}</span>
                  </p>
                  <a
                    href="#methodology"
                    className="inline-flex items-center gap-1.5 mt-3 text-[14px] font-semibold text-[#1F8282] hover:text-[#122E3B] transition-colors group"
                  >
                    {steps[1]?.extraLink}
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </a>
                </>
              }
              visual={<WorkflowDiagramSimple />}
            />
            <Step
              idx={2}
              eyebrow={steps[2]?.eyebrow}
              imageLeft
              body={steps[2]?.body}
              demo={{ slug: 'chat', route: DEMO_ROUTE }}
              visual={
                <ScreenshotSlot
                  aspect="aspect-[4/3]"
                  meta={steps[2]?.screenshotMeta}
                  src="/images/live/landing/chat_with_coach_sep26.jpg"
                  alt={steps[2]?.screenshotAlt}
                />
              }
            />
            <Step
              idx={3}
              eyebrow={steps[3]?.eyebrow}
              imageLeft={false}
              body={steps[3]?.body}
              demo={{ slug: 'dashboard', route: DEMO_DASHBOARD_ROUTE }}
              visual={
                <ScreenshotSlot
                  aspect="aspect-[4/3]"
                  meta={steps[3]?.screenshotMeta}
                  src="/images/live/landing/get_report_sep26.jpg"
                  alt={steps[3]?.screenshotAlt}
                />
              }
            />
            <Step
              idx={4}
              eyebrow={steps[4]?.eyebrow}
              imageLeft
              body={steps[4]?.body}
              demo={{ slug: 'jobs', route: DEMO_JOBS_ROUTE }}
              extra={
                <p className="mt-5 text-[13px] text-[#D4A024] font-bold flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={2} />
                  {steps[4]?.extra}
                </p>
              }
              visual={
                <ScreenshotSlot
                  aspect="aspect-[4/3]"
                  meta={steps[4]?.screenshotMeta}
                  src="/images/live/landing/land_the_job_sep26.jpg"
                  alt={steps[4]?.screenshotAlt || steps[4]?.screenshotLabel}
                />
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
