import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';

/**
 * "Voor wie" — a single lead paragraph on the warm-paper surface (#ECE4D2),
 * the same cream every other landing section uses.
 */
const PartnersWhoFor: React.FC = () => {
  const { t } = useTranslation('partners');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-8"
            style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('whoFor.title')}
          </h2>
          <p
            className="text-[#122E3B] font-medium leading-[1.6]"
            style={{ fontSize: 'clamp(18px, 1.9vw, 23px)', letterSpacing: '-0.008em' }}
          >
            {t('whoFor.body')}
          </p>
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersWhoFor;
