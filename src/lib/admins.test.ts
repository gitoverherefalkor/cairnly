import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_EMAILS, isAdminEmail } from './admins';

/**
 * The admin allowlist exists twice: here for the UI, and in
 * supabase/functions/_shared/admins.ts for the edge functions, because Vite and
 * Deno cannot share a module. They drifted once already — the frontend carried
 * sjoerd@bethehitl.com while ops-feed and ops-marketing did not, so that address
 * rendered the Ops console and then 403'd on every call it made. This test reads
 * the edge copy and fails if they diverge again.
 */
const EDGE = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/admins.ts'),
  'utf8',
);

const edgeEmails = new Set(
  [...EDGE.matchAll(/'([^']+@[^']+)'/g)].map((m) => m[1]),
);

describe('the admin allowlist stays in sync with the edge functions', () => {
  it('lists the same addresses on both sides', () => {
    expect([...edgeEmails].sort()).toEqual([...ADMIN_EMAILS].sort());
  });

  it('is not empty, which would lock everyone out of Ops', () => {
    expect(ADMIN_EMAILS.size).toBeGreaterThan(0);
  });

  it('holds only lowercase, trimmed addresses so lookups cannot silently miss', () => {
    for (const e of ADMIN_EMAILS) {
      expect(e).toBe(e.trim().toLowerCase());
    }
  });
});

describe('isAdminEmail', () => {
  it('accepts a listed address regardless of case or padding', () => {
    expect(isAdminEmail('  SJOERD@Cairnly.IO ')).toBe(true);
  });

  it('rejects anything not on the list, including near-misses', () => {
    // bethehil.com (no 't') is a real typo that was nearly added to this list.
    expect(isAdminEmail('sjoerd@bethehil.com')).toBe(false);
    expect(isAdminEmail('sjoerd@outsideinput.ai')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
  });
});
