import React from 'react';
import { useTranslation } from 'react-i18next';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';

interface StepCopy {
  title: string;
  body: string;
}

/** Four numbered steps from assessment to coach chat. Anchor target for the hero's secondary CTA. */
const EncoreHowItWorks: React.FC = () => {
  const { t } = useTranslation('encore');
  const steps = tArray<StepCopy>(t, 'how.steps');

  return (
    <section id="how-it-works" className="bg-[#ECE4D2] py-24 md:py-32 scroll-mt-32">
      <div className="lp-container">
        <Reveal className="max-w-3xl mb-16">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('how.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(28px, 3.2vw, 42px)', letterSpacing: '-0.012em' }}
          >
            {t('how.title')}
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-x-10 gap-y-14 max-w-5xl">
          {steps.map((step, i) => (
            <Reveal key={i}>
              <div className="flex items-start gap-5">
                <span className="font-heading font-bold text-[#C9B690] text-[52px] leading-none shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3
                    className="font-heading font-bold text-[#122E3B] mb-2.5"
                    style={{ fontSize: 21, letterSpacing: '-0.01em' }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-[17px] text-[#4B6373] font-medium leading-relaxed max-w-md">
                    {step.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EncoreHowItWorks;
