import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Briefcase } from 'lucide-react';
import Reveal from './Reveal';
import ScreenshotSlot from './ScreenshotSlot';
import WorkflowDiagram from './WorkflowDiagram';

const STEP_TITLES = [
  'Take the assessment',
  'AI analyzes you',
  'Chat with the coach',
  'Get your report',
  'Land the job',
];

// Stone pill widths, bottom (index 0, widest) to capstone (index 4, narrowest).
const STONE_WIDTHS = [74, 62, 51, 41, 29];

const HowItWorks: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

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
  }> = ({ idx, eyebrow, body, visual, imageLeft, extra }) => {
    const copy = (
      <div className={`md:col-span-7 ${imageLeft ? 'order-1 md:order-2' : ''}`}>
        <div className="flex items-center gap-4 mb-4">
          <span className="font-heading font-black text-[#C9B690] text-[60px] leading-none">
            {String(idx + 1).padStart(2, '0')}
          </span>
          <span className="text-[#1F8282] font-bold text-[11px] tracking-[0.22em] uppercase">{eyebrow}</span>
        </div>
        <p className="text-[17px] text-[#4B6373] font-medium leading-relaxed max-w-xl">{body}</p>
        {extra}
      </div>
    );
    const visualCol = (
      <div className={`md:col-span-5 ${imageLeft ? 'order-2 md:order-1' : ''}`}>{visual}</div>
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
          <div className="lp-eyebrow text-[#1F8282] mb-5">Chapter 02 · The path</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            From assessment to <span className="lp-text-teal-grad">action</span>.
          </h2>
          <p className="mt-6 text-lg text-[#4B6373] font-medium leading-relaxed max-w-2xl">
            Five steps, from where you are now to actually landing the job. Concrete career paths
            that fit who you've become, not who you thought you'd be.
          </p>
        </Reveal>

        <div className="grid grid-cols-12 gap-x-10">
          {/* Sticky cairn rail */}
          <aside className="hidden lg:block col-span-2">
            <div className="lp-cairn-rail">
              <div className="lp-cairn-rail__label mb-1" style={{ color: '#27A1A1' }}>
                {`Step ${activeCount} of 5`}
              </div>
              <div className="text-[12px] font-medium text-[#6B7F8B] mb-6 leading-snug">
                {STEP_TITLES[activeStep]}
              </div>
              <div className="flex flex-col items-center gap-[6px]">
                {[4, 3, 2, 1, 0].map((i) => {
                  const active = i < activeCount;
                  const cap = i === 4;
                  return (
                    <div
                      key={i}
                      style={{
                        width: STONE_WIDTHS[i],
                        height: 13,
                        borderRadius: 9999,
                        background: active
                          ? cap
                            ? '#D4A024'
                            : '#1F8282'
                          : 'rgba(18,46,59,0.13)',
                        transition: 'background 500ms cubic-bezier(0.16,1,0.3,1)',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Steps */}
          <div className="col-span-12 lg:col-span-10 space-y-20 md:space-y-24">
            <Step
              idx={0}
              eyebrow="Take the assessment"
              imageLeft
              body="A guided set of questions about your background, skills, work style, values, and what's actually energized or drained you so far. Designed to capture what matters for career fit. Not just personality traits."
              visual={
                <ScreenshotSlot
                  aspect="aspect-[4/3]"
                  meta="4 : 3 · Assessment"
                  src="/images/landing/step1-assessment.png"
                  alt="Assessment question about working in teams"
                />
              }
            />
            <Step
              idx={1}
              eyebrow="AI analyzes your profile"
              imageLeft={false}
              body={
                <>
                  Seven AI workflows, built and tuned with working career coaches, read your
                  responses end to end. They build your personality and values profile, match you
                  to specific roles, score AI-impact, and write personalized justifications.
                </>
              }
              extra={
                <p className="text-[15px] text-[#6B7F8B] font-medium leading-relaxed max-w-xl mt-4">
                  Not a ChatGPT prompt you could write yourself. Not a vibe-coded weekend project.{' '}
                  <span className="text-[#122E3B] font-semibold">The methodology is the moat.</span>
                </p>
              }
              visual={<WorkflowDiagram />}
            />
            <Step
              idx={2}
              eyebrow="Chat with your AI coach"
              imageLeft
              body="Discuss your results one-on-one. Ask follow-ups, explore specific roles in depth, push back when something doesn't fit. You'll get honest answers about trade-offs and next steps. Not flattery."
              visual={
                <ScreenshotSlot
                  aspect="aspect-[4/3]"
                  meta="4 : 3 · Coach chat"
                  src="/images/landing/hero-ai-coach.png"
                  alt="AI coaching session with your personality profile"
                />
              }
            />
            <Step
              idx={3}
              eyebrow="Get your report"
              imageLeft={false}
              body="Your finished report, refined by the chat: personality and values analysis, every career recommendation, salary data, AI-impact ratings, and concrete next steps."
              visual={
                <ScreenshotSlot
                  aspect="aspect-[4/3]"
                  meta="4 : 3 · Career report"
                  src="/images/landing/step4-dashboard.png"
                  alt="The Cairnly dashboard with career signature and top matches"
                />
              }
            />
            <Step
              idx={4}
              eyebrow="Land the job"
              imageLeft
              body="Pick the roles that resonate. Cairnly finds live openings for them. When you apply, your resume and cover letter are tailored using everything Cairnly already knows about you. No prompting required."
              extra={
                <p className="mt-5 text-[13px] text-[#D4A024] font-extrabold flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={2} />
                  The job-landing features are in beta and free to unlock.
                </p>
              }
              visual={
                <div className="lp-screenshot-slot lp-screenshot-slot--placeholder aspect-[4/3] w-full">
                  <div className="lp-screenshot-slot__meta">4 : 3 · Job match</div>
                  <div className="lp-screenshot-slot__inner">
                    <Briefcase size={36} strokeWidth={1.5} />
                    <div className="lp-screenshot-slot__label">Live openings, tailored materials</div>
                    <div className="lp-screenshot-slot__desc">Coming once the beta job-landing flow ships.</div>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
