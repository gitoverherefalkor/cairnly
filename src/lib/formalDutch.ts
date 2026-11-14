/**
 * Formal Dutch ("u") for Encore users.
 *
 * Cairnly's Dutch copy says "je". Encore (older professionals) says "u"
 * everywhere the user looks. Since 2026-11-13 (round 7) that includes the
 * coach chat's own screens (welcome, popups, wrap-up); the coach's typed
 * replies follow WF5's register.
 *
 * How it works: overrides live in public/locales/nl-formal/<ns>.json and hold
 * ONLY the strings that differ. When formal mode is on, every Dutch namespace
 * listed below is loaded as base + override (deep merge), so components keep
 * calling t('...') as usual. Strings not in the override fall back to the base.
 *
 * Formal mode is a per-browser flag, switched on wherever we learn the user is
 * an Encore user (Encore landing, signup with an Encore code, dashboard,
 * assessment) and off again when we learn they are Pro/Starter.
 */
import type i18nType from 'i18next';

const FLAG_KEY = 'cairnly_formal_nl';

/**
 * Encore code links carry `flavor=encore` (Ops free codes). Read it before
 * i18n loads its first namespaces, so a fresh browser opening such a link
 * sees "u" from the first render (signup page, cookie banner) instead of a
 * "je" flash until the code check returns. Only ever switches formal ON;
 * the code check on /auth still has the final say.
 */
export function applyFlavorHintFromUrl(): void {
  try {
    const flavor = new URLSearchParams(window.location.search).get('flavor');
    if (flavor === 'encore') localStorage.setItem(FLAG_KEY, '1');
  } catch {
    /* storage blocked: plain Dutch until the code check */
  }
}

/**
 * Namespaces with a nl-formal override file. `coach` overrides only the UI
 * chrome (dashboard card, headers, notices).
 */
export const FORMAL_NAMESPACES = ['auth', 'common', 'dashboard', 'survey', 'report', 'payment', 'coach', 'chat'];

export function isFormalDutchOn(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

type Json = Record<string, any>;

/** Merge `over` into `base`. Objects merge per key; an array base takes index keys. */
export function deepMerge(base: any, over: any): any {
  if (over === undefined) return base;
  if (Array.isArray(base) && over && typeof over === 'object' && !Array.isArray(over)) {
    const out = [...base];
    for (const [k, v] of Object.entries(over)) {
      const i = Number(k);
      if (Number.isInteger(i)) out[i] = deepMerge(out[i], v);
    }
    return out;
  }
  if (base && typeof base === 'object' && !Array.isArray(base) && over && typeof over === 'object' && !Array.isArray(over)) {
    const out: Json = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = deepMerge(base[k], v);
    return out;
  }
  return over;
}

const nsFromUrl = (url: string): { lng: string; ns: string } | null => {
  const m = url.match(/\/locales\/([^/]+)\/([^/.]+)\.json/);
  return m ? { lng: m[1], ns: m[2] } : null;
};

/**
 * `request` option for i18next-http-backend: a plain fetch, plus the formal
 * override merged in for Dutch formal namespaces when the flag is on.
 */
/**
 * English has a smaller Encore override set (public/locales/en-encore/), for
 * labels where Pro wording is wrong for Encore ("Primary Career Match" ->
 * "Strongest direction"). Same flag: it marks an Encore browser in any language.
 */
export const EN_ENCORE_NAMESPACES = ['report', 'dashboard'];

/** Which override folder applies to this locale file, if any. */
function overrideDirFor(target: { lng: string; ns: string } | null): string | null {
  if (!target || !isFormalDutchOn()) return null;
  if (target.lng === 'nl' && FORMAL_NAMESPACES.includes(target.ns)) return 'nl-formal';
  if (target.lng === 'en' && EN_ENCORE_NAMESPACES.includes(target.ns)) return 'en-encore';
  return null;
}

export function formalAwareRequest(
  _options: unknown,
  url: string,
  _payload: unknown,
  callback: (err: any, res?: { status: number; data: any }) => void,
): void {
  const target = nsFromUrl(url);
  const overrideDir = overrideDirFor(target);
  const wantsFormal = !!overrideDir;

  fetch(url)
    .then(async (res) => {
      if (!res.ok) return callback(null, { status: res.status, data: '' });
      const base = await res.json();
      if (!wantsFormal) return callback(null, { status: 200, data: base });
      try {
        const overRes = await fetch(url.replace(`/locales/${target!.lng}/`, `/locales/${overrideDir}/`));
        const over = overRes.ok ? await overRes.json() : {};
        callback(null, { status: 200, data: deepMerge(base, over) });
      } catch {
        callback(null, { status: 200, data: base }); // override missing: plain Dutch
      }
    })
    .catch((err) => callback(err));
}

/**
 * Switch formal Dutch on or off. Reloads the affected Dutch namespaces and
 * re-renders, but only when the setting actually changes.
 */
export function setFormalDutch(i18n: typeof i18nType, on: boolean): void {
  if (isFormalDutchOn() === on) return;
  try {
    if (on) localStorage.setItem(FLAG_KEY, '1');
    else localStorage.removeItem(FLAG_KEY);
  } catch {
    return; // storage blocked: stay on plain Dutch
  }
  const nl = FORMAL_NAMESPACES.filter((ns) => i18n.hasResourceBundle('nl', ns));
  const en = EN_ENCORE_NAMESPACES.filter((ns) => i18n.hasResourceBundle('en', ns));
  const reloads: Promise<unknown>[] = [];
  if (nl.length) reloads.push(i18n.reloadResources(['nl'], nl));
  if (en.length) reloads.push(i18n.reloadResources(['en'], en));
  if (reloads.length === 0) return;
  Promise.all(reloads).then(() => {
    // Re-render translated components (react-i18next listens for languageChanged).
    if (i18n.language) i18n.changeLanguage(i18n.language);
  });
}
