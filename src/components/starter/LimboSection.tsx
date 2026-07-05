import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

interface LimboBullet {
  title: string;
  body: string;
}

/** "The limbo is real" — names the entry-level squeeze the visitor is stuck in. */
const LimboSection: React.FC = () => {
  const { t } = useTranslation('starter');
  const bullets = tArray<LimboBullet>(t, 'limbo.bullets');

  return (
    <section className="bg-[#FAF5E8] py-24 md:py-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-14">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('limbo.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            {t('limbo.title')}
          </h2>
          <p className="mt-6 text-lg text-[#4B6373] font-medium leading-relaxed">
            {t('limbo.p1')}
          </p>
          <p className="mt-4 text-lg text-[#4B6373] font-medium leading-relaxed">
            {t('limbo.p2')}
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {bullets.map((b, i) => (
            <Reveal key={i}>
              <div
                className="lp-pillar-card rounded-3xl p-8 h-full"
                style={{ background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' }}
              >
                <div
                  className="w-9 h-1 rounded-full mb-6"
                  style={{ background: 'linear-gradient(90deg, #C8891A 0%, #F0C040 100%)' }}
                />
                <h3
                  className="font-heading font-bold text-[#122E3B] mb-3"
                  style={{ fontSize: 18, letterSpacing: '-0.01em' }}
                >
                  {b.title}
                </h3>
                <p className="text-[15px] text-[#4B6373] font-medium leading-relaxed">{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="max-w-3xl mt-14">
          <p className="text-lg text-[#122E3B] font-semibold leading-relaxed">
            {t('limbo.closing')}
          </p>
        </Reveal>
      </div>
    </section>
  );
};

export default LimboSection;
