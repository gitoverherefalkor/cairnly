import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Lock } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { tArray } from '@/lib/i18nArray';
import { trackCtaClick } from '@/lib/analytics';
import { CANDIDATE_START_EXAMPLE_PATH } from './constants';

/**
 * "Zo begint je kandidaat" — the branded landing page (/p/:slug) as a still
 * inside a browser frame, next to three lines on what the bureau gets there.
 *
 * The still shows the specimen partner "Loopbaanbureau Voorbeeld", the same
 * bureau whose logo is on the sample PDF, so a prospect sees one partner
 * carried through both branded moments. The link opens the real page.
 *
 * Re-shoot with scripts/partner-capture-still.mjs after a redesign of
 * PartnerLanding; one file per language, picked by the current i18n language.
 */
const PartnersCandidateStart: React.FC = () => {
  const { t, i18n } = useTranslation('partners');
  const lang = i18n.language?.startsWith('nl') ? 'nl' : 'en';
  const points = tArray<string>(t, 'candidateStart.points');

  return (
    <section className="bg-[#ECE4D2] pb-20 md:pb-28">
      <div className="lp-container">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14 items-center max-w-6xl">
          <Reveal className="lg:col-span-5">
            <h2
              className="font-heading font-bold text-[#122E3B] leading-[1.15]"
              style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
            >
              {t('candidateStart.title')}
            </h2>
            <p className="mt-5 text-[15px] md:text-base text-[#4B6373] font-medium leading-[1.65]">
              {t('candidateStart.body')}
            </p>
            <ul className="mt-6 space-y-3 p-0 m-0 list-none">
              {points.map((point, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: 'rgba(39,161,161,0.12)' }}
                  >
                    <Check size={13} strokeWidth={3} color="#1F8282" />
                  </span>
                  <span className="text-[15px] text-[#4B6373] font-medium leading-[1.6]">{point}</span>
                </li>
              ))}
            </ul>
            <a
              href={`${CANDIDATE_START_EXAMPLE_PATH}?lang=${lang}`}
              target="_blank"
              rel="noopener"
              onClick={() => trackCtaClick('partners_candidate_start_example')}
              className="mt-7 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#1F8282] hover:text-[#122E3B] transition-colors group"
            >
              {t('candidateStart.exampleCta')}
              <ArrowRight size={15} strokeWidth={2.4} className="transition-transform group-hover:translate-x-1" />
            </a>
          </Reveal>

          <Reveal className="lg:col-span-7">
            {/* Same browser chrome as the hero deck, so the still reads as a
                web page the candidate opens, not as a poster. */}
            <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10 bg-[#15262F]">
              <div className="flex items-center gap-3 px-3.5 h-9 bg-[#1B2E38] border-b border-black/30">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                </div>
                <div className="flex-1 flex items-center gap-1.5 px-3 h-6 rounded-md bg-black/25 text-white/55 text-[11px] font-medium min-w-0">
                  <Lock size={11} className="shrink-0 text-white/40" />
                  <span className="truncate">
                    cairnly.io/p/<span className="text-white/85">{t('candidateStart.urlSlug')}</span>
                  </span>
                </div>
              </div>
              <img
                src={`/images/live/partners/candidate-start-${lang}.jpg`}
                alt={t('candidateStart.imageAlt')}
                width={1800}
                height={1500}
                loading="lazy"
                className="block w-full h-auto"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default PartnersCandidateStart;
