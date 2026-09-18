import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Lock, Play, RotateCcw } from 'lucide-react';
import { DEMO_ROUTE } from '@/demo/constants';
import { DEMO_HERO_VERSION } from '@/lib/demoHero.generated';
import { trackCtaClick } from '@/lib/analytics';
import { tArray } from '@/lib/i18nArray';
import { heroVideoClip, heroVideoSources } from './heroVideo';
import { useDemoHref } from './HeroPersonaContext';

/** Aspect of the recording (scripts/demo-record-hero.mjs records 1440×900). */
const VIDEO_W = 1440;
const VIDEO_H = 900;

type Phase = 'idle' | 'playing' | 'ended' | 'unavailable';

/**
 * The hero's demo window: one faux-browser frame playing the recording of
 * the persona whose session was held in the visitor's language. Plays once,
 * muted; when it ends the end card fades in over the black last frame with
 * the real "Start your session" button. Reduced motion, an off-screen
 * window and a missing file all fall back to the poster with the card.
 */
const DemoVideoStage: React.FC = () => {
  const { t, i18n } = useTranslation('landing');
  const demoHref = useDemoHref();
  const clip = heroVideoClip(i18n.language);
  const src = heroVideoSources(i18n.language, DEMO_HERO_VERSION);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reduced, setReduced] = useState(false);
  const playedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Autoplay when the window scrolls into view, pause when it leaves.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced || phase === 'unavailable') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (phase !== 'ended') el.play().catch(() => setPhase('unavailable'));
        } else if (!el.paused) el.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, phase]);

  const replay = () => {
    const el = videoRef.current;
    if (!el) return;
    trackCtaClick('hero_video_replay');
    el.currentTime = 0;
    setPhase('playing');
    el.play().catch(() => setPhase('unavailable'));
  };

  const showCard = phase === 'ended' || phase === 'unavailable' || (reduced && phase !== 'playing');

  return (
    <div className="select-none">
      <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-[#15262F] flex flex-col">
        {/* Chrome bar, same as the deck's windows on /partners */}
        <div className="flex items-center gap-3 px-3.5 h-9 shrink-0 bg-[#1B2E38] border-b border-black/30">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 flex items-center gap-1.5 px-3 h-6 rounded-md bg-black/25 text-white/55 text-[11px] font-medium min-w-0">
            <Lock size={11} className="shrink-0 text-white/40" />
            <span className="truncate">
              app.cairnly.io/<span className="text-white/85">demo</span>
            </span>
          </div>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: `${VIDEO_W} / ${VIDEO_H}` }}>
          <video
            ref={videoRef}
            className="block w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
            poster={src.poster}
            onPlay={() => {
              setPhase('playing');
              if (!playedRef.current) {
                playedRef.current = true;
                trackCtaClick('hero_video_play');
              }
            }}
            onEnded={() => {
              setPhase('ended');
              trackCtaClick('hero_video_ended');
            }}
            onError={() => setPhase('unavailable')}
            aria-label={t('hero.screenshotAlt')}
          >
            <source src={src.webm} type="video/webm" />
            <source src={src.mp4} type="video/mp4" />
          </video>

          {/* Clicking the playing video opens the demo, like the deck's front window did. */}
          {!showCard && (
            <Link
              to={demoHref(DEMO_ROUTE)}
              onClick={() => trackCtaClick('hero_video_open_demo')}
              aria-label={t('heroDemo.clickHint')}
              className="group absolute inset-0"
            >
              <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-[#D4A024] text-[#122E3B] px-2.5 py-1 text-[11px] font-bold opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {t('heroDemo.clickHint')}
                <ArrowUpRight size={12} strokeWidth={2.6} />
              </span>
            </Link>
          )}

          {/* End card: a real button, not a baked-in frame, so it stays
              clickable, translated and trackable. */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center text-center px-6 transition-opacity duration-700 ${
              showCard ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            style={{ background: 'rgba(15,37,48,0.88)' }}
            aria-hidden={!showCard}
          >
            <p className="font-heading font-bold text-white text-[clamp(15px,1.5vw,21px)] leading-snug max-w-[40ch]">
              {t('heroDemo.endCard.title')}
            </p>
            {/* The job-hunt toolkit, listed here rather than in the film: readable, translated, next to the buttons. */}
            <div className="mt-6 hidden sm:block">
              <p className="text-[12px] md:text-[13px] font-semibold text-white/75">{t('heroDemo.endCard.toolkitLabel')}</p>
              <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-left text-[12px] md:text-[13px] text-white/85 font-medium">
                {tArray<string>(t, 'heroDemo.endCard.toolkit').map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#D4A024]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={demoHref(DEMO_ROUTE)}
                onClick={() => trackCtaClick('hero_video_open_demo')}
                className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-2.5 text-[14px] font-bold text-white hover:border-white transition-colors"
              >
                {t('heroDemo.endCard.fullDemo')}
                <ArrowUpRight size={15} strokeWidth={2.6} />
              </Link>
              <Link
                to="/payment"
                onClick={() => trackCtaClick('hero_video_cta')}
                className="inline-flex items-center gap-2 rounded-full bg-[#D4A024] text-[#122E3B] px-5 py-2.5 text-[14px] font-bold hover:bg-[#E0B03A] transition-colors"
              >
                {t('heroDemo.endCard.cta')}
                <ArrowRight size={15} strokeWidth={2.6} />
              </Link>
            </div>
            {phase !== 'unavailable' && (
              <button type="button" onClick={replay} className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/60 hover:text-white">
                {reduced && phase !== 'ended' ? <Play size={13} /> : <RotateCcw size={13} />}
                {t('heroDemo.endCard.replay')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
        <span className="min-w-0 truncate text-[11px] font-heading font-bold tracking-[0.18em] uppercase text-white/55">
          {t('heroDemo.stageLabel', { name: t(`heroDemo.cards.${clip.persona}.name`) })}
        </span>
        <Link
          to={demoHref(DEMO_ROUTE)}
          onClick={() => trackCtaClick('hero_video_open_demo')}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-white/70 hover:text-white"
        >
          {t('heroDemo.endCard.fullDemo')}
          <ArrowUpRight size={12} strokeWidth={2.6} />
        </Link>
      </div>
    </div>
  );
};

export default DemoVideoStage;
