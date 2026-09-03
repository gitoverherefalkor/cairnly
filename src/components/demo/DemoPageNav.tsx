import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { CALENDLY_URL } from '@/components/partners/constants';
import { DemoTrustBanner } from './DemoTrustBanner';

interface DemoPageNavProps {
  audience: 'customer' | 'partner';
  // "Demo: the dashboard", "Demo: the job search".
  label: string;
  // The previous demo page (with the carried query string) and its label.
  backTo: string;
  backLabel: string;
  onCta: () => void;
}

/**
 * The top bar of the read-only demo pages (/demo/dashboard, /demo/jobs):
 * trust bar, logo, page label, a link back to the previous demo page, the
 * language switcher, the audience CTA, and the honest label always in view.
 * The chat replay (/demo) has its own header (moments bar + progress).
 */
export const DemoPageNav: React.FC<DemoPageNavProps> = ({ audience, label, backTo, backLabel, onCta }) => {
  const { t } = useTranslation('demo');
  return (
    <>
      <DemoTrustBanner />
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between items-center py-2.5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/" className="flex items-center shrink-0">
                <img src="/logos/cairnly-logo.png" alt="Cairnly" className="h-12 w-auto" />
              </Link>
              <span className="hidden sm:flex items-center gap-3 text-sm font-medium text-atlas-navy truncate">
                <span className="h-4 w-px bg-gray-200" aria-hidden="true" />
                {label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                to={backTo}
                className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1F8282] hover:underline underline-offset-4 mr-2"
              >
                <ArrowLeft size={14} strokeWidth={2.4} />
                {backLabel}
              </Link>
              <LanguageSwitcher />
              <Button
                size="sm"
                onClick={onCta}
                className="bg-atlas-teal hover:bg-atlas-teal/90 text-white text-xs sm:text-sm"
              >
                {audience === 'partner' ? t('nav.ctaPartner') : t('nav.ctaCustomer')}
              </Button>
            </div>
          </div>
        </div>
        {/* The honest label, always in view, as on the chat replay. */}
        <div
          className="px-4 sm:px-6 py-1.5 flex items-center justify-end gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ background: '#FDFBF2', color: '#122E3B', borderTop: '1px solid rgba(201,182,144,0.5)' }}
        >
          <ShieldCheck size={13} strokeWidth={2.4} style={{ color: '#B8860B' }} />
          {t('nav.honest')}
        </div>
      </nav>
    </>
  );
};

/** Where the audience CTA goes: the pilot call for partners, checkout otherwise. */
export const demoCtaTarget = (audience: 'customer' | 'partner', navigate: (to: string) => void) => () => {
  if (audience === 'partner') window.open(CALENDLY_URL, '_blank', 'noopener');
  else navigate('/payment');
};
