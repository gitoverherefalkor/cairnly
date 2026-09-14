import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDemoCapture } from './capture';

// vitest runs in node here (no jsdom): stand in a bare `window` object.
const withWindow = (win: Record<string, unknown> | undefined) => {
  if (win === undefined) vi.unstubAllGlobals();
  else vi.stubGlobal('window', win);
};

describe('isDemoCapture', () => {
  afterEach(() => withWindow(undefined));

  it('is off during SSR and unless the recording script set the flag', () => {
    expect(isDemoCapture()).toBe(false);
    withWindow({});
    expect(isDemoCapture()).toBe(false);
    withWindow({ __CAIRNLY_DEMO_CAPTURE__: true });
    expect(isDemoCapture()).toBe(true);
  });

  it('ignores truthy non-boolean values', () => {
    withWindow({ __CAIRNLY_DEMO_CAPTURE__: 'yes' });
    expect(isDemoCapture()).toBe(false);
  });
});
