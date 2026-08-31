import React from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { trackCtaClick } from '@/lib/analytics';
import { CALENDLY_URL, CONTACT_EMAIL } from './constants';

/**
 * The pilot offer. The only block in the approved copy that carries its own
 * heading. Dark canvas so it reads as the page's one real ask.
 *
 * The paragraph is split around the address so the email can be a live
 * mailto link; keep the two halves' trailing/leading spaces when translating.
 */
const PartnersPilot: React.FC = () => {
  const { t } = useTranslation('partners');
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t('pilot.mailSubject'))}`;

  return (
    <section className="relative bg-[#213F4F] text-white py-20 md:py-28 overflow-hidden">
      <div
        className="absolute -bottom-72 -left-52 w-[760px] h-[760px] rounded-full pointer-events-none"
        style={{ background: 'rgba(212,160,36,0.12)', filter: 'blur(120px)' }}
      />

      <div className="lp-container relative z-10">
        <Reveal className="max-w-3xl">
          <h2
            className="font-heading font-bold text-white leading-[1.15]"
            style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('pilot.title')}
          </h2>

          <p className="mt-7 text-base md:text-lg text-white/70 font-medium leading-relaxed">
            {t('pilot.bodyBeforeEmail')}
            <a
              href={mailto}
              onClick={() => trackCtaClick('partner-pilot-mail')}
              className="text-[#D4A024] font-semibold underline underline-offset-4 decoration-[#D4A024]/40 hover:decoration-[#D4A024] transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
            {t('pilot.bodyAfterEmail')}
          </p>

          <div className="mt-10">
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCtaClick('partner-pilot-book')}
              className="lp-btn-primary lp-btn-gold"
            >
              {t('pilot.cta')}
              <CalendarClock size={18} strokeWidth={2.4} />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default PartnersPilot;
