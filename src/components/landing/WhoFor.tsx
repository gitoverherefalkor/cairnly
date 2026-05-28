import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, XCircle } from 'lucide-react';
import Reveal from './Reveal';

const WhoFor: React.FC = () => {
  const { t } = useTranslation('landing');
  const rightItems = t('whoFor.rightItems', { returnObjects: true }) as string[];
  const notItems = t('whoFor.notItems', { returnObjects: true }) as string[];

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

        <div className="grid md:grid-cols-5 gap-6 md:gap-8 max-w-5xl mx-auto">
          {/* Right place — elevated */}
          <Reveal className="md:col-span-3">
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
                <ul className="space-y-4 text-[15px] text-[#122E3B] font-semibold leading-relaxed">
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

          {/* Not for you — muted */}
          <Reveal className="md:col-span-2">
            <div
              className="rounded-3xl p-8 md:p-10 h-full"
              style={{ background: 'rgba(18, 46, 59, 0.05)', border: '1px dashed rgba(107, 127, 139, 0.4)' }}
            >
              <h3
                className="font-heading font-bold text-[#6B7F8B] mb-6 flex items-center gap-2.5"
                style={{ fontSize: 15, letterSpacing: '-0.005em' }}
              >
                <XCircle size={18} strokeWidth={1.8} color="#9CA3AF" className="shrink-0" />
                {t('whoFor.notTitle')}
              </h3>
              <ul className="space-y-4 text-[13.5px] text-[#6B7F8B] font-medium leading-relaxed">
                {notItems.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[#9CA3AF]">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default WhoFor;
