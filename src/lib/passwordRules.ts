import { useEffect, useState } from 'react';

// Password rules, kept identical to what Supabase Auth enforces on the server
// (checked 2026-11-20 against the auth logs):
//   1. minimum 8 characters (also enforced in signup-with-access-code)
//   2. no required character classes (8 plain letters pass this step)
//   3. leaked-password protection ON: rejected if it appears in Have I Been Pwned
// If the Supabase Auth password settings change, update this file to match.
export const PASSWORD_MIN_LENGTH = 8;

export type LeakStatus = 'idle' | 'checking' | 'safe' | 'leaked' | 'unknown';

const sha1Hex = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
};

// k-anonymity lookup: only the first 5 characters of the SHA-1 hash leave the
// browser, never the password. Same dataset Supabase uses server-side, so the
// result matches what the signup will say. Free, no API key, CDN-cached.
export const isPasswordLeaked = async (password: string, signal?: AbortSignal): Promise<boolean> => {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    signal,
  });
  if (!res.ok) throw new Error(`pwnedpasswords ${res.status}`);
  const body = await res.text();
  return body.split('\n').some((line) => {
    const [s, count] = line.trim().split(':');
    // Padding rows have count 0, they are not real breaches.
    return s === suffix && Number(count) > 0;
  });
};

// Debounced live leak check. Only runs once the length rule is met, so we
// don't fire a request on every keystroke of a short password.
export const useLeakCheck = (password: string): LeakStatus => {
  const [status, setStatus] = useState<LeakStatus>('idle');

  useEffect(() => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const leaked = await isPasswordLeaked(password, controller.signal);
        setStatus(leaked ? 'leaked' : 'safe');
      } catch {
        // Network/CSP failure: don't block the user, the server still checks.
        if (!controller.signal.aborted) setStatus('unknown');
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [password]);

  return status;
};
