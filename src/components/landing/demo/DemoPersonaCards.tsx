import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe } from 'lucide-react';
import { DEMO_ROUTE } from '@/demo/constants';
import { demoSessionLanguage, type DemoPersonaId } from '@/demo/loadFixture';
import { trackCtaClick } from '@/lib/analytics';
import { tArray } from '@/lib/i18nArray';
import { heroPersonaOrder, useHeroPersona } from './HeroPersonaContext';

/**
 * The two doors into the demo. Not "which one is you": a visitor reads what
 * each session is about and opens the one that looks most useful. Hovering
 * a card swaps the stage beside it; clicking anywhere on the card opens the
 * full replay with that persona.
 */
const DemoPersonaCards: React.FC = () => {
  const { t, i18n } = useTranslation('landing');
  const { persona: active, setPersona, demoHref } = useHeroPersona();

  return (
    <div className="flex flex-col gap-4">
      {heroPersonaOrder(i18n.language).map((id) => (
        <PersonaCard
          key={id}
          id={id}
          active={id === active}
          href={demoHrefFor(demoHref, id)}
          onHover={() => setPersona(id)}
          t={t}
        />
      ))}
    </div>
  );
};

// The card's own link always carries its own persona, even while the stage
// (and demoHref) still point at the other one: a click is an explicit choice.
function demoHrefFor(demoHref: (route: string) => string, id: DemoPersonaId): string {
  const base = demoHref(DEMO_ROUTE);
  const [path, query = ''] = base.split('?');
  const params = new URLSearchParams(query);
  params.set('persona', id);
  return `${path}?${params.toString()}`;
}

interface PersonaCardProps {
  id: DemoPersonaId;
  active: boolean;
  href: string;
  onHover: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const PersonaCard: React.FC<PersonaCardProps> = ({ id, active, href, onHover, t }) => {
  const sees = tArray<string>(t, `heroDemo.cards.${id}.see`);
  const traits = tArray<string>(t, `heroDemo.cards.${id}.traits`);
  const sessionLang = demoSessionLanguage(id);

  return (
    <Link
      to={href}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={() => trackCtaClick(`hero_demo_${id}`)}
      className={`group block rounded-2xl p-5 text-[#122E3B] transition-all duration-300 ${
        active
          ? 'bg-[#FDFBF2] ring-2 ring-[#D4A024] shadow-[0_28px_56px_-22px_rgba(0,0,0,0.55)]'
          : 'bg-[#FDFBF2]/90 ring-1 ring-white/10 hover:bg-[#FDFBF2]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-heading font-bold text-[16px] md:text-[17px] leading-snug">
          {t(`heroDemo.cards.${id}.who`)}
        </p>
        <span
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#122E3B]/[0.06] px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase text-[#4B6373]"
          title={t(`heroDemo.sessionLanguage.${sessionLang}`)}
        >
          <Globe size={11} strokeWidth={2.2} />
          {sessionLang.toUpperCase()}
        </span>
      </div>
      <p className="mt-1.5 text-[14px] italic text-[#4B6373] leading-snug">
        {t(`heroDemo.cards.${id}.intent`)}
      </p>

      <p className="mt-3.5 text-[10px] font-bold tracking-[0.2em] uppercase text-[#1F8282]">
        {t(`heroDemo.cards.${id}.seeLabel`)}
      </p>
      <ul className="mt-1 space-y-0.5 text-[13.5px] text-[#122E3B] font-medium leading-snug">
        {sees.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-[#D4A024] mt-[1px]">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {traits.map((trait) => (
          <span
            key={trait}
            className="rounded-full border border-[#C9B690]/70 px-2.5 py-0.5 text-[11px] font-semibold text-[#4B6373]"
          >
            {trait}
          </span>
        ))}
      </div>

      <span className="lp-btn-primary lp-btn-gold mt-4 w-full justify-center text-[14px] group-hover:translate-y-[-1px]" style={{ padding: '11px 22px' }}>
        {t(`heroDemo.cards.${id}.cta`)}
        <ArrowRight size={16} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
};

export default DemoPersonaCards;
