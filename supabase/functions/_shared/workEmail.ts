// Work-email and identity helpers for outreach. Shared by ops-employers
// (Deno) and the Ops console (src/lib/hitlist.ts imports this file), so the
// console warns about exactly what the server refuses.
//
// FREE_MAIL_DOMAINS mirrors outreach_is_free_mail_domain() in
// supabase/migrations/20261015150000_employer_hitlist.sql; a test in
// src/lib/hitlist.test.ts fails when the two drift apart.

export const FREE_MAIL_DOMAINS: readonly string[] = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.nl', 'hotmail.co.uk',
  'outlook.com', 'outlook.nl', 'live.com', 'live.nl', 'live.co.uk', 'msn.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.nl', 'ymail.com', 'icloud.com', 'me.com',
  'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.net',
  'ziggo.nl', 'kpnmail.nl', 'kpnplanet.nl', 'planet.nl', 'home.nl', 'xs4all.nl',
  'hetnet.nl', 'casema.nl', 'chello.nl', 'telfort.nl', 'online.nl', 'quicknet.nl',
  'btinternet.com', 'sky.com', 'virginmedia.com', 'talktalk.net', 'ntlworld.com',
];

const FREE = new Set(FREE_MAIL_DOMAINS);

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailDomain(email: string | null | undefined): string | null {
  const s = (email ?? '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  return at > 0 && at < s.length - 1 ? s.slice(at + 1) : null;
}

export function isFreeMailDomain(domain: string | null | undefined): boolean {
  return FREE.has((domain ?? '').trim().toLowerCase());
}

/** A plausible address that is not a consumer mailbox. */
export function isWorkEmail(email: string | null | undefined): boolean {
  const s = (email ?? '').trim();
  return EMAIL_RE.test(s) && !isFreeMailDomain(emailDomain(s));
}

/** "https://www.Acme.nl/about" → "acme.nl". Same rule as outreach_norm_domain(). */
export function normDomain(input: string | null | undefined): string | null {
  const s = (input ?? '').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^([a-z]+:\/\/)?(www\.)?([^/:?#@]+)/);
  const d = m?.[3] ?? '';
  return d.includes('.') ? d : null;
}

/** Any LinkedIn profile URL → "/in/handle", else null. Same rule as outreach_norm_linkedin(). */
export function normLinkedin(input: string | null | undefined): string | null {
  const m = (input ?? '').toLowerCase().match(/linkedin\.com(\/in\/[^/?#]+)/);
  return m ? m[1].replace(/\/+$/, '') : null;
}

/** Does `domain` fall under a blocked domain (itself or a subdomain)? */
export function underDomain(domain: string | null, blocked: string): boolean {
  if (!domain) return false;
  return domain === blocked || domain.endsWith(`.${blocked}`);
}
