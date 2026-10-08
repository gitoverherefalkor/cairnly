/**
 * "Send me back where I was after logging in", for /ops.
 *
 * /ops stores its own path under `post_auth_redirect` before sending an admin
 * to /auth. The login paths (email/password in EmailPasswordForm, Google and
 * LinkedIn via AuthConfirm, an already-signed-in visit to /auth) read it once
 * here. Until 2026-10-08 nothing read it and everyone landed on /dashboard.
 *
 * Only a same-site path is honoured ("/ops", never "//evil.com" or a full
 * URL), so a value planted in localStorage cannot turn login into an open
 * redirect.
 */
const KEY = 'post_auth_redirect';

export function isSafeInternalPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

/** Returns the stored destination once and clears it; null when absent or unsafe. */
export function takePostAuthRedirect(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    if (value === null) return null;
    localStorage.removeItem(KEY);
    return isSafeInternalPath(value) ? value : null;
  } catch {
    return null;
  }
}
