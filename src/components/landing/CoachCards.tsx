import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';
import { trackCtaClick } from '@/lib/analytics';
import { DEMO_ROUTE } from '@/demo/constants';
import { useDemoHref } from './demo/HeroPersonaContext';

/**
 * The chat that comes with the dashboard, and the demo that proves it.
 *
 * Until 2026-09-16 this section carried a three-card device (a static PDF, a
 * Cairnly dashboard, a subscription chat). The outer two cards were the
 * comparison table's columns said a second time, so they went; the middle
 * card's point — the chat's one job is to sharpen the answer — now lives in
 * `chatRefine.intro`. The three-card markup is not archived: it was plain
 * cards, and the copy it held is the part worth keeping.
 */
const CoachCards: React.FC = () => {
  const { t } = useTranslation('landing');
  const demoHref = useDemoHref();

  return (
    <section className="bg-[#FAF5E8] py-24 md:py-32">
      <div className="lp-container">
        <div className="lp-chapter-rule mb-14">
          <span className="lp-chapter-rule__dot" />
        </div>

        <Reveal className="text-center max-w-3xl mx-auto mb-10">
          <div className="lp-eyebrow text-[#1F8282] mb-5">{t('chatRefine.eyebrow')}</div>
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
          >
            {t('chatRefine.titleA')}{' '}
            <br />
            <span className="lp-text-teal-grad">{t('chatRefine.titleHighlight')}</span>
          </h2>
          <p className="mt-6 text-lg text-[#4B6373] font-medium leading-relaxed">
            {t('chatRefine.intro')}
          </p>
        </Reveal>

        <Reveal as="div" className="max-w-3xl mx-auto">
          <p className="text-center text-base md:text-lg text-[#4B6373] italic font-medium leading-relaxed">
            {t('chatRefine.closer')}
          </p>
        </Reveal>

        {/* The proof for the claim above: a scrollable replay of a real
            session (/demo). A plain link, not an iframe — same-origin framing
            needs explicit header handling (see the partner sample PDF). */}
        <Reveal as="div" className="max-w-3xl mx-auto mt-10 text-center">
          <Link
            to={demoHref(DEMO_ROUTE)}
            onClick={() => trackCtaClick('landing_demo')}
            className="lp-btn-primary"
          >
            {t('chatRefine.demoCta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </Link>
          <p className="mt-4 text-[14px] text-[#4B6373]/85 font-medium">{t('chatRefine.demoNote')}</p>
        </Reveal>
      </div>
    </section>
  );
};

export default CoachCards;
