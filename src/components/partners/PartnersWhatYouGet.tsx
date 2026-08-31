import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

/**
 * "Wat de kandidaat krijgt" — the four deliverables as cards on cream.
 */
const PartnersWhatYouGet: React.FC = () => {
  const { t } = useTranslation('partners');
  const items = tArray<string>(t, 'whatYouGet.items');

  return (
    <section className="bg-[#ECE4D2] pb-20 md:pb-28">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.15] mb-8"
            style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('whatYouGet.title')}
          </h2>
        </Reveal>

        <Reveal className="grid gap-5 md:grid-cols-2 max-w-5xl">
          {items.map((item, i) => (
            <div
              key={i}
              className="lp-pillar-card rounded-2xl p-7 flex gap-4 items-start"
              style={{ background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' }}
            >
              <span
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: 'rgba(39,161,161,0.12)' }}
              >
                <Check size={15} strokeWidth={3} color="#1F8282" />
              </span>
              <p className="text-[15px] md:text-base text-[#4B6373] font-medium leading-[1.65]">
                {item}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersWhatYouGet;
