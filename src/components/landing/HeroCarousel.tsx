import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useIntent, type IntentKey } from '@/contexts/IntentContext';
import { useIntakeChatOptional } from './intake/IntakeChatContext';
import { INTAKE_SHOT_ALT, INTAKE_SHOT_SRC, intakeShotFor, type IntakeShot } from './intake/intakeSlides';

// Each slide is a real product screen from the persona captures in
// public/images/live/landing/intake/ — the SAME set the intake chat pins per
// beat, so resting rotation and chat pinning share one index space. `slug`
// mirrors the app route that page lives at (see src/App.tsx), so the fake
// browser URL bar reads like the actual product: app.cairnly.io/<slug>.
interface Slide {
  src: string;
  slug: string;
  alt: string;
}

/** Rotation order at rest; also the index space for beat pinning. */
const SHOT_ORDER: IntakeShot[] = ['dashboard', 'ai-impact', 'jobs-avoids', 'salary-steps', 'key-insight', 'radar'];
const SHOT_SLUG: Record<IntakeShot, string> = {
  dashboard: 'dashboard',
  'ai-impact': 'chat',
  'jobs-avoids': 'jobs',
  'salary-steps': 'dashboard',
  'key-insight': 'chat',
  radar: 'dashboard',
};
const SLIDES: Slide[] = SHOT_ORDER.map((shot) => ({
  src: INTAKE_SHOT_SRC[shot],
  slug: SHOT_SLUG[shot],
  alt: INTAKE_SHOT_ALT[shot],
}));

const ROTATE_MS = 4000;

/**
 * Which slide best answers each "what brings you here?" pill. Clicking a
 * pill jumps the carousel there and the conversation freeze keeps it up.
 */
const INTENT_SLIDE: Record<IntentKey, number> = {
  default: 0, // dashboard close-up — what you'd choose now, scored
  'good-at-it': 5, // radar comparison — is the current fit still the best fit
  'ai-worried': 1, // coach explaining how AI hits a specific role
  'life-changed': 0, // dashboard close-up — the next chapter, scored
  'understand-myself': 4, // coach key insight — the self-understanding work
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
  // The conversation's own intent wins: "Something else" starts an 'other'
  // conversation while the pill intent (IntentContext) can lag behind.
  const chatIntent = intake?.intent ?? intent;
  // While the chat runs the carousel holds still (auto-rotation is
  // distracting mid-conversation); the visitor may still flip slides by hand.
  // `sending` counts too: it flips true the instant a pill is clicked, so a
  // stray rotation tick can't shove the pill-matched slide aside while the
  // opener is still on its way.
  const chatRunning = !!intake && ((intake.started && intake.stage === 'chat') || intake.sending);
  // A beat with a specific screen pins it; null beats leave the slide alone,
  // so the pill-matched screen stays up through the early questions.
  const beatShot = chatRunning && intake?.beat ? intakeShotFor(chatIntent, intake.beat) : null;
  const pinned = beatShot ? SHOT_ORDER.indexOf(beatShot) : null;

  // A pill click jumps the carousel to that intent's most relevant screen.
  // Deliberately NOT re-run when `pinned` clears: a beat without a specific
  // screen keeps whatever is showing rather than snapping back.
  useEffect(() => {
    setActive(INTENT_SLIDE[intent] ?? 0);
  }, [intent]);

  useEffect(() => {
    if (pinned !== null) setActive(pinned);
  }, [pinned]);

  useEffect(() => {
    reduceMotion.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  useEffect(() => {
    if (paused || chatRunning || reduceMotion.current) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, chatRunning]);

  const slug = (SLIDES[active] ?? SLIDES[0]).slug;

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
          {SLIDES.map((s, i) => (
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

      {/* Progress indicators. Manual flipping stays available during the
          chat; only the auto-rotation stops. The next beat with a specific
          screen simply re-pins over whatever the visitor picked. */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show ${s.slug} screenshot`}
            aria-current={i === active}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-7 bg-[#D4A024]' : 'w-4 bg-white/20 hover:bg-white/35'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroCarousel;
