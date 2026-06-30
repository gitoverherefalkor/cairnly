import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

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
    src: '/images/landing/carousel/assessment-welcome.jpg',
    slug: 'assessment',
    alt: 'Cairnly assessment welcome screen',
  },
  {
    src: '/images/landing/carousel/assessment-resume.jpg',
    slug: 'assessment',
    alt: 'Resume upload step in the Cairnly assessment',
  },
  {
    src: '/images/landing/carousel/assessment-section.jpg',
    slug: 'assessment',
    alt: 'A section transition inside the Cairnly assessment',
  },
  {
    src: '/images/landing/carousel/report-careermap.jpg',
    slug: 'dashboard',
    alt: 'Career report with the career match map',
  },
  {
    src: '/images/landing/carousel/coach-chat.jpg',
    slug: 'chat',
    alt: 'Chatting with the Cairnly career coach',
  },
  {
    src: '/images/landing/carousel/jobs-pipeline.jpg',
    slug: 'jobs',
    alt: 'Job pipeline tracking saved and applied roles',
  },
];

const ROTATE_MS = 4000;

/**
 * Hero product preview rendered as a faux browser window whose screenshot
 * rotates every 4s. The URL bar updates to the active page's real slug.
 * Pauses on hover and honours prefers-reduced-motion.
 */
const HeroCarousel: React.FC = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  useEffect(() => {
    if (paused || reduceMotion.current) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const slug = SLIDES[active].slug;

  return (
    <div
      className="select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Faux browser window */}
      <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-[#15262F]">
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

      {/* Progress indicators */}
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
