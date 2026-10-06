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

/**
 * File names written by scripts/demo-record-hero.mjs, versioned for Safari.
 * Pass a clip to pin the persona (/partners always plays Marcel); without
 * one the visitor's language picks it.
 */
export function heroVideoSources(language: string | undefined, version: string, clip?: HeroClip): HeroVideoSources {
  const { persona, lang } = clip ?? heroVideoClip(language);
  const v = `?v=${version}`;
  return {
    webm: `/videos/demo-hero-${persona}-${lang}.webm${v}`,
    mp4: `/videos/demo-hero-${persona}-${lang}.mp4${v}`,
    poster: `/images/live/landing/demo/hero-poster-${persona}-${lang}.jpg${v}`,
  };
}
