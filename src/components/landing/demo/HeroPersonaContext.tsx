import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { personaForLanguage, type DemoPersonaId } from '@/demo/loadFixture';
import { demoLink } from '@/demo/links';

/** The two people the homepage can show; language-default persona first. */
export const HERO_PERSONAS: DemoPersonaId[] = ['emma', 'marcel'];

export function heroPersonaOrder(language: string | undefined): DemoPersonaId[] {
  const first = personaForLanguage(language);
  return [first, ...HERO_PERSONAS.filter((id) => id !== first)];
}

interface HeroPersonaValue {
  /** The persona the hero stage is playing and every demo link carries. */
  persona: DemoPersonaId;
  /** True once the visitor hovered a card or used the toggle. */
  picked: boolean;
  setPersona: (id: DemoPersonaId) => void;
  /** Swap the persona without counting it as the visitor's choice (the idle cycle). */
  previewPersona: (id: DemoPersonaId) => void;
  /** `route` with `?persona=<active>` appended (via demoLink, so `?p=` survives too). */
  demoHref: (route: string) => string;
}

const HeroPersonaContext = createContext<HeroPersonaValue | null>(null);

/**
 * Which demo persona the landing page is "about" right now. Starts as the
 * language default (nl → Marcel, else Emma), follows the visitor's hover or
 * toggle in the hero, and feeds every demo link lower on the page so a
 * visitor who was watching Marcel keeps seeing Marcel in How it works.
 */
export const HeroPersonaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [state, setState] = useState<{ persona: DemoPersonaId; picked: boolean }>(() => ({
    persona: personaForLanguage(i18n.language),
    picked: false,
  }));

  // A language switch re-derives the default until the visitor has chosen.
  useEffect(() => {
    setState((s) => (s.picked ? s : { ...s, persona: personaForLanguage(i18n.language) }));
  }, [i18n.language]);

  const setPersona = useCallback((id: DemoPersonaId) => {
    setState({ persona: id, picked: true });
  }, []);

  const previewPersona = useCallback((id: DemoPersonaId) => {
    setState((s) => (s.picked ? s : { persona: id, picked: false }));
  }, []);

  const value = useMemo<HeroPersonaValue>(
    () => ({
      persona: state.persona,
      picked: state.picked,
      setPersona,
      previewPersona,
      demoHref: (route: string) => demoLink(route, `?persona=${state.persona}`),
    }),
    [state, setPersona, previewPersona],
  );

  return <HeroPersonaContext.Provider value={value}>{children}</HeroPersonaContext.Provider>;
};

export function useHeroPersona(): HeroPersonaValue {
  const value = useContext(HeroPersonaContext);
  if (!value) throw new Error('useHeroPersona must be used inside HeroPersonaProvider');
  return value;
}

/**
 * Demo links on sections that also render outside the homepage (no
 * provider): fall back to the plain route, which lets the demo pick its
 * persona by language as before.
 */
export function useDemoHref(): (route: string) => string {
  const value = useContext(HeroPersonaContext);
  return value ? value.demoHref : (route: string) => demoLink(route, '');
}
