import { describe, expect, it } from 'vitest';
import { heroVideoClip, heroVideoSources } from './heroVideo';

describe('hero video sources', () => {
  it('Dutch gets Marcel, everything else gets Emma', () => {
    expect(heroVideoClip('nl')).toEqual({ persona: 'marcel', lang: 'nl' });
    expect(heroVideoClip('nl-NL')).toEqual({ persona: 'marcel', lang: 'nl' });
    expect(heroVideoClip('en')).toEqual({ persona: 'emma', lang: 'en' });
    expect(heroVideoClip('de')).toEqual({ persona: 'emma', lang: 'en' });
    expect(heroVideoClip(undefined)).toEqual({ persona: 'emma', lang: 'en' });
  });

  it('builds versioned urls for webm, mp4 and the poster', () => {
    expect(heroVideoSources('nl', '202609141200')).toEqual({
      webm: '/videos/demo-hero-marcel-nl.webm?v=202609141200',
      mp4: '/videos/demo-hero-marcel-nl.mp4?v=202609141200',
      poster: '/images/live/landing/demo/hero-poster-marcel-nl.jpg?v=202609141200',
    });
  });
});
