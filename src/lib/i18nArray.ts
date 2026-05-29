/**
 * Safely read a `returnObjects: true` array from an i18next `t` function.
 *
 * Why this exists: i18n is configured with `react: { useSuspense: false }` and
 * loads namespaces asynchronously via HttpBackend. On the FIRST render (before
 * the namespace JSON has loaded) `t('some.array', { returnObjects: true })`
 * returns the key string, not the array. Calling `.map()` on that string throws
 * "X.map is not a function" and takes down the whole component tree.
 *
 * react-i18next re-renders the component once the namespace finishes loading, at
 * which point this returns the real array. So the empty array is only ever the
 * transient pre-load state.
 *
 * Use this anywhere a component maps over a translation array.
 */
export function tArray<T = unknown>(
  t: (key: string, opts?: Record<string, unknown>) => unknown,
  key: string,
): T[] {
  const value = t(key, { returnObjects: true });
  return Array.isArray(value) ? (value as T[]) : [];
}
