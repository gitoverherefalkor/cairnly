import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackScrollDepth } from '@/lib/analytics';

// Scroll-depth milestones (25/50/75/100%) on the main landing page only.
// Fires each milestone at most once per tab session — guarded here via
// sessionStorage (fast, avoids re-sending an already-crossed milestone on
// every scroll tick) and again in the DB via a unique index, so a cleared
// guard or a race can't double-count.

const MILESTONES = [25, 50, 75, 100] as const;
const REACHED_KEY_PREFIX = 'cairnly_scroll_reached_';

function hasReached(milestone: number): boolean {
  try {
    return sessionStorage.getItem(REACHED_KEY_PREFIX + milestone) === '1';
  } catch {
    return false;
  }
}

function markReached(milestone: number): void {
  try {
    sessionStorage.setItem(REACHED_KEY_PREFIX + milestone, '1');
  } catch {
    /* ignore */
  }
}

export function useScrollDepthTracking() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== '/') return;

    let ticking = false;

    const checkDepth = () => {
      ticking = false;
      const doc = document.documentElement;
      const scrollableHeight = doc.scrollHeight - doc.clientHeight;
      // Nothing to scroll (short page / not yet rendered) — nothing to report.
      if (scrollableHeight <= 0) return;

      const pct = ((window.scrollY + doc.clientHeight) / doc.scrollHeight) * 100;

      for (const milestone of MILESTONES) {
        if (pct >= milestone && !hasReached(milestone)) {
          markReached(milestone);
          trackScrollDepth('/', milestone);
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
