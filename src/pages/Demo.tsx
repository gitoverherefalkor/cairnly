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
import { ReportSidebar } from '@/components/chat/ReportSidebar';
import { trackSampleView } from '@/lib/analytics';
import { CALENDLY_URL } from '@/components/partners/constants';
import { DemoReplay, messageDomId } from '@/components/demo/DemoReplay';
import { DemoMomentsBar } from '@/components/demo/DemoMomentsBar';
import { DemoHighlightsCard } from '@/components/demo/DemoHighlightsCard';
import { DemoFooter } from '@/components/demo/DemoFooter';
import { DemoWelcome } from '@/components/demo/DemoWelcome';
import { DemoTrustBanner } from '@/components/demo/DemoTrustBanner';
import type { ResolvedAnnotation } from '@/components/demo/DemoAnnotation';
import { applyCuration, chooseFixture } from '@/demo/loadFixture';
import { sectionIndexByMessage } from '@/demo/chapters';
import { DEMO_ROUTE } from '@/demo/constants';
import type { DemoFixture } from '@/demo/types';

// Below this width the sidebar starts collapsed (the transcript would get
// squeezed) and the margin notes render inline instead of in the margin.
const WIDE = 1360;

/**
 * /demo — a public, scrollable replay of a real coaching session, rendered
 * through the real chat components from a frozen fixture. No login, no input
 * box, no n8n. See docs/handoff/demo-replay-plan.md for the decisions.
 *
 * The page is laid out like /chat: the real ReportSidebar on the left
 * (sections, progress, career sublines; every section is a jump target
 * because the whole session is on the page), the transcript in the middle
 * with the same 320px side margins the chat uses while the sidebar is open,
 * and the demo-layer margin notes hanging into the right margin. The
 * annotated moments are the numbered chips in the sticky header.
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

  // message id → canonical section index, and the reverse (first message
  // that delivers each section) for the sidebar's jump links.
  const sectionIndexMap = useMemo(
    () => (fixture ? sectionIndexByMessage(fixture.messages, fixture.sections) : {}),
    [fixture],
  );
  const messageIdBySection = useMemo(() => {
    const out: Record<number, string> = {};
    if (!fixture) return out;
    for (const m of fixture.messages) {
      const idx = sectionIndexMap[m.id];
      if (idx != null && out[idx] === undefined) out[idx] = m.id;
    }
    return out;
  }, [fixture, sectionIndexMap]);

  // Annotations in transcript order, numbered 1..n; the number is what ties
  // the header chips to the margin notes.
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
        eyebrow: t(`annotations.${choice.personaId}.${a.key}.eyebrow`),
        title: t(`annotations.${choice.personaId}.${a.key}.title`),
        body: t(`annotations.${choice.personaId}.${a.key}.body`),
        legend: t(`annotations.${choice.personaId}.${a.key}.legend`),
      }));
  }, [fixture, choice, t]);

  // Jump to a message and ring it for a moment. Shared by the header chips,
  // the sidebar, the welcome card's button and the comparison "explain".
  const [flashId, setFlashId] = useState<string | null>(null);
  const flash = useCallback((id: string) => {
    document.getElementById(messageDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(id);
    window.setTimeout(() => setFlashId((current) => (current === id ? null : current)), 2000);
  }, []);

  // Sidebar open/closed, as in the chat. Starts collapsed on narrower
  // desktops so the transcript keeps a readable width.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < WIDE,
  );

  // Scroll-spy: the section the visitor is in (drives the sidebar's
  // past/current/upcoming states and its N/M pill), overall progress, and
  // which annotated moments have been scrolled past.
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [reachedIds, setReachedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!fixture) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const probe = window.innerHeight * 0.4;
        let current = -1;
        for (const [id, idx] of Object.entries(sectionIndexMap)) {
          const el = document.getElementById(messageDomId(id));
          if (el && el.getBoundingClientRect().top <= probe) current = Math.max(current, idx);
        }
        setCurrentSectionIndex(current);
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
  }, [fixture, sectionIndexMap, annotations]);

  const onNavCta = () => {
    if (audience === 'partner') window.open(CALENDLY_URL, '_blank', 'noopener');
    else navigate('/payment');
  };

  const highlights = fixture?.sections.find((s) => s.section_type === 'chat_highlights');
  const firstMessageId = fixture?.messages[0]?.id ?? null;

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip">
      <Seo title={t('seo.title')} description={t('seo.description')} path={DEMO_ROUTE} />
      {/* Same fixed cairn-trail canvas as /chat, so the replay looks like the
          product and not like a marketing page pretending to be one. */}
      <div className="fixed inset-0 survey-bg" aria-hidden="true" />

      <DemoTrustBanner />
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
        <DemoMomentsBar
          items={annotations}
          reachedIds={reachedIds}
          onSelect={flash}
          title={t('legend.title')}
          honestLabel={t('nav.honest')}
        />
        <div className="h-[3px] bg-gray-100">
          <div
            className="h-full bg-atlas-teal transition-all duration-300 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </nav>

      {/* Same row as /chat: the column keeps 320px side margins while the
          sidebar is open (80px when collapsed); the sidebar itself is a
          fixed panel on the left from md up and a drawer below that. */}
      <main className="relative z-10 flex-1 flex">
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all ${
            sidebarCollapsed ? 'md:mx-20' : 'md:mx-80'
          }`}
        >
          <div className="w-full max-w-[800px] mx-auto px-3 sm:px-6 pt-6 sm:pt-10 pb-16">
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
              <p className="mt-3 text-[15px] text-[#4B6373] font-medium leading-[1.65]">{t('intro.body', { name: choice.firstName })}</p>

              {/* Below 1360px the header chips are numbers only, so the
                  moments are listed in full here. From 1360px the sentence
                  below points at the header chips and the sidebar. */}
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
              <p className="mt-4 text-[13px] text-[#4B6373]/85 font-medium leading-relaxed">{t('intro.howTo', { name: choice.firstName })}</p>
              {choice.isFallback && (
                <p
                  className="mt-4 rounded-lg px-3.5 py-2.5 text-[14px] font-medium leading-relaxed"
                  style={{ background: 'rgba(212,160,36,0.12)', color: '#122E3B' }}
                >
                  {t('fallback.otherLanguage')}
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
                  body={t('highlights.body', { name: choice.firstName })}
                />
                <DemoFooter
                  audience={audience}
                  personaId={choice.personaId}
                  language={choice.language}
                  firstName={choice.firstName}
                />
              </>
            ) : (
              <div className="flex items-center justify-center py-24 text-blue-100/70">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* The real chat sidebar. Clicking a section jumps to the message
            that delivered it; the current section follows the scroll. */}
        {fixture && (
          <ReportSidebar
            currentSectionIndex={currentSectionIndex}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            onSectionClick={(_sectionId, index) => {
              const id = messageIdBySection[index];
              if (id) flash(id);
            }}
            reportSections={fixture.sections}
            allSectionsReachable
            // The demo header is one row taller than /chat's (the moments
            // bar); without this the panel slides under it on short screens.
            desktopTopOffset={47}
          />
        )}
      </main>

      {/* Above the sidebar's fixed panel (z-40) so the footer covers it as
          you scroll to the end, instead of the panel floating over the
          footer. Below the sticky nav (z-50). */}
      <div className="relative z-[45]">
        <LandingFooter />
      </div>
    </div>
  );
};

export default Demo;
