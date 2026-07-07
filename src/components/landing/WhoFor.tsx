import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, XCircle } from 'lucide-react';
import Reveal from './Reveal';
import { tArray } from '@/lib/i18nArray';
import { useIntent, type IntentKey } from '@/contexts/IntentContext';

/** Which rightItems bullet moves to the front per intent (index in the default order). */
const FIRST_ITEM: Partial<Record<IntentKey, number>> = {
  'good-at-it': 0,
  'ai-worried': 2,
  'life-changed': 2,
  'understand-myself': 3,
};

const WhoFor: React.FC = () => {
  const { t } = useTranslation('landing');
  const { intent } = useIntent();
  const defaultItems = tArray<string>(t, 'whoFor.rightItems');
  const firstIdx = FIRST_ITEM[intent];
  const rightItems =
    firstIdx !== undefined && defaultItems.length > firstIdx
      ? [defaultItems[firstIdx], ...defaultItems.filter((_, i) => i !== firstIdx)]
      : defaultItems;
  const notItems = tArray<string>(t, 'whoFor.notItems');

  return (
    <section className="bg-[#FAF5E8] py-24 md:py-32">
      <div className="lp-container">
        <Reveal className="text-center max-w-3xl mx-auto mb-16">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('whoFor.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            {t('whoFor.titleA')} <span className="lp-text-teal-grad">{t('whoFor.titleHighlight')}</span>
          </h2>
        </Reveal>

        <div className="flex flex-col gap-6 md:gap-8 max-w-3xl mx-auto">
          {/* Right place — elevated */}
          <Reveal>
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{
                background: '#FBF6E8',
                border: '1px solid #D4A024',
                boxShadow: '0 32px 60px -22px rgba(212,160,36,0.35), 0 0 0 6px rgba(212,160,36,0.08)',
              }}
            >
              <div style={{ height: 5, background: 'linear-gradient(90deg, #C8891A 0%, #F0C040 100%)' }} />
              <div className="p-8 md:p-10">
                <div className="flex items-center gap-3 mb-7">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #27A1A1, #3989AF)',
                      boxShadow: '0 8px 20px -8px rgba(39,161,161,0.5)',
                    }}
                  >
                    <Check size={22} strokeWidth={2.4} color="#fff" />
                  </div>
                  <h3 className="font-heading font-bold text-[#122E3B]" style={{ fontSize: 22, letterSpacing: '-0.012em' }}>
                    {t('whoFor.rightTitle')}
                  </h3>
                </div>
                <ul className="space-y-5 text-[17px] md:text-[18px] text-[#122E3B] font-semibold leading-relaxed">
                  {rightItems.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-[#D4A024] mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>

          {/* Not for you — muted, same footprint as the "right place" card */}
          <Reveal>
            <div
              className="rounded-3xl overflow-hidden"
              style={{ background: 'rgba(18, 46, 59, 0.04)', border: '1px solid rgba(107, 127, 139, 0.25)' }}
            >
              <div style={{ height: 5, background: 'rgba(107, 127, 139, 0.35)' }} />
              <div className="p-8 md:p-10">
                <div className="flex items-center gap-3 mb-7">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(107, 127, 139, 0.15)' }}
                  >
                    <XCircle size={20} strokeWidth={1.8} color="#6B7F8B" />
                  </div>
                  <h3 className="font-heading font-bold text-[#6B7F8B]" style={{ fontSize: 22, letterSpacing: '-0.012em' }}>
                    {t('whoFor.notTitle')}
                  </h3>
                </div>
                <ul className="space-y-5 text-[17px] md:text-[18px] text-[#6B7F8B] font-semibold leading-relaxed">
                  {notItems.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-[#9CA3AF] mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default WhoFor;
