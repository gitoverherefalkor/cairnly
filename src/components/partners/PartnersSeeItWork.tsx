import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bot, FileText, Globe, MessageCircle, Trophy, type LucideIcon } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';
import { CareerScoreCard } from '@/components/chat/CareerScoreCard';
import { demoSessionLanguage } from '@/demo/loadFixture';
import { tArray } from '@/lib/i18nArray';
import { trackCtaClick } from '@/lib/analytics';
import { DEMO_DASHBOARD_ROUTE, DEMO_ROUTE } from '@/demo/constants';
import { PARTNER_DEMO_PERSONA, partnerDemoLink, SAMPLE_ROUTE } from './constants';

/**
 * "Zie het werken": the first section under the hero since the 2026-10-06
 * reorg. The hero now carries the pre-chat, so the session brief that used to
 * sit beside the demo deck (who Marcel is, what his session shows) moved here,
 * next to the four deliverables that were their own section ("Wat je
 * kandidaat krijgt"). Two demo blocks became one.
 *
 * Each deliverable keeps its door to where a prospect can see it for real:
 * the top 3 and the per-career detail on Marcel's dashboard, the coach in his
 * session, the branded PDF on the specimen page. The door is a phrase inside
 * the card's own sentence (`whatYouGet.links`), not a "see it in the demo"
 * line under each card: four identical links read as noise. A phrase the
 * text no longer contains just renders unlinked. Every demo link carries
 * `?p=partners`, so the demo's own CTAs point at the pilot call and its PDF is
 * the white-label template.
 *
 * The icons are the ones the product uses for the same thing: the trophy of
 * the career sections in the chat, the dashboard's AI pill, the coach's chat
 * bubble, the report's file. The rating pills sit between the two rows, under
 * the cards that explain them.
 */
const PROOF: { to: string; id: string; icon: LucideIcon }[] = [
  { to: partnerDemoLink(DEMO_DASHBOARD_ROUTE), id: 'dashboard', icon: Trophy },
  { to: partnerDemoLink(DEMO_DASHBOARD_ROUTE), id: 'dashboard', icon: Bot },
  { to: partnerDemoLink(DEMO_ROUTE), id: 'chat', icon: MessageCircle },
  { to: SAMPLE_ROUTE, id: 'sample', icon: FileText },
];

/** The item text with `phrase` turned into its proof link, if it occurs. */
const LinkedItem: React.FC<{ text: string; phrase?: string; to: string; id: string }> = ({ text, phrase, to, id }) => {
  const at = phrase ? text.indexOf(phrase) : -1;
  if (!phrase || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Link
        to={to}
        onClick={() => trackCtaClick(`partners_whatyouget_${id}`)}
        className="font-semibold text-[#1F8282] underline decoration-[#1F8282]/40 underline-offset-[3px] hover:text-[#122E3B] hover:decoration-[#122E3B] transition-colors"
      >
        {phrase}
      </Link>
      {text.slice(at + phrase.length)}
    </>
  );
};

