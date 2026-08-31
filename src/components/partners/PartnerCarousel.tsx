import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import ScreenshotSlot from '@/components/landing/ScreenshotSlot';
import { PARTNER_SLIDES, type PartnerSlide } from './constants';

interface Loaded extends PartnerSlide {
  ratio: number;
}

/**
 * Hero carousel of real screen captures from the specimen report and the
 * candidate's dashboard.
 *
 * Built on native CSS scroll-snap rather than the (unused) shadcn/embla
 * wrapper the repo carries. For a handful of static images this is the
 * smaller tool: real momentum swipe on touch for free, no JS animation loop,
 * no second source of truth for "which slide is showing", and one less
 * dependency in the hero.
 *
 * Two things it has to survive, because the artwork is delivered separately
 * from the code:
 *
 * 1. **A declared slide whose file does not exist yet.** Every slide is probed
 *    before it renders and the misses are dropped, so PARTNER_SLIDES can name
 *    a screenshot ahead of time without putting a broken image in the hero.
 *    If nothing loads at all, the dashed placeholder frame stands in.
 * 2. **Slides of different shapes.** The frame locks to the first loaded
 *    slide's real aspect and every image is contained rather than cropped, so
 *    a 3:2 report page and a 16:9 dashboard shot sit in the same box without
 *    the hero jumping height as you page through.
 */
const PartnerCarousel: React.FC = () => {
  const { t } = useTranslation('partners');
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<Loaded[] | null>(null);
  const total = loaded?.length ?? 0;

  // Probe every declared slide once; keep source order among the survivors.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PARTNER_SLIDES.map(
        (slide) =>
          new Promise<Loaded | null>((resolve) => {
            const img = new Image();
            img.onload = () =>
              resolve(
                img.naturalWidth && img.naturalHeight
                  ? { ...slide, ratio: img.naturalWidth / img.naturalHeight }
                  : null,
              );
            img.onerror = () => resolve(null);
            img.src = slide.src;
          }),
      ),
    ).then((results) => {
      if (!cancelled) setLoaded(results.filter((r): r is Loaded => r !== null));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    setCurrent(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const el = trackRef.current;
      if (!el || !total) return;
      const target = Math.max(0, Math.min(index, total - 1));

      // Drive the indicator from the click rather than waiting for the scroll
      // to settle. onScroll still owns the swipe case, but a button press
      // should not depend on a scroll event arriving to light up its dot.
      setCurrent(target);

      // scrollTo({behavior:'smooth'}) overrides the CSS, and CSS is where the
      // reduced-motion preference is honoured, so ask the media query directly
      // rather than animating past someone who asked us not to. 'instant', not
      // 'auto': 'auto' defers back to the CSS, which is smooth here.
      const reduced =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ left: target * el.clientWidth, behavior: reduced ? 'instant' : 'smooth' });
    },
    [total],
  );

  const frameRatio = loaded?.[0]?.ratio;

  // Probing, or every file still missing.
  if (!loaded || loaded.length === 0) {
    return (
      <div
        className="lp-screenshot-slot lp-on-dark lp-screenshot-slot--placeholder aspect-[16/10] w-full"
        role="img"
        aria-label={t('hero.radarPendingLabel')}
      >
        <div className="lp-screenshot-slot__inner">
          <ImageIcon size={30} strokeWidth={1.6} />
          <span className="lp-screenshot-slot__label">{t('hero.radarPendingLabel')}</span>
          <span className="lp-screenshot-slot__desc">{t('hero.radarPendingDesc')}</span>
        </div>
      </div>
    );
  }

  const single = loaded.length === 1;
  const atStart = current <= 0;
  const atEnd = current >= loaded.length - 1;

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={single ? undefined : handleScroll}
        className={`lp-snap-track flex ${single ? '' : 'overflow-x-auto'}`}
      >
        {loaded.map((slide) => (
          <div key={slide.key} className="lp-snap-slide shrink-0 grow-0 basis-full">
            <ScreenshotSlot
              src={slide.src}
              alt={t(`hero.slides.${slide.key}.alt`)}
              meta={t(`hero.slides.${slide.key}.meta`)}
              aspect="aspect-[16/10]"
              aspectRatio={frameRatio}
              fit="contain"
              onDark
            />
          </div>
        ))}
      </div>

      {/* Controls only earn their space once there is somewhere to go. */}
      {!single && (
        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={atStart}
            aria-label={t('hero.prevSlide')}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 text-white/70 enabled:hover:text-white enabled:hover:border-white/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={atEnd}
            aria-label={t('hero.nextSlide')}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-white/20 text-white/70 enabled:hover:text-white enabled:hover:border-white/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} strokeWidth={2.4} />
          </button>

          <div className="flex items-center gap-2 ml-1">
            {loaded.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                onClick={() => goTo(i)}
                aria-label={t('hero.goToSlide', { n: i + 1 })}
                aria-current={i === current}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === current ? 22 : 8,
                  background: i === current ? '#D4A024' : 'rgba(255,255,255,0.28)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerCarousel;
