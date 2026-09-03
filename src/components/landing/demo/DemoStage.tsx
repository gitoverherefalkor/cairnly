import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Lock } from 'lucide-react';
import { DEMO_DASHBOARD_ROUTE, DEMO_JOBS_ROUTE, DEMO_ROUTE } from '@/demo/constants';
import type { DemoPersonaId } from '@/demo/loadFixture';
import { trackCtaClick } from '@/lib/analytics';
import { tArray } from '@/lib/i18nArray';
import { HERO_PERSONAS, useHeroPersona } from './HeroPersonaContext';

type Slug = 'chat' | 'dashboard' | 'jobs';

/** The three demo screens in product order, each a still of the persona's demo page. */
const SCREENS: { slug: Slug; route: string }[] = [
  { slug: 'chat', route: DEMO_ROUTE },
  { slug: 'dashboard', route: DEMO_DASHBOARD_ROUTE },
  { slug: 'jobs', route: DEMO_JOBS_ROUTE },
];

const stillSrc = (persona: DemoPersonaId, slug: Slug) => `/images/live/landing/demo/${persona}-${slug}.jpg`;

/** Offset per depth step for the windows stacked behind the front one. */
const STEP_PX = 14;

/**
 * The hero's demo stage: three faux-browser windows stacked like a deck
 * (chat in front, dashboard and jobs peeking out behind it), each showing a
 * still of the active persona's demo page, a persona toggle above and a
 * stepper below. Nothing animates inside the windows; the stills swap when
 * the persona changes (the cards cycle on their own until the visitor picks). Clicking the front window opens that
 * screen in the demo with the active persona; clicking a window behind
 * (or its stepper pill) brings it to the front.
 */
const DemoStage: React.FC = () => {
  const { t } = useTranslation('landing');
  const { persona, setPersona, demoHref } = useHeroPersona();
  const [front, setFront] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const labels = tArray<string>(t, 'heroDemo.stepper');

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
          {t('heroDemo.stageLabel', { name: t(`heroDemo.cards.${persona}.name`) })}
        </span>
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
      </div>

      {/* The deck. Top/right margin makes room for the offsets of the windows
          behind. On desktop the deck fills the column height, so its bottom edge
          lines up with the bottom of the second persona card beside it. */}
      <div className="relative aspect-[16/10] lg:aspect-auto lg:flex-1 lg:min-h-0" style={{ marginTop: STEP_PX * 2, marginRight: STEP_PX * 2 }}>
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
              <div className="relative flex-1 min-h-0">
                {broken.has(stillSrc(persona, screen.slug)) ? (
                  <div className="absolute inset-0 grid place-items-center text-white/35 text-[12px] font-medium">
                    {labels[i]}
                  </div>
                ) : (
                  <img
                    src={stillSrc(persona, screen.slug)}
                    alt={`${t(`heroDemo.cards.${persona}.name`)} · ${labels[i]}`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    onError={() => setBroken((prev) => new Set(prev).add(stillSrc(persona, screen.slug)))}
                    className="absolute inset-0 w-full h-full object-cover object-top"
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
              className="absolute inset-0 transition-all duration-500 ease-out"
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
