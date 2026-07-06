import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { useEncoreGetStarted } from './useEncoreGetStarted';

const EncoreFinalCTA: React.FC = () => {
  const getStarted = useEncoreGetStarted();
  const { t } = useTranslation('encore');

  return (
    <section className="bg-[#213F4F] text-white py-28 md:py-36 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(212,160,36,0.10), transparent 60%)' }}
      />
      <Reveal className="lp-container relative z-10 text-center max-w-3xl mx-auto">
        <h2
          className="font-heading font-bold leading-[1.15]"
          style={{ fontSize: 'clamp(30px, 3.6vw, 46px)', letterSpacing: '-0.015em' }}
        >
          {t('finalCta.title')}
        </h2>
        <p className="mt-6 text-lg md:text-xl text-white/70 font-medium leading-relaxed max-w-xl mx-auto">
          {t('finalCta.body')}
        </p>
        <div className="mt-10 inline-flex flex-col items-center gap-5">
          <button onClick={getStarted} className="lp-btn-primary" style={{ fontSize: 18, padding: '18px 30px' }}>
            {t('finalCta.cta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
        </div>
      </Reveal>
    </section>
  );
};

export default EncoreFinalCTA;
