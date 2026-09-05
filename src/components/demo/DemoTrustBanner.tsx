import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldCheck, Trash2 } from 'lucide-react';

// How far down the page the visitor scrolls before the banner folds away.
const HIDE_AFTER_PX = 40;
// Tall enough for the three items wrapped onto three lines on a phone; the
// transition needs a fixed number, the real height is smaller on desktop.
const OPEN_MAX_PX = 160;

/**
 * The landing page's dark trust bar, for the demo pages: GDPR, data
 * security, one-click delete. No payment line here, the demo is not a
 * checkout. It sits above the sticky nav and folds away once the visitor
 * starts scrolling (the transcript needs the vertical space more than a
 * reassurance does), coming back at the top of the page.
 */
export const DemoTrustBanner: React.FC = () => {
  const { t } = useTranslation('demo');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const update = () => setHidden(window.scrollY > HIDE_AFTER_PX);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const items = [
    { icon: Shield, title: t('trust.gdpr'), detail: t('trust.gdprDetail') },
    { icon: ShieldCheck, title: t('trust.security'), detail: t('trust.securityDetail') },
    { icon: Trash2, title: t('trust.delete'), detail: t('trust.deleteDetail') },
  ];

  return (
    <div
      aria-hidden={hidden}
      // relative + z-index: the demo page paints a `fixed inset-0` canvas
      // behind everything, and a plain block sibling ends up under it (the
      // banner was invisible on phones, only its empty band showed).
      className="relative z-10 bg-[#1A1A1A] text-white/80 overflow-hidden transition-all duration-300 ease-out"
      style={{ maxHeight: hidden ? 0 : OPEN_MAX_PX, opacity: hidden ? 0 : 1 }}
    >
      <div className="lp-container py-2.5 flex items-center justify-center gap-x-6 gap-y-1 flex-wrap text-[11px] font-medium tracking-wide">
        {items.map(({ icon: Icon, title, detail }, i) => (
          <React.Fragment key={title}>
            {i > 0 && <span className="text-white/20">·</span>}
            <div className="flex items-center gap-2">
              <Icon size={14} strokeWidth={2} />
              <span>
                <strong className="text-white font-semibold">{title}</strong> · {detail}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
