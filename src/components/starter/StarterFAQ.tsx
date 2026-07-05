import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

interface FaqItem {
  q: string;
  a: string;
}

const StarterFAQ: React.FC = () => {
  const { t } = useTranslation('starter');
  const items = tArray<FaqItem>(t, 'faq.items');

  return (
    <section className="bg-[#ECE4D2] py-24 md:py-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-14">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('faq.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            {t('faq.title')}
          </h2>
        </Reveal>

        <Reveal className="max-w-3xl">
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

export default StarterFAQ;
