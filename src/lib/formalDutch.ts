/**
 * Formal Dutch ("u") for Encore users.
 *
 * Cairnly's Dutch copy says "je". Encore (older professionals) says "u"
 * everywhere the user looks, except the shared AI coach chat, which stays "je"
 * until Encore has its own coach (decision 2026-11-08).
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

/** Namespaces with a nl-formal override file. chat + coach stay "je" on purpose. */
export const FORMAL_NAMESPACES = ['auth', 'common', 'dashboard', 'survey', 'report', 'payment'];

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
export function formalAwareRequest(
  _options: unknown,
  url: string,
  _payload: unknown,
  callback: (err: any, res?: { status: number; data: any }) => void,
): void {
  const target = nsFromUrl(url);
  const wantsFormal =
    !!target && target.lng === 'nl' && FORMAL_NAMESPACES.includes(target.ns) && isFormalDutchOn();

  fetch(url)
    .then(async (res) => {
      if (!res.ok) return callback(null, { status: res.status, data: '' });
      const base = await res.json();
      if (!wantsFormal) return callback(null, { status: 200, data: base });
      try {
        const overRes = await fetch(url.replace('/locales/nl/', '/locales/nl-formal/'));
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
  const loaded = FORMAL_NAMESPACES.filter((ns) => i18n.hasResourceBundle('nl', ns));
  if (loaded.length === 0) return;
  i18n.reloadResources(['nl'], loaded).then(() => {
    // Re-render translated components (react-i18next listens for languageChanged).
    if (i18n.language?.startsWith('nl')) i18n.changeLanguage(i18n.language);
  });
}
