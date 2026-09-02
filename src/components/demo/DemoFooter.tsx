import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Download, ShieldCheck } from 'lucide-react';
import { DEMO_PDF_PATH, DEMO_PARTNER_TEMPLATE_PDF_PATH } from '@/demo/constants';
import { CALENDLY_URL } from '@/components/partners/constants';
import { trackCtaClick } from '@/lib/analytics';

interface DemoFooterProps {
  // 'partner' when the visitor arrived through a partner link (?p=…):
  // the primary CTA becomes the pilot call instead of the checkout.
  audience: 'customer' | 'partner';
}

/**
 * End of the replay: the honest label spelled out, the PDF as the footnote
 * (the transcript made the argument, the document is the proof), and one
 * call to action per audience.
 */
export const DemoFooter: React.FC<DemoFooterProps> = ({ audience }) => {
  const { t } = useTranslation('demo');
  const partner = audience === 'partner';

  return (
    <section
      className="rounded-[20px] border px-5 py-6 sm:px-7 sm:py-8 mt-10"
      style={{
        background: '#FDFBF2',
        borderColor: 'rgba(201, 182, 144, 0.6)',
        boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
      }}
    >
      <div
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] mb-4"
        style={{
          background: 'rgba(212,160,36,0.12)',
          border: '1px solid rgba(212,160,36,0.5)',
          color: '#122E3B',
        }}
      >
        <ShieldCheck size={13} strokeWidth={2.4} style={{ color: '#B8860B' }} />
        {t('footer.eyebrow')}
      </div>
      <h2
        className="font-heading text-[24px] sm:text-[28px] mb-3"
        style={{ color: '#122E3B', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.15 }}
      >
        {t('footer.title')}
      </h2>
      <p className="text-[15px] sm:text-base text-[#4B6373] font-medium leading-[1.65] max-w-2xl">
        {t('footer.body')}
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <div>
          {/* Customers get her plain report; partners get the same report as
              the white-label template ([partnernaam], no logo). */}
          <a
            href={partner ? DEMO_PARTNER_TEMPLATE_PDF_PATH : DEMO_PDF_PATH}
            download
            onClick={() => trackCtaClick(partner ? 'demo_pdf_partner_template' : 'demo_pdf')}
            className="lp-btn-primary !text-[15px] !py-3 !px-6"
          >
            {partner ? t('footer.pdfPartner') : t('footer.pdf')}
            <Download size={17} strokeWidth={2.4} />
          </a>
          <p className="mt-2.5 text-[13px] text-[#4B6373]/85 font-medium leading-relaxed">
            {partner ? t('footer.pdfPartnerNote') : t('footer.pdfNote')}
          </p>
        </div>
        <div>
          {partner ? (
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCtaClick('demo_partner_call')}
              className="lp-btn-primary lp-btn-gold !text-[15px] !py-3 !px-6"
            >
              {t('footer.ctaPartner')}
              <ArrowRight size={17} strokeWidth={2.4} />
            </a>
          ) : (
            <Link
              to="/payment"
              onClick={() => trackCtaClick('demo_start')}
              className="lp-btn-primary lp-btn-gold !text-[15px] !py-3 !px-6"
            >
              {t('footer.ctaCustomer')}
              <ArrowRight size={17} strokeWidth={2.4} />
            </Link>
          )}
          <p className="mt-2.5 text-[13px] text-[#4B6373]/85 font-medium leading-relaxed">
            {partner ? t('footer.ctaPartnerNote') : t('footer.ctaCustomerNote')}
          </p>
        </div>
      </div>

      <p className="mt-6 text-[14px] font-medium">
        <Link
          to={partner ? '/partners' : '/#how-it-works'}
          className="inline-flex items-center gap-1.5 text-[#1F8282] font-semibold underline underline-offset-4 decoration-[#1F8282]/40 hover:decoration-[#1F8282] transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={2.4} />
          {partner ? t('footer.backPartners') : t('footer.backHome')}
        </Link>
      </p>
    </section>
  );
};
