import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import '../components/landing/landing.css';
import Seo from '@/components/Seo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LandingFooter from '@/components/landing/LandingFooter';
import { Button } from '@/components/ui/button';
import { TTSProvider } from '@/contexts/TTSContext';
import { trackSampleView } from '@/lib/analytics';
import { CALENDLY_URL } from '@/components/partners/constants';
import { DemoReplay, messageDomId } from '@/components/demo/DemoReplay';
import { DemoChapterBar } from '@/components/demo/DemoChapterBar';
import { DemoHighlightsCard } from '@/components/demo/DemoHighlightsCard';
import { DemoFooter } from '@/components/demo/DemoFooter';
import { DemoLegend } from '@/components/demo/DemoLegend';
import { DemoWelcome } from '@/components/demo/DemoWelcome';
import type { ResolvedAnnotation } from '@/components/demo/DemoAnnotation';
import { applyCuration, chooseFixture } from '@/demo/loadFixture';
import { buildChapters, sectionIndexByMessage, type DemoChapterId } from '@/demo/chapters';
import { DEMO_ROUTE } from '@/demo/constants';
import type { DemoFixture } from '@/demo/types';

/**
 * /demo — a public, scrollable replay of a real coaching session, rendered
 * through the real chat components from a frozen fixture. No login, no input
 * box, no n8n. See docs/handoff/demo-replay-plan.md for the decisions.
 *
 * Layout: below 1360px a single 800px column. From 1360px a three-column
 * grid: the legend rail (sticky) on the left, the transcript in the middle,
 * and an empty right column the margin notes hang into.
 *
 * `?p=<slug>` marks a partner-audience visit (the /partners teaser links with
 * ?p=partners; outreach mails can tag the bureau): the CTAs point at the
 * pilot call instead of checkout, and the visit is recorded through the same
 * first-party beacon the partner sample page uses.
 */
