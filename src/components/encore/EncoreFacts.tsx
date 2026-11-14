import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';

interface BigStat { num: string; text: string; source: string; href: string }
interface Bar { label: string; value: string; pct: number }
interface BarChart { title: string; note: string; source: string; href: string; bars: Bar[] }

const SourceLink: React.FC<{ label: string; source: string; href: string }> = ({ label, source, href }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="block mt-5 pt-4 border-t border-white/15 text-[13px] text-white/55 font-medium italic hover:text-white/80"
  >
    {label}: {source}
  </a>
);

/** Large number tile: one figure, one sentence, one source. */
const BigStatTile: React.FC<{ stat: BigStat; label: string }> = ({ stat, label }) => (
  <Reveal className="lg:col-span-2">
    <div className="enc-fact-tile h-full flex flex-col justify-between">
      <div>
        <div className="font-heading font-bold lp-text-gold-grad leading-none" style={{ fontSize: 'clamp(44px, 5vw, 60px)', letterSpacing: '-0.02em' }}>
          {stat.num}
        </div>
        <p className="mt-4 text-[17px] text-white/85 font-medium leading-relaxed">{stat.text}</p>
      </div>
      <SourceLink label={label} source={stat.source} href={stat.href} />
    </div>
  </Reveal>
);

/** Horizontal bars in pure CSS. They grow once the tile has scrolled into view (.lp-reveal-in). */
const BarTile: React.FC<{ chart: BarChart; label: string }> = ({ chart, label }) => (
  <Reveal className="lg:col-span-3">
    <div className="enc-fact-tile h-full flex flex-col justify-between">
      <div>
        <h3 className="font-heading font-bold text-white mb-6" style={{ fontSize: 19, letterSpacing: '-0.01em' }}>{chart.title}</h3>
        <ul className="space-y-4" role="list">
          {chart.bars.map((b) => (
            <li key={b.label} className="grid grid-cols-[84px_1fr_44px] sm:grid-cols-[104px_1fr_48px] items-center gap-3">
              <span className="text-[15px] text-white/70 font-medium">{b.label}</span>
              <span className="enc-bar" aria-hidden="true">
                <i style={{ ['--w' as string]: `${b.pct}%` }} />
              </span>
              <span className="text-[16px] text-white font-bold text-right tabular-nums">{b.value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[15.5px] text-white/70 font-medium leading-relaxed">{chart.note}</p>
      </div>
      <SourceLink label={label} source={chart.source} href={chart.href} />
    </div>
  </Reveal>
);

/**
 * Dutch facts about working past 65, in the same navy band as the pricing
 * section. Every figure is from CBS or the College voor de Rechten van de Mens
 * with a link to its page; the research log lives in
 * project-files/encore-decisions/landing-visuals.md.
 */
const EncoreFacts: React.FC = () => {
  const { t } = useTranslation('encore');
  const g = (k: string) => t(`facts.${k}`, { returnObjects: true }) as never;
  const label = t('facts.sourceLabel');

  return (
    <section id="facts" className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-14">
          <div className="lp-eyebrow text-[#D4A024] mb-5">{t('facts.eyebrow')}</div>
          <h2 className="font-heading font-bold text-white leading-[1.12]" style={{ fontSize: 'clamp(28px, 3.2vw, 42px)', letterSpacing: '-0.012em' }}>
            {t('facts.title')}
          </h2>
          <p className="mt-6 text-lg md:text-xl text-white/70 font-medium leading-relaxed">{t('facts.intro')}</p>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-6 md:gap-8">
          <BigStatTile stat={g('work')} label={label} />
          <BigStatTile stat={g('life')} label={label} />
          <BigStatTile stat={g('age')} label={label} />
          <BarTile chart={g('ageBars')} label={label} />
          <BarTile chart={g('aiBars')} label={label} />
        </div>
      </div>
    </section>
  );
};

export default EncoreFacts;
