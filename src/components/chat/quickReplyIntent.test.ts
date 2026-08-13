import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { inferQuickReplyIntent } from './quickReplyIntent';

// Read the shipped locale files rather than duplicating the strings here. That
// is the whole point of this suite: it fails when someone edits a quick-reply
// message in chat.json without updating the matcher, which would silently drop
// the click onto the slow agent path (or, worse, end the session).
const loadPills = (lang: string) =>
  JSON.parse(
    readFileSync(`public/locales/${lang}/chat.json`, 'utf8'),
  ) as {
    welcome: { readyMessage: string };
    quickReplies: Record<string, { label: string; mobile: string; message?: string; placeholder?: string }>;
  };

const en = loadPills('en');
const nl = loadPills('nl');

describe('inferQuickReplyIntent', () => {
  describe.each([
    ['en', en],
    ['nl', nl],
  ])('%s quick-reply messages', (lang, pills) => {
    it('routes the Continue pill to advance', () => {
      expect(inferQuickReplyIntent(pills.quickReplies.continue.message!)).toBe('advance');
    });

    it('routes the wrap-up pill to wrap_up', () => {
      expect(inferQuickReplyIntent(pills.quickReplies.wrapUp.message!)).toBe('wrap_up');
    });

    it('routes the kickoff message to advance, NOT wrap_up', () => {
      // Regression guard. wrap_up is evaluated first, and the Dutch strings
      // "ik ben er klaar voor" (kickoff) and "ik ben klaar" (wrap-up) are one
      // word apart. If this ever flips, clicking "I'm ready" would end the
      // session before it starts.
      expect(inferQuickReplyIntent(pills.welcome.readyMessage)).toBe('advance');
    });

    it('leaves the explore pill to the agent', () => {
      expect(inferQuickReplyIntent(pills.quickReplies.explore.message!)).toBeUndefined();
    });

    it('leaves the skip pill to its explicit intent', () => {
      // The skip pill passes intent: 'skip_stalled' directly, so text
      // inference must not claim it as an advance or a wrap-up.
      expect(inferQuickReplyIntent(pills.quickReplies.skip.message!)).toBeUndefined();
    });

    it(`never lets a ${lang} pill message be misread as wrap_up`, () => {
      for (const [key, pill] of Object.entries(pills.quickReplies)) {
        if (!pill.message || key === 'wrapUp') continue;
        expect(inferQuickReplyIntent(pill.message)).not.toBe('wrap_up');
      }
    });
  });

  // These historical English phrasings predate the locale files and appear in
  // transcripts already stored in the database, so they must keep matching
  // regardless of what the current locale says.
  describe('legacy English transcripts', () => {
    it.each([
      "Looks good, let's continue to the next section",
      'continue',
      'next section',
      "let's move on",
      'yes, lets go',
      "I'm ready, let's begin!",
    ])('still advances on %j', (text) => {
      expect(inferQuickReplyIntent(text)).toBe('advance');
    });

    it.each([
      "Looks good, I'm all done! Let's wrap up the session.",
      'wrap up',
      "i'm all done",
    ])('still wraps up on %j', (text) => {
      expect(inferQuickReplyIntent(text)).toBe('wrap_up');
    });
  });

  it('leaves ordinary conversation alone', () => {
    for (const text of [
      'Can you explain the second career again?',
      'Ik snap dit niet helemaal, kun je het uitleggen?',
      'yes',
      'ok',
      'Waarom past dit bij mij?',
    ]) {
      expect(inferQuickReplyIntent(text)).toBeUndefined();
    }
  });
});
