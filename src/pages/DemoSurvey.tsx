import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, MessageSquare } from 'lucide-react';
import '../components/landing/landing.css';
import Seo from '@/components/Seo';
import LandingFooter from '@/components/landing/LandingFooter';
import { PreSurveyUpload } from '@/components/assessment/PreSurveyUpload';
import { QuestionRenderer } from '@/components/survey/QuestionRenderer';
import { DemoPageNav, demoCtaTarget } from '@/components/demo/DemoPageNav';
import { DemoFooter } from '@/components/demo/DemoFooter';
import { trackSampleView, trackCtaClick } from '@/lib/analytics';
import { chooseFixture, demoPdfLanguage } from '@/demo/loadFixture';
import { demoLink, demoQuery, readPersonaParam } from '@/demo/links';
import { demoSurvey, initialResponses, resolveQuestion, surveyPersona } from '@/demo/survey';
import { DEMO_ROUTE, DEMO_SURVEY_ROUTE } from '@/demo/constants';

/**
 * /demo/survey — the first screens of the assessment, on the public demo.
 *
 * Three questions, not sixty: the résumé step that fills in the roles, the
 * happiness rating per role (where the report's central insight comes from),
 * the values ranking, and the schedule question with its non-negotiable
 * rider. Each one is the REAL component (PreSurveyUpload, QuestionRenderer)
 * fed from a frozen fixture, pre-filled with the persona's own answers and
 * editable — nothing is submitted, nothing reaches a backend.
 *
 * Under every question a link jumps into the chat replay at the exact message
 * where that answer paid off, which is the whole argument of this page: the
 * questions are not decoration, they are what the report is built from.
 */
// The three questions, in fixture order (see scripts/demo-export-survey.mjs).
const PAYOFF_KEYS = ['happiness', 'ranking', 'schedule'] as const;

