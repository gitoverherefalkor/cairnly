import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';

/**
 * Closing footnote: legal entity plus the beta-rate deadline. Small type on
 * cream, sitting just above the site footer.
 */
const PartnersClosing: React.FC = () => {
  const { t } = useTranslation('partners');

  return (
    <section className="bg-[#ECE4D2] pb-20 md:pb-24">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <div className="lp-chapter-rule mb-8">
            <span className="lp-chapter-rule__dot" />
          </div>
          <p className="text-[13px] text-[#4B6373]/80 font-medium leading-[1.7]">
            {t('closing.body')}
          </p>
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersClosing;
