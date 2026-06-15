import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, MessageSquare, BarChart3, CheckCircle2 } from 'lucide-react';
import Reveal from './Reveal';
import { tArray } from '@/lib/i18nArray';

// Icons stay fixed across languages — only title/body translate.
const PILLAR_META = [
  { num: '01', Icon: Navigation },
  { num: '02', Icon: MessageSquare },
  { num: '03', Icon: BarChart3 },
  { num: '04', Icon: CheckCircle2 },
] as const;

const Pillars: React.FC = () => {
  const { t } = useTranslation('landing');
  // Pillar copy comes from landing.json `pillars.cards` array. tArray guards
  // against the pre-load render where i18next returns the key string, not the array.
  const cards = tArray<{ title: string; body: string }>(t, 'pillars.cards');

  return (
    <section className="bg-[#FAF5E8] py-24 md:py-32">
      <div className="lp-container">
        <div className="lp-chapter-rule mb-14">
          <span className="lp-chapter-rule__dot" />
        </div>

        <Reveal className="text-center max-w-3xl mx-auto mb-16">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('pillars.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            {t('pillars.titleA')} <span className="lp-text-gold-grad">{t('pillars.titleHighlight')}</span> {t('pillars.titleB')}
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {PILLAR_META.map(({ num, Icon }, i) => (
            <Reveal
              key={num}
              className="lp-pillar-card relative p-8 md:p-10 rounded-2xl"
              style={{ background: '#FBF6E8', border: '1px solid #C9B690' }}
            >
              <div className="flex items-start justify-between mb-6">
                <span className="font-heading font-bold text-[44px] text-[#C9B690] leading-none">{num}</span>
                <Icon size={32} strokeWidth={1.8} className="opacity-80" color="#27A1A1" />
              </div>
              <h3
                className="font-heading font-bold text-2xl md:text-[24px] text-[#122E3B] mb-3"
                style={{ letterSpacing: '-0.01em' }}
              >
                {cards[i]?.title}
              </h3>
              <p className="text-[15px] text-[#4B6373] leading-relaxed font-medium">{cards[i]?.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pillars;
