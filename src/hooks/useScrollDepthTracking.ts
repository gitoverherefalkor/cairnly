import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackScrollDepth } from '@/lib/analytics';

// Scroll-depth milestones (25/50/75/100%) on the landing page and /partners
// (added 2026-10-06 with the partners hero reorg, to see how far practitioners
// read). Fires each milestone at most once per page per tab session, guarded here via
// sessionStorage (fast, avoids re-sending an already-crossed milestone on
// every scroll tick) and again in the DB via a unique index, so a cleared
// guard or a race can't double-count.

const MILESTONES = [25, 50, 75, 100] as const;
const TRACKED_PATHS = new Set(['/', '/partners']);
const REACHED_KEY_PREFIX = 'cairnly_scroll_reached_';

// The homepage keeps its original key shape so sessions already in flight
// don't re-send milestones they crossed before this change.
const reachedKey = (path: string, milestone: number) =>
  path === '/' ? REACHED_KEY_PREFIX + milestone : `${REACHED_KEY_PREFIX}${path}_${milestone}`;

function hasReached(path: string, milestone: number): boolean {
  try {
    return sessionStorage.getItem(reachedKey(path, milestone)) === '1';
  } catch {
    return false;
  }
}

function markReached(path: string, milestone: number): void {
  try {
    sessionStorage.setItem(reachedKey(path, milestone), '1');
  } catch {
    /* ignore */
  }
}

export function useScrollDepthTracking() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    if (!TRACKED_PATHS.has(path)) return;

    let ticking = false;

    const checkDepth = () => {
      ticking = false;
      const doc = document.documentElement;
      const scrollableHeight = doc.scrollHeight - doc.clientHeight;
      // Nothing to scroll (short page / not yet rendered) — nothing to report.
      if (scrollableHeight <= 0) return;

      const pct = ((window.scrollY + doc.clientHeight) / doc.scrollHeight) * 100;

      for (const milestone of MILESTONES) {
        if (pct >= milestone && !hasReached(path, milestone)) {
          markReached(path, milestone);
          trackScrollDepth(path, milestone);
        }
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(checkDepth);
    };

    // Catches the case where the page loads already scrolled far enough
    // (e.g. anchor-link entry) to clear a milestone without a scroll event.
    checkDepth();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);
}
