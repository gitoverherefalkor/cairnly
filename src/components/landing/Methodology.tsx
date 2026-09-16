import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Lock, Trash2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Reveal from './Reveal';
import { CareerScoreCard } from '@/components/chat/CareerScoreCard';
import { trackCtaClick } from '@/lib/analytics';
import { DEMO_ROUTE } from '@/demo/constants';
import { useDemoHref } from './demo/HeroPersonaContext';

/**
 * The whole methodology argument in one section: what we build on, how it
 * runs, what it hands you, and the chat that lets you argue with it.
 *
 * Assembled on 2026-09-16 from three pieces that used to be scattered. The
 * engine block and the "plan adapts" block lived in a separate cream section
 * (CoachCards, now retired), and the rated-role pills lived in the pricing
 * panel, where they read as a stray dark box. Each piece carried its own
 * eyebrow, so the page showed four eyebrow-title-subtitle stacks making one
 * argument. There is now a single eyebrow and a single h2; everything below
 * is h3s under it.
 *
 * The engine diagram this section used to end on was retired the same day
 * (src/unused/landing/WorkflowDiagramV2.tsx): it published the pipeline step
 * by step, and its labels were hardcoded English on a bilingual page.
 */
const Methodology: React.FC = () => {
  const { t } = useTranslation('landing');
  const demoHref = useDemoHref();

  return (
    <section
      id="methodology"
      className="bg-[#213F4F] text-white py-24 md:py-32 scroll-mt-32 relative overflow-hidden"
    >
      <div className="lp-container relative z-10">
        {/* max-w-4xl, not 3xl: at 3xl the first line wrapped and left "right,"
            stranded on a line of its own. */}
        <Reveal className="text-center max-w-4xl mx-auto mb-16">
          <div className="lp-eyebrow text-[#D4A024] mb-5">{t('methodology.eyebrow')}</div>
          <h2
            className="font-heading font-bold leading-[1.12]"
            style={{ fontSize: 'clamp(26px, 3vw, 44px)', letterSpacing: '-0.012em' }}
          >
            {t('methodology.titleA')}
            <br />
            <span className="lp-text-gold-grad">{t('methodology.titleHighlight')}</span>
          </h2>
          <p className="mt-7 text-lg text-white/65 font-medium leading-relaxed max-w-3xl mx-auto">
            {t('methodology.intro')}
          </p>
        </Reveal>

        {/* What we build on: the old way, and ours. */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
          {/* Old approach */}
          <Reveal
            className="rounded-3xl p-8 md:p-10"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span
              className="inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase mb-7"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}
            >
              {t('methodology.oldCard.pill')}
            </span>
            <h3 className="font-heading font-bold text-2xl md:text-3xl text-white mb-5" style={{ letterSpacing: '-0.012em' }}>
              {t('methodology.oldCard.title')}
            </h3>
            <p className="text-[15px] text-white/65 font-medium leading-relaxed mb-5">
              {t('methodology.oldCard.p1')}
            </p>
            <p className="text-[15px] text-white/65 font-medium leading-relaxed">
              {t('methodology.oldCard.p2')}
            </p>
          </Reveal>

          {/* Cairnly approach */}
          <Reveal
            className="rounded-3xl p-8 md:p-10"
            style={{
              background: '#FBF6E8',
              border: '1px solid #D4A024',
              color: '#122E3B',
              boxShadow: '0 30px 60px -25px rgba(212,160,36,0.4)',
            }}
          >
            <span
              className="inline-block px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase mb-7"
              style={{ background: '#D4A024', color: '#1A1A1A', letterSpacing: '0.12em' }}
            >
              {t('methodology.newCard.pill')}
            </span>
            <h3 className="font-heading font-bold text-2xl md:text-3xl text-[#122E3B] mb-5" style={{ letterSpacing: '-0.012em' }}>
              {t('methodology.newCard.title')}
            </h3>
            <p className="text-[15px] text-[#4B6373] font-medium leading-relaxed mb-5">
              {t('methodology.newCard.p1')}{' '}
              <strong className="text-[#122E3B]">{t('methodology.newCard.p1Emphasis')}</strong>
            </p>
            <p className="text-[15px] text-[#4B6373] font-medium leading-relaxed">
              {t('methodology.newCard.p2')}
            </p>
          </Reveal>
        </div>

        {/* How it runs, and what you can do with what comes out. Two h3s under
            the section's own heading — no second eyebrow, no second chapter. */}
        <div className="grid md:grid-cols-2 gap-10 md:gap-14 max-w-6xl mx-auto mt-16 md:mt-20 pt-16 md:pt-20 border-t border-white/10">
          <Reveal as="div">
            <h3
              className="font-heading font-bold text-white leading-[1.15]"
              style={{ fontSize: 'clamp(21px, 2vw, 28px)', letterSpacing: '-0.012em' }}
            >
              {t('methodology.engineTitle')}
            </h3>
            <p className="mt-4 text-[16px] text-white/65 font-medium leading-relaxed">
              {t('methodology.engineSubtitle')}
            </p>
          </Reveal>

          <Reveal as="div">
            <h3
              className="font-heading font-bold text-white leading-[1.15]"
              style={{ fontSize: 'clamp(21px, 2vw, 28px)', letterSpacing: '-0.012em' }}
            >
              {/* Hard break at the clause boundary: the gold half is its own
                  sentence and must start its own line, never trail one or two
                  words onto the end of the line above. */}
              {t('chatRefine.titleA')}
              <br />
              <span className="lp-text-gold-grad">{t('chatRefine.titleHighlight')}</span>
            </h3>
            <p className="mt-4 text-[16px] text-white/65 font-medium leading-relaxed">
              {t('chatRefine.intro')}
            </p>
          </Reveal>
        </div>

        {/* What every suggested role comes back rated on. Moved here from the
            pricing panel on 2026-09-16, where a dark box in a cream column
            read as pasted in; it belongs with the description of the output. */}
        <Reveal as="div" className="max-w-6xl mx-auto mt-12 md:mt-14">
          <div
            className="rounded-2xl px-6 py-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
              {t('pricing.pillPreviewLabel')}
            </p>
            {/* The real per-career pill row (score gauge, AI impact, move
                effort) — the exact component every report renders, not a
                landing-only restyle, so a visitor sees precisely what they'd
                get. */}
            <div className="flex justify-center">
              <CareerScoreCard score={84} aiImpact="High" move="Ready now" />
            </div>
          </div>
        </Reveal>

        {/* The proof: a scrollable replay of a real session (/demo). A plain
            link, not an iframe — same-origin framing needs explicit header
            handling (see the partner sample PDF). */}
        <Reveal as="div" className="mt-12 text-center">
          <Link
            to={demoHref(DEMO_ROUTE)}
            onClick={() => trackCtaClick('landing_demo')}
            className="lp-btn-primary"
          >
            {t('chatRefine.demoCta')}
            <ArrowRight size={18} strokeWidth={2.4} />
          </Link>
          <p className="mt-4 text-[14px] text-white/50 font-medium">{t('chatRefine.demoNote')}</p>
        </Reveal>

        <Reveal as="div" className="max-w-3xl mx-auto mt-16 md:mt-20">
          {/* Trust row: one line on desktop, stacked on phones. flex-nowrap
              plus whitespace-nowrap on each item, so it never breaks into the
              ragged two-and-one arrangement it had before. */}
          <div className="mt-10 md:mt-12 flex flex-col sm:flex-row sm:flex-nowrap items-center justify-center gap-y-3 sm:gap-x-6 text-[12px] font-medium text-white/65">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Shield size={14} strokeWidth={2} className="text-[#D4A024] shrink-0" />
              <span><strong className="text-white font-semibold">{t('methodology.trust.gdpr')}</strong> · {t('methodology.trust.gdprDetail')}</span>
            </div>
            <span className="hidden sm:inline text-white/15">·</span>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Lock size={14} strokeWidth={2} className="text-[#D4A024] shrink-0" />
              <span><strong className="text-white font-semibold">{t('methodology.trust.stripe')}</strong> · {t('methodology.trust.stripeDetail')}</span>
            </div>
            <span className="hidden sm:inline text-white/15">·</span>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Trash2 size={14} strokeWidth={2} className="text-[#D4A024] shrink-0" />
              <span><strong className="text-white font-semibold">{t('methodology.trust.delete')}</strong> · {t('methodology.trust.deleteDetail')}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default Methodology;
