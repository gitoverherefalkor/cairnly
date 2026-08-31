import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import '../../components/landing/landing.css';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import Seo from '@/components/Seo';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';
import { trackSampleView } from '@/lib/analytics';
import { SAMPLE_PDF_PATH } from '@/components/partners/constants';

/**
 * Inline PDF viewers are a lie on iOS: every browser there is WebKit, and
 * WebKit renders a PDF in an <iframe> as a single non-scrollable first page
 * (or nothing at all). Rather than ship a broken frame, those visitors get an
 * open-in-a-new-tab button, where Safari's own full-screen PDF viewer works
 * fine. Detected on the platform, not the viewport, so a small desktop window
 * still gets the embed.
 */
function usesNativePdfViewer(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (/Macintosh/.test(ua) && typeof document !== 'undefined' && navigator.maxTouchPoints > 1);
  return !isIOS;
}

/**
 * /partners/voorbeeldrapport — the specimen report a prospect opens from the
 * partner page or straight from an outreach mail.
 *
 * `?p=<slug>` tags which prospect the link went to; utm_* params ride along.
 * Both are recorded once on mount through the existing first-party analytics
 * beacon (no new tracking system, see trackSampleView).
 */
const PartnerSampleReport: React.FC = () => {
  const { t } = useTranslation('partners');
  const location = useLocation();
  const [canEmbed] = useState(usesNativePdfViewer);
  // The beacon must fire exactly once per mount, not on every rerender and not
  // twice under React 18 StrictMode's double-invoked effects in dev.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackSampleView(location.pathname, location.search);
  }, [location.pathname, location.search]);

  return (
    <div
      className="min-h-screen font-sans overflow-x-clip"
      style={{ background: '#ECE4D2', color: '#122E3B' }}
    >
      <Seo title={t('sample.seoTitle')} description={t('sample.seoDescription')} path="/partners/voorbeeldrapport" />
      <LandingNav variant="page" />

      <main className="pt-12 md:pt-16 pb-20 md:pb-28">
        <div className="lp-container">
          <p className="text-[14px] text-[#4B6373] font-medium">
            {t('sample.backLead')}{' '}
            <Link
              to="/partners"
              className="inline-flex items-center gap-1.5 text-[#1F8282] font-semibold underline underline-offset-4 decoration-[#1F8282]/40 hover:decoration-[#1F8282] transition-colors"
            >
              <ArrowLeft size={14} strokeWidth={2.4} />
              {t('sample.backLink')}
            </Link>
          </p>

          <p
            className="mt-8 max-w-3xl text-[#122E3B] font-medium leading-[1.6]"
            style={{ fontSize: 'clamp(17px, 1.7vw, 21px)', letterSpacing: '-0.008em' }}
          >
            {t('sample.intro')}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href={SAMPLE_PDF_PATH} download className="lp-btn-primary">
              {t('sample.download')}
              <Download size={18} strokeWidth={2.4} />
            </a>
            {!canEmbed && (
              <a
                href={SAMPLE_PDF_PATH}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn-primary lp-btn-gold"
              >
                {t('sample.openInTab')}
                <ExternalLink size={18} strokeWidth={2.4} />
              </a>
            )}
          </div>

          {canEmbed && (
            <div
              className="mt-10 rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(201, 182, 144, 0.6)',
                boxShadow: '0 20px 50px -28px rgba(18,46,59,0.30)',
                background: '#FBF6E8',
              }}
            >
              <iframe
                src={`${SAMPLE_PDF_PATH}#view=FitH`}
                title={t('sample.viewerTitle')}
                className="w-full block"
                style={{ height: 'min(1150px, 85vh)', border: 'none' }}
              />
            </div>
          )}
        </div>
      </main>

      <LandingFooter />
    </div>
  );
};

export default PartnerSampleReport;
