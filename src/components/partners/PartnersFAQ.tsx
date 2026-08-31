import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

interface FaqItem {
  q: string;
  a: string;
}

/**
 * Partner FAQ. Native <details> accordions on the shared .lp-faq styling,
 * same as the homepage FAQ.
 */
const PartnersFAQ: React.FC = () => {
  const { t } = useTranslation('partners');
  const items = tArray<FaqItem>(t, 'faq.items');

  return (
    <section className="bg-[#ECE4D2] py-20 md:py-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-8"
            style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('faq.title')}
          </h2>
          {items.map((item, i) => (
            <details key={i} className="lp-faq" open={i === 0}>
              <summary>
                {item.q}
                <Plus className="lp-chev" size={20} strokeWidth={2.4} color="#27A1A1" />
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersFAQ;
