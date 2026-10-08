import { describe, it, expect } from 'vitest';
import { isSafeInternalPath } from './postAuthRedirect';

describe('post-auth redirect only goes to our own pages', () => {
  it('accepts a site path', () => {
    expect(isSafeInternalPath('/ops')).toBe(true);
    expect(isSafeInternalPath('/ops?tab=employers')).toBe(true);
  });
  it('refuses anything that could leave the site', () => {
    expect(isSafeInternalPath('//evil.example')).toBe(false);
    expect(isSafeInternalPath('https://evil.example')).toBe(false);
    expect(isSafeInternalPath('/\\evil.example')).toBe(false);
    expect(isSafeInternalPath('')).toBe(false);
    expect(isSafeInternalPath(null)).toBe(false);
  });
});