const PartnersSeeItWork: React.FC = () => {
  const { t } = useTranslation('partners');
  const items = tArray<string>(t, 'whatYouGet.items');
  const links = tArray<string>(t, 'whatYouGet.links');
  const persona = PARTNER_DEMO_PERSONA;
  const sees = tArray<string>(t, `heroDemo.cards.${persona}.see`);
  const traits = tArray<string>(t, `heroDemo.cards.${persona}.traits`);
  const sessionLang = demoSessionLanguage(persona);

  return (
    <section className="bg-[#ECE4D2] pt-20 md:pt-28 pb-4">
      <div className="lp-container">
        <Reveal className="max-w-3xl">
          <h2
            className="font-heading font-bold text-[#122E3B] leading-[1.15]"
            style={{ fontSize: 'clamp(24px, 2.8vw, 38px)', letterSpacing: '-0.012em' }}
          >
            {t('seeItWork.title')}
          </h2>
        </Reveal>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Who the demo is about, and the way into his session. */}
          <Reveal className="lg:col-span-5">
            <div
              className="rounded-2xl p-6 md:p-7"
              style={{ background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-[10px] font-heading font-bold tracking-[0.22em] uppercase text-[#1F8282]">
                  {t('hero.stageEyebrow')}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-[#122E3B]/[0.07] px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase text-[#4B6373]"
                  title={t(`heroDemo.sessionLanguage.${sessionLang}`)}
                >
                  <Globe size={11} strokeWidth={2.2} />
                  {sessionLang.toUpperCase()}
                </span>
              </div>

              <p className="mt-3 font-heading font-bold text-[#122E3B] text-[17px] md:text-[18px] leading-snug">
                {t(`heroDemo.cards.${persona}.who`)}
              </p>
              <p className="mt-1.5 text-[14px] md:text-[15px] italic text-[#4B6373] leading-snug">
                {t(`heroDemo.cards.${persona}.intent`)}
              </p>

              <p className="mt-6 text-[10px] font-bold tracking-[0.2em] uppercase text-[#1F8282]">
                {t(`heroDemo.cards.${persona}.seeLabel`)}
              </p>
              <ul className="mt-2 space-y-1 text-[14px] md:text-[15px] text-[#122E3B] font-medium leading-snug">
                {sees.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className="text-[#D4A024] mt-[1px]">
                      ·
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {/* Labels, not buttons: they stay round. */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {traits.map((trait) => (
                  <span
                    key={trait}
                    className="rounded-full border border-[#C9B690] px-2.5 py-0.5 text-[11px] font-semibold text-[#4B6373]"
                  >
                    {trait}
                  </span>
                ))}
              </div>

              {/* Side by side: the narrower inline padding is what lets both
                  fit the card at xl; narrower screens still wrap. */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={partnerDemoLink()}
                  onClick={() => trackCtaClick('partners_seeitwork_demo')}
                  className="lp-btn-primary"
                  style={{ paddingInline: 20 }}
                >
                  {t('hero.demoCta')}
                  <ArrowRight size={18} strokeWidth={2.4} />
                </Link>
                <Link
                  to={SAMPLE_ROUTE}
                  onClick={() => trackCtaClick('partners_seeitwork_sample')}
                  className="lp-btn-primary lp-btn-outline"
                  style={{ paddingInline: 20 }}
                >
                  {t('hero.sampleCta')}
                  <ArrowUpRight size={16} strokeWidth={2.4} />
                </Link>
              </div>
            </div>
          </Reveal>

          {/* What the candidate walks away with, each with its proof. */}
          <Reveal className="lg:col-span-7">
            <p className="text-[11px] font-heading font-bold tracking-[0.18em] uppercase text-[#4B6373]">
              {t('whatYouGet.title')}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {items.map((item, i) => {
                const proof = PROOF[i];
                const Icon = proof?.icon;
                return (
                  <React.Fragment key={i}>
                    {/* The pills every career comes back with, after the two
                        cards that explain the score and the AI rating. */}
                    {i === 2 && (
                      <div className="sm:col-span-2 flex justify-center [&>div]:mb-0 [&>div]:mt-0 [&>div]:justify-center">
                        <CareerScoreCard score={84} aiImpact="High" move="Ready now" />
                      </div>
                    )}
                    <div
                      className="lp-pillar-card rounded-2xl p-5 flex gap-3.5 items-start"
                      style={{ background: '#FBF6E8', border: '1px solid rgba(201, 182, 144, 0.6)' }}
                    >
                      {Icon && (
                        <span
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                          style={{ background: 'rgba(39,161,161,0.12)' }}
                        >
                          <Icon size={16} strokeWidth={2.2} color="#1F8282" />
                        </span>
                      )}
                      <p className="text-[14.5px] text-[#4B6373] font-medium leading-[1.6]">
                        {proof ? <LinkedItem text={item} phrase={links[i]} to={proof.to} id={proof.id} /> : item}
                      </p>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

export default PartnersSeeItWork;
