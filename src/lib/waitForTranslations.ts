/**
 * Resolves when the translations are ready, when loading them fails, or after
 * `capMs`, whichever comes first. main.tsx holds the first render on this so
 * visitors don't see raw keys ("hero.titleA") while the locale JSON loads,
 * while a slow or broken fetch can never keep the page blank for long.
 */
export function waitForTranslations(ready: Promise<unknown>, capMs: number): Promise<void> {
  return Promise.race([
    ready.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, capMs)),
  ]);
}
