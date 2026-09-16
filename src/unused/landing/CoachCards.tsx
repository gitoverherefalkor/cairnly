import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';
import { trackCtaClick } from '@/lib/analytics';
import { DEMO_ROUTE } from '@/demo/constants';
import { useDemoHref } from './demo/HeroPersonaContext';

/**
 * How the engine works, and the chat that lets you argue with what it
 * produced. Two halves of one claim, so they share a cream section.
 *
 * Both halves arrived here by subtraction. Until 2026-09-16 this section
 * carried a three-card device (a static PDF, a Cairnly dashboard, a
 * subscription chat); the outer two cards were the comparison table's columns
 * said a second time, so they went, and the middle card's point now lives in
 * `chatRefine.intro`. On the same day the "inside the engine" block moved down
 * from Methodology, where a second centred eyebrow-title-subtitle stack
 * directly under the section's own heading read as a pile of headings.
 *
 * The layout is deliberately left-aligned, with one centred element (the demo
 * CTA). The previous version centred five different type treatments in a row.
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

        <div className="max-w-5xl mx-auto">
          {/* Half one: the engine, stated rather than drawn. */}
          <Reveal className="max-w-3xl">
            <div className="lp-eyebrow text-[#1F8282] mb-5">{t('methodology.engineEyebrow')}</div>
            <h2
              className="font-heading font-bold text-[#122E3B] leading-[1.12]"
              style={{ fontSize: 'clamp(26px, 3vw, 40px)', letterSpacing: '-0.012em' }}
            >
              {t('methodology.engineTitle')}
            </h2>
            <p className="mt-5 text-lg text-[#4B6373] font-medium leading-relaxed">
              {t('methodology.engineSubtitle')}
            </p>
          </Reveal>

          {/* Half two: the chat that sharpens what the engine produced. A hair
              rule rather than a second chapter divider — this is the same
              argument continuing, not a new chapter. */}
          <Reveal as="div" className="mt-14 md:mt-16 pt-14 md:pt-16 border-t border-[#C9B690]/50">
            <div className="max-w-3xl">
              <div className="lp-eyebrow text-[#1F8282] mb-5">{t('chatRefine.eyebrow')}</div>
              <h3
                className="font-heading font-bold text-[#122E3B] leading-[1.12]"
                style={{ fontSize: 'clamp(24px, 2.6vw, 34px)', letterSpacing: '-0.012em' }}
              >
                {t('chatRefine.titleA')}{' '}
                <span className="lp-text-teal-grad">{t('chatRefine.titleHighlight')}</span>
              </h3>
              <p className="mt-5 text-lg text-[#4B6373] font-medium leading-relaxed">
                {t('chatRefine.intro')}
              </p>
              <p className="mt-5 text-base md:text-lg text-[#4B6373] italic font-medium leading-relaxed">
                {t('chatRefine.closer')}
              </p>
            </div>
          </Reveal>

          {/* The proof for the claim above: a scrollable replay of a real
              session (/demo). A plain link, not an iframe — same-origin framing
              needs explicit header handling (see the partner sample PDF). */}
          <Reveal as="div" className="mt-12 text-center">
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
      </div>
    </section>
  );
};

export default CoachCards;