const DemoSurvey: React.FC = () => {
  const { t, i18n } = useTranslation('demo');
  // The question card's eyebrow is the assessment's own string, so the demo
  // shows the real position ("Section 3 · Question 4 of 8") instead of
  // suggesting the survey is three questions long.
  const { t: tSurvey } = useTranslation('survey');
  const location = useLocation();
  const navigate = useNavigate();
  const audience: 'customer' | 'partner' = new URLSearchParams(location.search).has('p')
    ? 'partner'
    : 'customer';

  const choice = useMemo(
    () => chooseFixture(i18n.language, readPersonaParam(location.search)),
    [i18n.language, location.search],
  );
  const persona = surveyPersona(choice.personaId);

  // One beacon per mount, as on the other demo pages.
  const tracked = useRef(false);
  React.useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackSampleView(location.pathname, location.search);
  }, [location.pathname, location.search]);

  // The persona's own answers, editable and local. Nothing is persisted.
  const [responses, setResponses] = useState<Record<string, unknown>>(() =>
    initialResponses(choice.personaId),
  );
  const personaRef = useRef(choice.personaId);
  React.useEffect(() => {
    if (personaRef.current === choice.personaId) return;
    personaRef.current = choice.personaId;
    setResponses(initialResponses(choice.personaId));
  }, [choice.personaId]);

  const setAnswer = useCallback((id: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
  }, []);

  const questions = useMemo(
    () => demoSurvey.questions.map((row) => resolveQuestion(row, i18n.language)),
    [i18n.language],
  );

  const firstQuestionRef = useRef<HTMLDivElement>(null);
  const scrollToQuestions = () =>
    firstQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // "See what this became" → the chat replay, focused on one message.
  // The persona rides along explicitly: the message id only exists in this
  // persona's transcript, and without it a reader whose stored language
  // picks the other persona would land on a page where it means nothing.
  const chatLink = (messageId?: string) => {
    const params = new URLSearchParams(demoQuery(location.search).replace(/^\?/, ''));
    params.set('persona', choice.personaId);
    if (messageId) params.set('focus', messageId);
    return `${DEMO_ROUTE}?${params.toString()}`;
  };

  const onCta = demoCtaTarget(audience, navigate);

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip">
      <Seo
        title={t('surveyDemo.seo.title')}
        description={t('surveyDemo.seo.description')}
        path={DEMO_SURVEY_ROUTE}
      />
      <div className="fixed inset-0 survey-bg" aria-hidden="true" />

      <div className="relative z-10">
        <DemoPageNav
          audience={audience}
          label={t('surveyDemo.nav.label')}
          backTo={demoLink(DEMO_ROUTE, location.search)}
          backLabel={t('surveyDemo.nav.back')}
          onCta={onCta}
        />
      </div>

      <main className="relative z-10 flex-1">
        <div className="w-full max-w-[800px] mx-auto px-3 sm:px-6 pt-6 sm:pt-10 pb-16">
          {/* Editorial opening on the canvas, not a card: three stacked cream
              boxes (intro, résumé step, questions) read as a wall. */}
          <header className="mb-9 sm:mb-11 max-w-[62ch]">
            <div className="lp-eyebrow text-[#2ABFBF] mb-3">{t('surveyDemo.intro.eyebrow')}</div>
            <h1
              className="font-heading text-white"
              style={{
                fontSize: 'clamp(27px, 3.2vw, 38px)',
                fontWeight: 700,
                letterSpacing: '-0.018em',
                lineHeight: 1.14,
              }}
            >
              {t('surveyDemo.intro.title')}
            </h1>
            <p className="mt-4 text-[16px] sm:text-[17px] text-white/80 font-medium leading-[1.6]">
              {t('surveyDemo.intro.prefilled', { name: choice.firstName })}
            </p>
            <p className="mt-3 text-[15px] text-white/65 font-medium leading-[1.6]">
              {t('surveyDemo.intro.body', { name: choice.firstName })}
            </p>
            <p className="mt-4 text-[13px] text-white/50 font-medium leading-relaxed">
              {t('surveyDemo.intro.note')}
            </p>
          </header>

          {/* Beat 0 — the résumé step, exactly as it opens the real assessment,
              with a file that has already been read. */}
          <section className="mb-4">
            <div className="mb-2 px-1 text-[13px] font-semibold text-blue-100/85">
              {t('surveyDemo.resume.caption')}
            </div>
            {persona && (
              <PreSurveyUpload demoPreset={persona.resume} onContinue={scrollToQuestions} />
            )}
            <p className="mt-2 px-1 text-[13px] leading-relaxed font-medium text-blue-100/75">
              {t('surveyDemo.resume.note', { name: choice.firstName })}
            </p>
          </section>

          {/* Beats 1-3 — the questions themselves, in the assessment's own card. */}
          {questions.map((question, index) => (
            <section
              key={question.id}
              ref={index === 0 ? firstQuestionRef : undefined}
              className="scroll-mt-[150px] mb-6"
            >
              <div
                className="relative overflow-hidden rounded-[22px] border shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45)]"
                style={{ background: '#FDFBF2', borderColor: 'rgba(201, 182, 144, 0.6)' }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute"
                  style={{
                    top: -60,
                    right: -60,
                    width: 280,
                    height: 280,
                    background: 'radial-gradient(circle, rgba(212,160,36,0.18) 0%, rgba(212,160,36,0) 70%)',
                  }}
                />
                <div className="relative space-y-6 pt-5 sm:pt-7 px-4 sm:px-8 pb-5 sm:pb-7">
                  <div
                    className="font-heading uppercase text-[11px]"
                    style={{ color: '#C8891A', letterSpacing: '0.24em', fontWeight: 700 }}
                  >
                    {demoSurvey.questions[index].placement
                      ? tSurvey('questionCard.eyebrow', demoSurvey.questions[index].placement!)
                      : t('surveyDemo.questionCard.eyebrow', { current: index + 1, total: questions.length })}
                  </div>
                  <div className="text-base sm:text-lg font-light text-gray-900">
                    <QuestionRenderer
                      question={question}
                      value={responses[question.id]}
                      onChange={(value) => setAnswer(question.id, value)}
                      allResponses={responses}
                      onNonNegotiableChange={(checked) =>
                        setAnswer('__non_negotiables', {
                          ...((responses['__non_negotiables'] as Record<string, boolean>) || {}),
                          [question.id]: checked,
                        })
                      }
                    />
                  </div>

                  {/* The payoff link: this answer, in the conversation. */}
                  <div className="pt-1 border-t" style={{ borderColor: 'rgba(201,182,144,0.5)' }}>
                    <Link
                      to={chatLink(persona?.focus[question.id])}
                      onClick={() => trackCtaClick('demo_survey_payoff')}
                      className="mt-3 inline-flex items-center gap-2 text-[14px] font-bold text-[#1F8282] hover:underline underline-offset-4"
                    >
                      <MessageSquare size={16} strokeWidth={2.4} />
                      {t(`surveyDemo.payoff.${PAYOFF_KEYS[index] ?? 'happiness'}`, { name: choice.firstName })}
                      <ArrowRight size={15} strokeWidth={2.4} />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          ))}

          {/* The honest close: three of about sixty. */}
          <section
            className="rounded-[20px] border px-5 py-5 sm:px-7 sm:py-6 mb-2"
            style={{
              background: '#FDFBF2',
              borderColor: 'rgba(201, 182, 144, 0.6)',
              boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
            }}
          >
            <h2
              className="font-heading text-[20px] sm:text-[22px]"
              style={{ color: '#122E3B', fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              {t('surveyDemo.rest.title')}
            </h2>
            <p className="mt-2 text-[15px] text-[#4B6373] font-medium leading-[1.65]">
              {t('surveyDemo.rest.body')}
            </p>
            <Link
              to={demoLink(DEMO_ROUTE, location.search)}
              onClick={() => trackCtaClick('demo_survey_to_chat')}
              className="mt-4 inline-flex items-center gap-2 text-[16px] font-bold text-[#1F8282] hover:underline underline-offset-4"
            >
              <MessageSquare size={18} strokeWidth={2.4} />
              {t('surveyDemo.rest.toChat', { name: choice.firstName })}
              <ArrowRight size={16} strokeWidth={2.4} />
            </Link>
          </section>

          <DemoFooter
            audience={audience}
            personaId={choice.personaId}
            language={demoPdfLanguage(choice.personaId, i18n.language)}
            firstName={choice.firstName}
          />
        </div>
      </main>

      <div className="relative z-10">
        <LandingFooter />
      </div>
    </div>
  );
};

export default DemoSurvey;
