import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { EMPLOYERS_ROUTE } from '@/components/employers/constants';
import { formatMoney, lowestPrice } from '@/components/employers/pricing';
import { useEmployerCurrency } from '@/components/employers/useEmployerCurrency';
import { trackCtaClick } from '@/lib/analytics';

/**
 * A slim "buying for a team?" strip right under the consumer price
 * (2026-10-15). HR leads who google Cairnly after a cold email land on the
 * homepage; the nav there only slides in after scrolling, so this is the
 * route to /employers they see next to the €59 they would otherwise assume
 * applies to them. Deliberately one line and one link: the pitch itself lives
 * on /employers.
 */
const EmployersBand: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('landing');
  // Same currency rule as /employers (GB visitors see pounds), so the price
  // here matches the one on the page this band links to.
  const currency = useEmployerCurrency();
  const minPrice = formatMoney(lowestPrice(currency), currency, i18n.language);

  return (
    <section className="bg-[#F4ECDA] text-[#122E3B] py-12 md:py-14 border-y border-[#C9B690]/60">
      <div className="lp-container">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
          <div>
            <div className="lp-eyebrow text-[#1F8282] mb-3">{t('employersBand.eyebrow')}</div>
            <h2
              className="font-heading font-bold leading-[1.2] mb-2"
              style={{ fontSize: 'clamp(20px, 1.8vw, 26px)', letterSpacing: '-0.012em' }}
            >
              {t('employersBand.title')}
            </h2>
            <p className="text-[15px] text-[#374151] max-w-2xl">{t('employersBand.body', { minPrice })}</p>
          </div>
          <a
            href={EMPLOYERS_ROUTE}
            onClick={(e) => { e.preventDefault(); trackCtaClick('employers_band'); navigate(EMPLOYERS_ROUTE); }}
            className="lp-btn-primary lp-btn-outline shrink-0 self-start md:self-auto"
          >
            {t('employersBand.cta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </a>
        </div>
      </div>
    </section>
  );
};

export default EmployersBand;
