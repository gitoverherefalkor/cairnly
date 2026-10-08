/**
 * Carries an access code across a Google/LinkedIn sign-in.
 *
 * A code link lands on /auth?flow=signup&code=…, but OAuth leaves the site
 * and returns to /auth/confirm with no code in the URL. Without this, the
 * entitlement gate there signed every such person out with "no purchase".
 * SocialAuthButtons calls rememberPendingAccessCode() right before the
 * redirect; AuthConfirm calls takePendingAccessCode() once the session is
 * back and claims the code (claim-access-code) before checking entitlement.
 *
 * localStorage, not sessionStorage: some OAuth returns open in a fresh
 * browsing context. The entry expires so a code from an abandoned attempt
 * cannot attach itself to an unrelated sign-in days later.
 */
const KEY = 'cairnly_pending_access_code';
export const PENDING_CODE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface PendingAccessCode {
  code: string;
  lang: 'en' | 'nl';
}

interface Stored extends PendingAccessCode {
  at: number;
}

const normaliseLang = (v: string | null | undefined): 'en' | 'nl' =>
  String(v ?? 'en').slice(0, 2).toLowerCase() === 'nl' ? 'nl' : 'en';

/** Reads ?code= (and ?lang=) from a query string and remembers it. No code, no write. */
export function rememberPendingAccessCode(search: string, fallbackLang?: string, now = Date.now()): void {
  try {
    const params = new URLSearchParams(search);
    const code = (params.get('code') ?? '').trim().toUpperCase();
    if (!code) return;
    const entry: Stored = { code, lang: normaliseLang(params.get('lang') ?? fallbackLang), at: now };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // Storage blocked (private mode, policy): the OAuth sign-in still works,
    // it just won't carry the code. Email signup remains the fallback.
  }
}

/** Returns the remembered code once and clears it. Stale or malformed entries return null. */
export function takePendingAccessCode(now = Date.now()): PendingAccessCode | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const entry = JSON.parse(raw) as Partial<Stored>;
    if (!entry.code || typeof entry.at !== 'number') return null;
    if (now - entry.at > PENDING_CODE_MAX_AGE_MS) return null;
    return { code: entry.code, lang: normaliseLang(entry.lang) };
  } catch {
    return null;
  }
}
