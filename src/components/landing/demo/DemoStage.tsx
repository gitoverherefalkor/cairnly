import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Lock } from 'lucide-react';
import { DEMO_DASHBOARD_ROUTE, DEMO_JOBS_ROUTE, DEMO_ROUTE } from '@/demo/constants';
import type { DemoPersonaId } from '@/demo/loadFixture';
import { trackCtaClick } from '@/lib/analytics';
import { tArray } from '@/lib/i18nArray';
import { HERO_PERSONAS, useHeroPersona } from './HeroPersonaContext';

export type DemoStageSlug = 'chat' | 'dashboard' | 'jobs';
type Slug = DemoStageSlug;

/** The three demo screens in product order, each a still of the persona's demo page. */
const ALL_SCREENS: { slug: Slug; route: string }[] = [
  { slug: 'chat', route: DEMO_ROUTE },
  { slug: 'dashboard', route: DEMO_DASHBOARD_ROUTE },
  { slug: 'jobs', route: DEMO_JOBS_ROUTE },
];

const stillSrc = (persona: DemoPersonaId, lang: StillLang, slug: Slug) =>
  `/images/live/landing/demo/${persona}-${lang}-${slug}.jpg`;

/** The languages the stills are captured in; anything else falls back to English. */
type StillLang = 'en' | 'nl';
const stillLang = (language: string | undefined): StillLang =>
  (language || 'en').slice(0, 2).toLowerCase() === 'nl' ? 'nl' : 'en';

/** Offset per depth step for the windows stacked behind the front one. */
const STEP_PX = 14;

/** Natural size of every still (scripts/demo-capture-stills.mjs). The frame is
 *  sized FROM the image rather than the other way round, so nothing is cropped. */
const STILL_W = 1200;
const STILL_H = 800;

/**
 * The hero's demo stage: three faux-browser windows stacked like a deck
 * (chat in front, dashboard and jobs peeking out behind it), each showing a
 * still of the active persona's demo page, a persona toggle above and a
 * stepper below. Nothing animates inside the windows; the stills swap when
 * the persona changes (the cards cycle on their own until the visitor picks). Clicking the front window opens that
 * screen in the demo with the active persona; clicking a window behind
 * (or its stepper pill) brings it to the front.
 */
interface DemoStageProps {
  /** Which screens to stack, in product order. Default: all three. */
  screens?: Slug[];
  /** Hide the Emma | Marcel toggle (a page pinned to one persona). */
  showToggle?: boolean;
  /** Replace the "Playing: …" label. */
  label?: string;
}

const DemoStage: React.FC<DemoStageProps> = ({ screens, showToggle = true, label }) => {
  const { t, i18n } = useTranslation('landing');
  const { persona, setPersona, demoHref } = useHeroPersona();
  const lang = stillLang(i18n.language);
  const [front, setFront] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const SCREENS = screens ? ALL_SCREENS.filter((s) => screens.includes(s.slug)) : ALL_SCREENS;
  // Stepper labels are declared for all three screens, in product order.
  const allLabels = tArray<string>(t, 'heroDemo.stepper');
  const labels = SCREENS.map((s) => allLabels[ALL_SCREENS.findIndex((a) => a.slug === s.slug)] ?? s.slug);

  // A new persona starts at the chat again.
  useEffect(() => {
    setFront(0);
  }, [persona]);

  const bringToFront = (i: number, source: string) => {
    setFront(i);
    trackCtaClick(`hero_stage_${SCREENS[i].slug}_${source}`);
  };

  return (
    <div className="select-none flex flex-col lg:h-full">
      {/* Label + persona toggle */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="min-w-0 truncate text-[11px] font-heading font-bold tracking-[0.18em] uppercase text-white/55">
          {label ?? t('heroDemo.stageLabel', { name: t(`heroDemo.cards.${persona}.name`) })}
        </span>
        {showToggle && (
        <div role="group" aria-label={t('heroDemo.toggleAria')} className="inline-flex shrink-0 rounded-full bg-white/10 p-0.5">
          {HERO_PERSONAS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === persona}
              onClick={() => {
                if (id === persona) return;
                setPersona(id);
                trackCtaClick('hero_persona_toggle');
              }}
              className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ${
                id === persona ? 'bg-[#D4A024] text-[#122E3B]' : 'text-white/70 hover:text-white'
              }`}
            >
              {t(`heroDemo.cards.${id}.name`)}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* The deck. Top/right margin makes room for the offsets of the windows
          behind. All three windows share one grid cell, so they overlap without
          absolute positioning and the tallest (they are all one still tall)
          gives the deck its height. */}
      <div className="relative grid" style={{ marginTop: STEP_PX * 2, marginRight: STEP_PX * 2 }}>
        {SCREENS.map((screen, i) => {
          const depth = (i - front + SCREENS.length) % SCREENS.length;
          const isFront = depth === 0;
          const frame = (
            <div className="h-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-[#15262F] flex flex-col">
              {/* Chrome bar: traffic lights + URL */}
              <div className="flex items-center gap-3 px-3.5 h-9 shrink-0 bg-[#1B2E38] border-b border-black/30">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                </div>
                <div className="flex-1 flex items-center gap-1.5 px-3 h-6 rounded-md bg-black/25 text-white/55 text-[11px] font-medium min-w-0">
                  <Lock size={11} className="shrink-0 text-white/40" />
                  <span className="truncate">
                    app.cairnly.io/<span className="text-white/85">{screen.slug}</span>
                  </span>
                </div>
              </div>
              <div className="relative">
                {broken.has(stillSrc(persona, lang, screen.slug)) ? (
                  <div
                    className="grid place-items-center text-white/35 text-[12px] font-medium"
                    style={{ aspectRatio: `${STILL_W} / ${STILL_H}` }}
                  >
                    {labels[i]}
                  </div>
                ) : (
                  <img
                    src={stillSrc(persona, lang, screen.slug)}
                    alt={`${t(`heroDemo.cards.${persona}.name`)} · ${labels[i]}`}
                    width={STILL_W}
                    height={STILL_H}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    onError={() => setBroken((prev) => new Set(prev).add(stillSrc(persona, lang, screen.slug)))}
                    className="block w-full h-auto"
                  />
                )}
                {isFront && (
                  <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-[#D4A024] text-[#122E3B] px-2.5 py-1 text-[11px] font-bold opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {t('heroDemo.clickHint')}
                    <ArrowUpRight size={12} strokeWidth={2.6} />
                  </span>
                )}
              </div>
            </div>
          );

          return (
            <div
              key={screen.slug}
              className="col-start-1 row-start-1 transition-all duration-500 ease-out"
              style={{
                transform: `translate(${depth * STEP_PX}px, ${-depth * STEP_PX}px)`,
                zIndex: 30 - depth * 10,
                opacity: 1 - depth * 0.08,
              }}
            >
              {isFront ? (
                <Link
                  to={demoHref(screen.route)}
                  onClick={() => trackCtaClick(`hero_stage_${screen.slug}_open`)}
                  aria-label={`${t('heroDemo.clickHint')}: ${labels[i]}`}
                  className="group block h-full"
                >
                  {frame}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => bringToFront(i, 'deck')}
                  aria-label={labels[i]}
                  className="block h-full w-full text-left"
                >
                  {frame}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Stepper */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {SCREENS.map((screen, i) => (
          <button
            key={screen.slug}
            type="button"
            aria-current={i === front}
            onClick={() => bringToFront(i, 'stepper')}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-all duration-300 ${
              i === front ? 'bg-[#D4A024] text-[#122E3B]' : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {i + 1} · {labels[i]}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DemoStage;
