import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

interface GetItem {
  title: string;
  body: string;
}

/** Six-card grid of everything included in the Encore report. */
const EncoreWhatYouGet: React.FC = () => {
  const { t } = useTranslation('encore');
  const items = tArray<GetItem>(t, 'get.items');

  return (
    <section className="bg-[#FAF5E8] py-24 md:py-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-16">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('get.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(28px, 3.2vw, 42px)', letterSpacing: '-0.012em' }}
          >
            {t('get.title')}
          </h2>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {items.map((item, i) => (
            <Reveal key={i}>
              <div
                className="lp-pillar-card rounded-3xl p-8 h-full"
                style={{ background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' }}
              >
                <CheckCircle2 size={24} strokeWidth={2.2} color="#27A1A1" className="mb-5" />
                <h3
                  className="font-heading font-bold text-[#122E3B] mb-2.5"
                  style={{ fontSize: 19, letterSpacing: '-0.01em' }}
                >
                  {item.title}
                </h3>
                <p className="text-[16px] text-[#4B6373] font-medium leading-relaxed">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EncoreWhatYouGet;
