import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';

/**
 * "Voor wie" — a single lead paragraph on the warm-paper surface (#ECE4D2),
 * the same cream every other landing section uses. Deliberately headless: the
 * approved copy supplies no heading for this block.
 */
const PartnersWhoFor: React.FC = () => {
  const { t } = useTranslation('partners');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
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
