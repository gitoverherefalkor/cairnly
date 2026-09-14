/**
 * The recording script (scripts/demo-record-hero.mjs) sets
 * `window.__CAIRNLY_DEMO_CAPTURE__ = true` before the page loads. A few
 * demo surfaces read it to behave like a camera-ready product: no tool
 * dialogs, no jobs redirect, no empty margin-note column, and a transcript
 * that reveals itself on the script's command. The site never sets it.
 */
declare global {
  interface Window {
    __CAIRNLY_DEMO_CAPTURE__?: boolean;
    /** Capture-only: show the first `count` messages of the replay. */
    __cairnlyDemoReveal?: (count: number) => void;
  }
}

export function isDemoCapture(): boolean {
  return typeof window !== 'undefined' && window.__CAIRNLY_DEMO_CAPTURE__ === true;
}
