import { describe, expect, it } from 'vitest';
import { shouldSuppressTracking } from './analytics';

// The decision that keeps our own traffic out of the numbers. Pulled out of
// the browser globals so it can be checked here: getting this wrong either
// pollutes every metric (too loose) or silently loses real visitors (too
// strict), and neither shows up until someone reads a report and believes it.
describe('shouldSuppressTracking', () => {
  const visitor = { hostname: 'www.cairnly.io', webdriver: false, optedOut: false };

  it('counts a real visitor on the production host', () => {
    expect(shouldSuppressTracking(visitor)).toBe(false);
    expect(shouldSuppressTracking({ ...visitor, hostname: 'cairnly.io' })).toBe(false);
  });

  it('drops anything that is not the production host', () => {
    for (const hostname of ['localhost', '127.0.0.1', 'cairnly-git-branch.vercel.app', 'cairnly.io.evil.com']) {
      expect(shouldSuppressTracking({ ...visitor, hostname }), hostname).toBe(true);
    }
  });

  it('drops automation, which is the traffic that actually reached production', () => {
    // Headless Chrome runs JavaScript, so puppeteer checks wrote real rows.
    expect(shouldSuppressTracking({ ...visitor, webdriver: true })).toBe(true);
  });

  it('drops a browser carrying the internal flag', () => {
    expect(shouldSuppressTracking({ ...visitor, optedOut: true })).toBe(true);
  });
});
