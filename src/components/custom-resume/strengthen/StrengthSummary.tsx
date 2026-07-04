// Strength pill + quick-wins banner for the results screen. Sits beside the
// ATS pill and reuses its exact pill anatomy (see CustomResumeResults ~l.351).
// States: no review + AUTO_ANALYZE → "analyzing"; pending fresh → analyzing;
// pending/applying stale (>6min, mirrors the server's 5min self-heal) → retry;
// failed → retry; ready+wins → banner (+ regenerate nudge if score_base < 40);
// ready+none pending → recruiter-ready.
import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { StrengthReview } from './types';

const FONT_DISPLAY = "'Poppins', sans-serif";
const TEAL = '#27A1A1';
const GOLD = '#D4A024';

// Client-side mirror of the backend's REVIEW_STALE_MS (5 min, see
// supabase/functions/resume-strengthen/strength.ts reviewInFlight). Kept
// slightly above the server threshold so a user-triggered retry always
// clears the server's own staleness guard by the time it arrives.
const CLIENT_STALE_MS = 6 * 60_000;

export function reviewLooksStuck(review: StrengthReview): boolean {
  if (review.status !== 'pending' && review.status !== 'applying') return false;
  const changed = Date.parse(review.status_changed_at ?? review.generated_at ?? '');
  return Number.isNaN(changed) || Date.now() - changed > CLIENT_STALE_MS;
}

export function StrengthPill({ review }: { review: StrengthReview }) {
  const { t } = useTranslation('resume');
  const tone = review.score >= 80 ? TEAL : review.score >= 60 ? GOLD : '#f97316';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 14px',
          borderRadius: 9999, background: `${tone}1A`, border: `1px solid ${tone}55`,
          color: tone, cursor: 'help',
        }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
            {review.score}
          </span>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {t('strengthen.pillLabel')}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent style={{ maxWidth: 260 }}>{t('strengthen.pillTooltip')}</TooltipContent>
    </Tooltip>
  );
}

export function StrengthBanner({
  review, hasEverApplied, onOpen,
}: { review: StrengthReview; hasEverApplied: boolean; onOpen: () => void }) {
  const { t } = useTranslation('resume');
  const wins = review.issues.filter((i) => i.status === 'pending').length;

  // Re-check every 30s while pending/applying so a wedged review flips to the
  // retry affordance client-side without waiting on a row update (the row may
  // never change again if WF10 genuinely crashed).
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (review.status !== 'pending' && review.status !== 'applying') return;
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [review.status]);

  const stuck = reviewLooksStuck(review);

  if (review.status === 'failed' || stuck) {
    return (
      <button onClick={onOpen} style={bannerShell('rgba(255,255,255,0.16)')}>
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
          {t('strengthen.analysisFailed')} <strong style={{ fontWeight: 700 }}>{t('strengthen.retry')}</strong>
        </span>
      </button>
    );
  }
  if (review.status === 'pending' || review.status === 'applying') {
    return (
      <div style={bannerShell('rgba(212,160,36,0.36)')}>
        <span style={{ color: '#EFBE48', fontSize: 13 }}>{t('strengthen.analyzing')}</span>
      </div>
    );
  }
  if (wins === 0) {
    return (
      <div style={bannerShell('rgba(39,161,161,0.42)')}>
        <span style={{ color: '#8FD3C5', fontSize: 13 }}>{t('strengthen.recruiterReady')}</span>
      </div>
    );
  }
  return (
    <button onClick={onOpen} style={{ ...bannerShell('rgba(212,160,36,0.42)'), cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: '#EFBE48' }}>
            {t(hasEverApplied ? 'strengthen.bannerTitleResume' : 'strengthen.bannerTitle', { count: wins })}
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
            {t('strengthen.bannerBody')}
          </div>
          {review.score_base < 40 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
              {t('strengthen.regenerateNudge')}
            </div>
          ) : null}
        </div>
        <span style={{
          fontWeight: 700, fontSize: 13, color: '#fff', background: TEAL,
          borderRadius: 9999, padding: '10px 18px', whiteSpace: 'nowrap',
        }}>
          {t(hasEverApplied ? 'strengthen.bannerCtaResume' : 'strengthen.bannerCta')}
        </span>
      </div>
    </button>
  );
}

const bannerShell = (borderColor: string): CSSProperties => ({
  display: 'flex', alignItems: 'center', width: '100%', padding: '12px 16px',
  background: 'rgba(18,46,59,0.55)', backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${borderColor}`,
  borderRadius: 14, marginTop: 12,
});
