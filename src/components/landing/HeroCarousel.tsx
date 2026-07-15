import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useIntent, type IntentKey } from '@/contexts/IntentContext';
import { useIntakeChatOptional } from './intake/IntakeChatContext';
import { INTAKE_SHOT_SRC, intakeShotFor, type IntakeShot } from './intake/intakeSlides';

// Each slide is a real product screen. `slug` mirrors the app route that page
// lives at (see src/App.tsx), so the fake browser URL bar reads like the
// actual product: app.cairnly.io/<slug>.
interface Slide {
  src: string;
  slug: string;
  alt: string;
}

const SLIDES: Slide[] = [
  {
    src: '/images/live/landing/carousel/assessment-welcome.jpg',
    slug: 'assessment',
    alt: 'Cairnly assessment welcome screen',
  },
  {
    src: '/images/live/landing/carousel/assessment-resume.jpg',
    slug: 'assessment',
    alt: 'Resume upload step in the Cairnly assessment',
  },
  {
    src: '/images/live/landing/carousel/assessment-section.jpg',
    slug: 'assessment',
    alt: 'A section transition inside the Cairnly assessment',
  },
  {
    src: '/images/live/landing/carousel/report-careermap.jpg',
    slug: 'dashboard',
    alt: 'Career dashboard with the career match map',
  },
  {
    src: '/images/live/landing/carousel/coach-chat.jpg',
    slug: 'chat',
    alt: 'Chatting with the Cairnly career coach',
  },
  {
    src: '/images/live/landing/carousel/jobs-pipeline.jpg',
    slug: 'jobs',
    alt: 'Job pipeline tracking saved and applied roles',
  },
];

// Intake close-ups: pinned while the intake chat runs (beat-synced via
// intakeSlides.ts), excluded from the resting rotation below.
const INTAKE_SHOT_ORDER: IntakeShot[] = ['dashboard', 'ai-impact', 'jobs-avoids', 'salary-steps', 'key-insight', 'radar'];
const INTAKE_SLIDE_SLUG: Record<IntakeShot, string> = {
  dashboard: 'dashboard',
  'ai-impact': 'chat',
  'jobs-avoids': 'jobs',
  'salary-steps': 'dashboard',
  'key-insight': 'chat',
  radar: 'dashboard',
};
const INTAKE_BASE = SLIDES.length;
const INTAKE_SLIDES: Slide[] = INTAKE_SHOT_ORDER.map((shot) => ({
  src: INTAKE_SHOT_SRC[shot],
  slug: INTAKE_SLIDE_SLUG[shot],
  alt: 'Cairnly product screen',
}));
const ALL_SLIDES = [...SLIDES, ...INTAKE_SLIDES];

const ROTATE_MS = 4000;

/**
 * Which slide best answers each "what brings you here?" pill. Clicking a
 * pill jumps the carousel there (rotation continues from that point).
 * Best match within the existing six screenshots; dedicated per-intent
 * shots (e.g. an AI-impact rating close-up for ai-worried) can slot in later.
 */
const INTENT_SLIDE: Record<IntentKey, number> = {
  default: 0, // assessment welcome — the "start over properly" story
  'good-at-it': 4, // coach chat — pressure-testing whether the fit is real
  'ai-worried': 3, // career report — paths scored incl. AI impact
  'life-changed': 3, // career report — new paths for new priorities
  'understand-myself': 2, // assessment section — the self-understanding work
};

/**
 * Hero product preview rendered as a faux browser window whose screenshot
 * rotates every 4s. The URL bar updates to the active page's real slug.
 * Pauses on hover and honours prefers-reduced-motion.
 */
const HeroCarousel: React.FC = () => {
  const { intent } = useIntent();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);

  const intake = useIntakeChatOptional();
  // While the intake chat runs, pin the screen that answers the current beat.
  const pinned =
    intake?.started && intake.stage === 'chat' && intake.beat
      ? INTAKE_BASE + INTAKE_SHOT_ORDER.indexOf(intakeShotFor(intent, intake.beat))
      : null;

  // A pill click jumps the carousel to that intent's most relevant screen;
  // once the chat is running, the beat decides instead.
  useEffect(() => {
    if (pinned === null) setActive(INTENT_SLIDE[intent] ?? 0);
  }, [intent, pinned]);

  useEffect(() => {
    if (pinned !== null) setActive(pinned);
  }, [pinned]);

  useEffect(() => {
    reduceMotion.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  useEffect(() => {
    if (paused || pinned !== null || reduceMotion.current) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, pinned]);

  const slug = ALL_SLIDES[active].slug;

  return (
    <div
      className="select-none lg:[perspective:2200px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 3D stage. The window is tilted on the Y axis (with a touch of X) so it
          reads with depth like the marketing mockup. On hover it eases toward
          flat so the screenshot is easy to read. Flat on < lg (stacked layout). */}
      <div
        className="relative transition-transform duration-500 ease-out lg:[transform-style:preserve-3d] lg:[transform:rotateY(-22deg)_rotateX(5deg)] lg:hover:[transform:rotateY(-9deg)_rotateX(2deg)]"
      >
        {/* Ghost panels stacked behind for layered depth (lg only) */}
        <div
          aria-hidden="true"
          className="hidden lg:block absolute inset-0 rounded-xl bg-white/[0.03] ring-1 ring-white/10 [transform:translateZ(-90px)_translate(46px,40px)]"
        />
        <div
          aria-hidden="true"
          className="hidden lg:block absolute inset-0 rounded-xl bg-white/[0.04] ring-1 ring-white/10 [transform:translateZ(-45px)_translate(23px,20px)]"
        />

      {/* Faux browser window */}
      <div className="relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-[#15262F]">
        {/* Chrome bar: traffic lights + URL */}
        <div className="flex items-center gap-3 px-3.5 h-9 bg-[#1B2E38] border-b border-black/30">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex items-center gap-1.5 px-3 h-6 rounded-md bg-black/25 text-white/55 text-[11px] font-medium min-w-0">
            <Lock size={11} className="shrink-0 text-white/40" />
            <span className="truncate">
              app.cairnly.io/<span className="text-white/85">{slug}</span>
            </span>
          </div>
        </div>

        {/* Screenshot stage — images crossfade in place */}
        <div className="relative aspect-[16/10] bg-[#15262F]">
          {ALL_SLIDES.map((s, i) => (
            <img
              key={s.src}
              src={s.src}
              alt={s.alt}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                i === active ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>
      </div>
      </div>

      {/* Progress indicators — always the resting six; while an intake slide
          is pinned, `active` points past the end of SLIDES so none light up. */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {SLIDES.map((s, i) => {
          const restingActive = active < SLIDES.length ? active : -1;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Show ${s.slug} screenshot`}
              aria-current={i === restingActive}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === restingActive ? 'w-7 bg-[#D4A024]' : 'w-4 bg-white/20 hover:bg-white/35'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default HeroCarousel;
