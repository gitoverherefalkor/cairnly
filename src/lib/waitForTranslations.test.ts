import { describe, it, expect, vi, afterEach } from 'vitest';
import { waitForTranslations } from './waitForTranslations';

afterEach(() => vi.useRealTimers());

describe('waitForTranslations', () => {
  it('resolves as soon as the translations are ready', async () => {
    await expect(waitForTranslations(Promise.resolve('t'), 60_000)).resolves.toBeUndefined();
  });

  it('resolves (does not throw) when loading the translations fails', async () => {
    await expect(waitForTranslations(Promise.reject(new Error('404')), 60_000)).resolves.toBeUndefined();
  });

  it('gives up after the cap when the translations never arrive', async () => {
    vi.useFakeTimers();
    let done = false;
    waitForTranslations(new Promise(() => {}), 4000).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(3999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