const Demo: React.FC = () => {
  const { t, i18n } = useTranslation('demo');
  const location = useLocation();
  const navigate = useNavigate();
  const audience: 'customer' | 'partner' = new URLSearchParams(location.search).has('p')
    ? 'partner'
    : 'customer';

  const choice = useMemo(() => chooseFixture(i18n.language), [i18n.language]);
  const [fixture, setFixture] = useState<DemoFixture | null>(null);
  useEffect(() => {
    let alive = true;
    choice.load().then((raw) => {
      if (alive) setFixture(applyCuration(raw, choice.curation));
    });
    return () => {
      alive = false;
    };
  }, [choice]);

  // One beacon per mount (not per rerender, not twice under StrictMode).
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackSampleView(location.pathname, location.search);
  }, [location.pathname, location.search]);

  const sectionIndexMap = useMemo(
    () => (fixture ? sectionIndexByMessage(fixture.messages, fixture.sections) : {}),
    [fixture],
  );
  const chapters = useMemo(
    () => (fixture ? buildChapters(fixture.messages, fixture.sections) : []),
    [fixture],
  );
  // Annotations in transcript order, numbered 1..n; the number is what ties
  // the legend rail to the margin notes.
  const annotations = useMemo<ResolvedAnnotation[]>(() => {
    if (!fixture) return [];
    const position = new Map(fixture.messages.map((m, i) => [m.id, i]));
    return (choice.curation.annotations ?? [])
      .filter((a) => position.has(a.messageId))
      .sort((a, b) => (position.get(a.messageId) ?? 0) - (position.get(b.messageId) ?? 0))
      .map((a, i) => ({
        key: a.key,
        messageId: a.messageId,
        placement: a.placement ?? 'top',
        index: i + 1,
        eyebrow: t(`annotations.${a.key}.eyebrow`),
        title: t(`annotations.${a.key}.title`),
        body: t(`annotations.${a.key}.body`),
        legend: t(`annotations.${a.key}.legend`),
      }));
  }, [fixture, choice, t]);

  // Jump to a message and ring it for a moment. Shared by the legend, the
  // welcome card's button and the comparison "explain" scroll.
  const [flashId, setFlashId] = useState<string | null>(null);
  const flash = useCallback((id: string) => {
    document.getElementById(messageDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(id);
    window.setTimeout(() => setFlashId((current) => (current === id ? null : current)), 2000);
  }, []);

  // Scroll-spy: active chapter, overall progress, and which annotated
  // moments the visitor has already scrolled past.
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [activeChapter, setActiveChapter] = useState<DemoChapterId | null>(null);
  const [progress, setProgress] = useState(0);
  const [reachedIds, setReachedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!fixture) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const probe = window.innerHeight * 0.4;
        let active: DemoChapterId | null = null;
        for (const ch of chapters) {
          if (!ch.firstMessageId) continue;
          const el = document.getElementById(messageDomId(ch.firstMessageId));
          if (el && el.getBoundingClientRect().top <= probe) active = ch.id;
        }
        setActiveChapter(active);
        const reached = new Set<string>();
        for (const a of annotations) {
          const el = document.getElementById(messageDomId(a.messageId));
          if (el && el.getBoundingClientRect().top <= probe) reached.add(a.messageId);
        }
        setReachedIds((prev) =>
          prev.size === reached.size && Array.from(reached).every((id) => prev.has(id)) ? prev : reached,
        );
        const el = transcriptRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const total = rect.height - window.innerHeight * 0.6;
          const done = -rect.top + window.innerHeight * 0.4;
          setProgress(total > 0 ? Math.max(0, Math.min(1, done / total)) : 0);
        }
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [fixture, chapters, annotations]);

  const scrollToChapter = (id: DemoChapterId) => {
    const ch = chapters.find((c) => c.id === id);
    if (!ch?.firstMessageId) return;
    document.getElementById(messageDomId(ch.firstMessageId))?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const onNavCta = () => {
    if (audience === 'partner') window.open(CALENDLY_URL, '_blank', 'noopener');
    else navigate('/payment');
  };

  const highlights = fixture?.sections.find((s) => s.section_type === 'chat_highlights');
  const firstMessageId = fixture?.messages[0]?.id ?? null;

  const legend = (
    <DemoLegend
      items={annotations}
      reachedIds={reachedIds}
      onSelect={flash}
      title={t('legend.title')}
      hint={t('legend.hint')}
    />
  );

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip">
      <Seo title={t('seo.title')} description={t('seo.description')} path={DEMO_ROUTE} />
      {/* Same fixed cairn-trail canvas as /chat, so the replay looks like the
          product and not like a marketing page pretending to be one. */}
      <div className="fixed inset-0 survey-bg" aria-hidden="true" />

      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between items-center py-2.5 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/" className="flex items-center shrink-0">
                <img src="/logos/cairnly-logo.png" alt="Cairnly" className="h-12 w-auto" />
              </Link>
              <span className="hidden sm:flex items-center gap-3 text-sm font-medium text-atlas-navy truncate">
                <span className="h-4 w-px bg-gray-200" aria-hidden="true" />
                {t('nav.label')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <LanguageSwitcher />
              <Button
                size="sm"
                onClick={onNavCta}
                className="bg-atlas-teal hover:bg-atlas-teal/90 text-white text-xs sm:text-sm"
              >
                {audience === 'partner' ? t('nav.ctaPartner') : t('nav.ctaCustomer')}
              </Button>
            </div>
          </div>
        </div>
        <DemoChapterBar
          chapters={chapters.map((c) => ({
            id: c.id,
            label: t(`chapters.${c.id}`),
            reachable: c.firstMessageId !== null,
          }))}
          activeId={activeChapter}
          onSelect={scrollToChapter}
          honestLabel={t('nav.honest')}
        />
        <div className="h-[3px] bg-gray-100">
          <div
            className="h-full bg-atlas-teal transition-all duration-300 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </nav>

      <main className="relative z-10 flex-1">
        <div className="mx-auto px-3 sm:px-6 max-w-[800px] pt-6 sm:pt-10 pb-16 min-[1360px]:px-0 min-[1360px]:max-w-none min-[1360px]:grid min-[1360px]:grid-cols-[232px_800px_248px] min-[1360px]:gap-8 min-[1360px]:justify-center">
          {/* Legend rail, wide screens only. Sticky inside its grid column so
              it follows the transcript and leaves with it, never over the
              site footer. */}
          <aside className="hidden min-[1360px]:block">
            <div className="sticky top-[136px]">{fixture && legend}</div>
          </aside>

          <div className="min-w-0 min-[1360px]:px-6">
            <section
              className="rounded-[20px] border px-5 py-5 sm:px-7 sm:py-7 mb-8"
              style={{
                background: '#FDFBF2',
                borderColor: 'rgba(201, 182, 144, 0.6)',
                boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
              }}
            >
              <div className="lp-eyebrow text-[#1F8282] mb-3">{t('intro.eyebrow')}</div>
              <h1
                className="font-heading text-[26px] sm:text-[32px]"
                style={{ color: '#122E3B', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.15 }}
              >
                {t('intro.title')}
              </h1>
              <p className="mt-3 text-[15px] sm:text-base text-[#122E3B] font-semibold leading-relaxed">
                {t(`personas.${choice.personaId}.tagline`)}
              </p>
              <p className="mt-3 text-[15px] text-[#4B6373] font-medium leading-[1.65]">{t('intro.body')}</p>

              {/* Small screens: the annotated moments as a jump list here.
                  Wide screens: they live in the legend rail on the left. */}
              {annotations.length > 0 && (
                <div className="min-[1360px]:hidden">
                  <p className="mt-3 text-[15px] font-semibold text-[#122E3B]">{t('intro.watchLead')}</p>
                  <ol className="mt-2 space-y-1.5">
                    {annotations.map((a) => (
                      <li key={a.key}>
                        <button
                          type="button"
                          onClick={() => flash(a.messageId)}
                          className="flex items-start gap-3 text-left text-[15px] text-[#4B6373] font-medium leading-[1.6] hover:text-[#122E3B]"
                        >
                          <span
                            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold mt-0.5"
                            style={{ background: 'rgba(212,160,36,0.16)', color: '#8A6508' }}
                          >
                            {a.index}
                          </span>
                          <span className="underline underline-offset-4 decoration-[#D4A024]/50">{a.legend}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="hidden min-[1360px]:block mt-3 text-[15px] text-[#4B6373] font-medium leading-[1.65]">
                {t('intro.legendAside')}
              </p>
              <p className="mt-4 text-[13px] text-[#4B6373]/85 font-medium leading-relaxed">{t('intro.howTo')}</p>
              {choice.isFallback && (
                <p
                  className="mt-4 rounded-lg px-3.5 py-2.5 text-[14px] font-medium leading-relaxed"
                  style={{ background: 'rgba(212,160,36,0.12)', color: '#122E3B' }}
                >
                  {t('fallback.dutchOnly')}
                </p>
              )}
            </section>

            {fixture ? (
              <>
                <DemoWelcome
                  onReady={() => firstMessageId && flash(firstMessageId)}
                  caption={t('welcome.caption')}
                  pillsCaption={t('welcome.pillsCaption')}
                />
                <div ref={transcriptRef}>
                  <TTSProvider>
                    <DemoReplay
                      messages={fixture.messages}
                      sections={fixture.sections}
                      savedMessageIds={fixture.savedMessageIds}
                      annotations={annotations}
                      sectionIndexByMessage={sectionIndexMap}
                      flashId={flashId}
                      onFlash={flash}
                    />
                  </TTSProvider>
                </div>
                <DemoHighlightsCard
                  section={highlights}
                  lang={i18n.language}
                  kicker={t('highlights.kicker')}
                  title={t('highlights.title')}
                  body={t('highlights.body')}
                />
                <DemoFooter audience={audience} />
              </>
            ) : (
              <div className="flex items-center justify-center py-24 text-blue-100/70">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>

          {/* Right column: empty on purpose, the margin notes hang into it. */}
          <div className="hidden min-[1360px]:block" aria-hidden="true" />
        </div>
      </main>

      <div className="relative z-10">
        <LandingFooter />
      </div>
    </div>
  );
};

export default Demo;
