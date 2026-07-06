import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

interface IdentityBullet {
  title: string;
  body: string;
}

/**
 * "Retirement plans cover your money. Not your Mondays." Names the identity
 * loss this audience is facing, the mirror of the starter's LimboSection.
 */
const IdentitySection: React.FC = () => {
  const { t } = useTranslation('encore');
  const bullets = tArray<IdentityBullet>(t, 'identity.bullets');

  return (
    <section className="bg-[#FAF5E8] py-24 md:py-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-14">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('identity.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(28px, 3.2vw, 42px)', letterSpacing: '-0.012em' }}
          >
            {t('identity.title')}
          </h2>
          <p className="mt-6 text-lg md:text-xl text-[#4B6373] font-medium leading-relaxed">
            {t('identity.p1')}
          </p>
          <p className="mt-4 text-lg md:text-xl text-[#4B6373] font-medium leading-relaxed">
            {t('identity.p2')}
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
                  style={{ fontSize: 20, letterSpacing: '-0.01em' }}
                >
                  {b.title}
                </h3>
                <p className="text-[16.5px] text-[#4B6373] font-medium leading-relaxed">{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="max-w-3xl mt-14">
          <p className="text-lg md:text-xl text-[#122E3B] font-semibold leading-relaxed">
            {t('identity.closing')}
          </p>
        </Reveal>
      </div>
    </section>
  );
};

export default IdentitySection;
