import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/format';
import {
  DISPLAY_CURRENCY,
  introPriceTimeLeft,
  proPriceAt,
  PRO_PRICE_REGULAR,
} from '@/lib/pricing';

/**
 * Countdown to the end of the introductory price.
 *
 * Days and hours only. A ticking seconds counter is the visual signature of
 * infomercials, and this audience (mid-career professionals weighing a real
 * decision) reads that as a reason to distrust the offer. The deadline is
 * genuine, so it does not need dressing up.
 *
 * Runs from now until the deadline, then disappears on its own with no deploy.
 */

interface PriceCountdownProps {
  /**
   * 'light' for the cream price panel, 'dark' for the navy intake card, 'gold'
   * for the hero, where the line has to earn attention on its own rather than
   * sit next to a price in 64px type.
   */
  tone?: 'light' | 'dark' | 'gold';
  /**
   * Selector to scroll to on click (e.g. '#pricing'). Turns the line into a
   * link. Omit on the price panels, which are already the destination.
   */
  href?: string;
  /**
   * Name the current price in the opening line. The price panels already show
   * it in 64px type right underneath; the hero does not show a price at all, so
   * there "ends in 65 days, then €59" would hang in mid-air.
   */
  leadWithPrice?: boolean;
  className?: string;
}

const TONES = {
  light: { primary: '#122E3B', muted: '#6B7F8B', size: 13 },
  dark: { primary: '#FFFFFF', muted: 'rgba(255,255,255,0.55)', size: 13 },
  gold: { primary: '#D4A024', muted: 'rgba(212,160,36,0.70)', size: 14 },
} as const;

const PriceCountdown: React.FC<PriceCountdownProps> = ({
  tone = 'light',
  leadWithPrice = false,
  href,
  className,
}) => {
  const { t, i18n } = useTranslation('landing');
  const [now, setNow] = useState(() => new Date());

  // A minute is granular enough when hours are the smallest unit shown, and it
  // keeps the component honest if someone leaves the page open past the switch.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const left = introPriceTimeLeft(now);
  if (!left) return null;

  const colors = TONES[tone];
  const regularPrice = formatCurrency(PRO_PRICE_REGULAR, i18n.language, DISPLAY_CURRENCY);

  // Drop whichever unit is zero: "1 day, 0 hours" and "0 days, 13 hours" both
  // read as a broken clock rather than a deadline.
  const parts: string[] = [];
  if (left.days > 0) parts.push(t('pricing.countdown.days', { count: left.days }));
  if (left.hours > 0) parts.push(t('pricing.countdown.hours', { count: left.hours }));
  // The final 59 minutes: both units are zero, and "0 hours" reads as expired.
  const remaining = parts.length > 0 ? parts.join(', ') : t('pricing.countdown.lastHour');

  const body = (
    <div role="timer" aria-live="off" style={{ textAlign: 'center', lineHeight: 1.5 }}>
      <p style={{ color: colors.primary, fontSize: colors.size, fontWeight: 700, margin: 0 }}>
        {leadWithPrice
          ? t('pricing.countdown.prefixWithPrice', {
              price: formatCurrency(proPriceAt(now), i18n.language, DISPLAY_CURRENCY),
            })
          : t('pricing.countdown.prefix')}{' '}
        {remaining}
      </p>
      <p style={{ color: colors.muted, fontSize: 12, fontWeight: 600, margin: 0 }}>
        {t('pricing.countdown.then', { price: regularPrice })}
      </p>
    </div>
  );

  if (!href) return <div className={className}>{body}</div>;

  return (
    <a
      href={href}
      className={`lp-countdown-link${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        const target = document.querySelector(href);
        // No target on this page: leave the plain anchor jump alone.
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      {body}
    </a>
  );
};

export default PriceCountdown;
