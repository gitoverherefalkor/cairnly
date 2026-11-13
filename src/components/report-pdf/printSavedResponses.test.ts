import { describe, it, expect } from 'vitest';
import { stripSavedFollowUps } from './printSavedResponses';

const PETER = `- **A bullet.** Highlight text.

##### Saved Responses


**Saved response 1**

That detail matters. Three evenings is slow.

When you look back on those evenings, what stands out most? Was it the trust they gave you? Your answer will help sharpen how this section reads in your report.`;

describe('stripSavedFollowUps', () => {
  it('drops the closing follow-up question', () => {
    const out = stripSavedFollowUps(PETER);
    expect(out).toContain('That detail matters. Three evenings is slow.');
    expect(out).toContain('**Saved response 1**');
    expect(out).toContain('- **A bullet.** Highlight text.');
    expect(out).not.toMatch(/what stands out most/);
    expect(out).not.toMatch(/help sharpen/);
  });

  it('keeps a message that is only one paragraph', () => {
    const one = '##### Saved Responses\n\n**Saved response 1**\n\nIs this the right fit?';
    expect(stripSavedFollowUps(one)).toContain('Is this the right fit?');
  });

  it('handles Dutch labels and keeps the section after it', () => {
    const nl =
      '##### Bewaarde antwoorden\n\n**Bewaard antwoord 1**\n\nGoed punt.\n\nWat valt u het meest op?\n\n**Bewaard antwoord 2**\n\nTweede.\n\n##### Ook door jou aangemerkt\n\nMijn notitie?';
    const out = stripSavedFollowUps(nl);
    expect(out).not.toMatch(/Wat valt u/);
    expect(out).toContain('Goed punt.');
    expect(out).toContain('**Bewaard antwoord 2**');
    expect(out).toContain('Mijn notitie?');
  });

  it('leaves content without saved responses untouched', () => {
    expect(stripSavedFollowUps('Just highlights?')).toBe('Just highlights?');
  });
});
