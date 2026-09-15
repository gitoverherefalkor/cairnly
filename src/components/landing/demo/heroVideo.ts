import { personaForLanguage, type DemoPersonaId } from '@/demo/loadFixture';

export type HeroClipLang = 'en' | 'nl';
export interface HeroClip {
  persona: DemoPersonaId;
  lang: HeroClipLang;
}

/**
 * Which recording the hero plays: the persona whose session was held in the
 * visitor's language (nl → Marcel, else Emma), same rule as the demo pages.
 */
export function heroVideoClip(language: string | undefined): HeroClip {
  const persona = personaForLanguage(language);
  return { persona, lang: persona === 'marcel' ? 'nl' : 'en' };
}

export interface HeroVideoSources {
  webm: string;
  mp4: string;
  poster: string;
}

/** File names written by scripts/demo-record-hero.mjs, versioned for Safari. */
export function heroVideoSources(language: string | undefined, version: string): HeroVideoSources {
  const { persona, lang } = heroVideoClip(language);
  const v = `?v=${version}`;
  return {
    webm: `/videos/demo-hero-${persona}-${lang}.webm${v}`,
    mp4: `/videos/demo-hero-${persona}-${lang}.mp4${v}`,
    poster: `/images/live/landing/demo/hero-poster-${persona}-${lang}.jpg${v}`,
  };
}
