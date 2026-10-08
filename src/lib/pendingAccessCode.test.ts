import { describe, it, expect, beforeEach } from 'vitest';
import { rememberPendingAccessCode, takePendingAccessCode, PENDING_CODE_MAX_AGE_MS } from './pendingAccessCode';

// Vitest runs in Node here: give the module a minimal localStorage.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe('pending access code across an OAuth round trip', () => {
  it('remembers the code from the sign-up link and hands it back once', () => {
    rememberPendingAccessCode('?flow=signup&code=acme-7m4r-qw2t-njhd&lang=nl', 'en', 1_000);
    expect(takePendingAccessCode(2_000)).toEqual({ code: 'ACME-7M4R-QW2T-NJHD', lang: 'nl' });
    expect(takePendingAccessCode(3_000)).toBeNull();
  });

  it('falls back to the page language when the link carries none', () => {
    rememberPendingAccessCode('?code=X1', 'nl-NL', 0);
    expect(takePendingAccessCode(1)).toEqual({ code: 'X1', lang: 'nl' });
  });

  it('writes nothing when the page has no code', () => {
    rememberPendingAccessCode('?flow=signup', 'en', 0);
    expect(takePendingAccessCode(1)).toBeNull();
  });

  it('drops a code from an abandoned attempt', () => {
    rememberPendingAccessCode('?code=OLD', 'en', 0);
    expect(takePendingAccessCode(PENDING_CODE_MAX_AGE_MS + 1)).toBeNull();
  });
});
