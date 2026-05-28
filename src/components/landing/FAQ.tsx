import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import Reveal from './Reveal';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: React.FC = () => {
  const { t } = useTranslation('landing');
  const items = t('faq.items', { returnObjects: true }) as FaqItem[];

  return (
    <section className="bg-[#ECE4D2] py-24 md:py-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-14">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('faq.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            {t('faq.titleA')} <span className="lp-text-teal-grad">{t('faq.titleHighlight')}</span>
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

export default FAQ;
