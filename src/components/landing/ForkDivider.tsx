import React from 'react';
import { useTranslation } from 'react-i18next';
import CairnlySymbol from '@/logos/cairnly-logo/cairnly_logo_symbol_only.png';

/** The inflection-point divider: one approach path forks into a flat
 *  continuation and a rising golden path, with the cairn at the fork. */
const ForkDivider: React.FC = () => {
  const { t } = useTranslation('landing');

  return (
    <section className="bg-[#ECE4D2] relative overflow-hidden">
      <div className="lp-fork-divider lp-container">
        <svg viewBox="0 0 720 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="forkGold" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C8891A" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#E3B04D" />
            </linearGradient>
          </defs>

          {/* Approach path */}
          <path
            d="M 0 150 C 80 145, 160 132, 240 118 S 300 105, 330 100"
            stroke="#6B7F8B" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"
          />
          <circle cx="40" cy="148" r="1.8" fill="#6B7F8B" />
          <circle cx="110" cy="139" r="1.8" fill="#6B7F8B" />
          <circle cx="180" cy="127" r="1.8" fill="#6B7F8B" />
          <circle cx="250" cy="114" r="1.8" fill="#6B7F8B" />

          {/* Flat continuation */}
          <path
            d="M 330 100 C 420 108, 510 120, 600 130 S 680 140, 720 138"
            stroke="#9AA7B0" strokeWidth="1.8" fill="none" strokeDasharray="3 8"
            strokeLinecap="round" opacity="0.55"
          />
          <text x="560" y="160" className="lp-fork-label-old" textAnchor="middle">{t('forkDivider.oldLabel')}</text>
          <text x="560" y="176" fontFamily="Inter" fontSize="11" fill="#9AA7B0" fontWeight="500" textAnchor="middle">
            {t('forkDivider.oldSub')}
          </text>

          {/* Rising golden path */}
          <path
            d="M 330 100 C 440 70, 560 38, 720 14"
            stroke="url(#forkGold)" strokeWidth="2.6" fill="none" strokeLinecap="round"
          />
          <circle cx="420" cy="75" r="2.6" fill="#D4A024" />
          <circle cx="540" cy="48" r="2.6" fill="#D4A024" />
          <circle cx="660" cy="24" r="3" fill="#D4A024" />
          <text x="560" y="24" className="lp-fork-label-new" textAnchor="middle">{t('forkDivider.newLabel')}</text>
          <text x="560" y="42" fontFamily="Inter" fontSize="11" fill="#C8891A" fontWeight="600" textAnchor="middle">
            {t('forkDivider.newSub')}
          </text>

          {/* Cairn at the fork */}
          <image href={CairnlySymbol} x="303" y="58" width="54" height="60" preserveAspectRatio="xMidYMid meet" />
        </svg>
        <p className="text-center mt-6 text-[12px] uppercase tracking-[0.22em] font-heading font-bold text-[#6B7F8B]">
          {t('forkDivider.footer')}
        </p>
      </div>
    </section>
  );
};

export default ForkDivider;
