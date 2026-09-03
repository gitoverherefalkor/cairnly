import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import '../components/landing/landing.css';
import Seo from '@/components/Seo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LandingFooter from '@/components/landing/LandingFooter';
import { Button } from '@/components/ui/button';
import { DashboardV4 } from '@/components/dashboard/v2/DashboardV4';
import { REFERRAL_FEATURES, UNLOCK_LADDER } from '@/hooks/useReferralStatus';
import { trackSampleView, trackCtaClick } from '@/lib/analytics';
import { CALENDLY_URL } from '@/components/partners/constants';
import { DemoFooter } from '@/components/demo/DemoFooter';
import { DemoToolDialog, type DemoTool } from '@/components/demo/DemoToolDialog';
import { DemoTrustBanner } from '@/components/demo/DemoTrustBanner';
import { applyCuration, chooseFixture } from '@/demo/loadFixture';
import { DEMO_DASHBOARD_ROUTE, DEMO_ROUTE, demoPdfPath } from '@/demo/constants';
import type { DemoFixture } from '@/demo/types';

/**
 * /demo/dashboard — phase 3 of docs/handoff/demo-replay-plan.md: the persona's
 * finished dashboard, rendered through the REAL DashboardV4 from the same
 * frozen fixture the chat replay uses. No auth, no queries, no n8n.
 *
 * What is different from a signed-in dashboard, on purpose:
 *  - the app nav (profile, sign-out) is replaced by the demo's top bar;
 *  - every control that would run a paid tool or needs a session (job search,
 *    résumé tailor, cover letters, share-card generation, the invite flow)
 *    opens DemoToolDialog instead, which says what it does and points at the
 *    CTA. The referral toolkit renders fully locked, as for a new user;
 *  - "Download PDF" serves the pre-rendered demo PDF (a real render of this
 *    report) instead of paying for a fresh Chromium render;
 *  - the saved coach replies come from the fixture rather than a query.
 */
const DemoDashboard: React.FC = () => {
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

  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackSampleView(location.pathname, location.search);
  }, [location.pathname, location.search]);

  const [tool, setTool] = useState<DemoTool | null>(null);

  // Every in-app route the dashboard would navigate to is a signed-in tool.
  const handleNavigate = (route: string) => {
    if (route.startsWith('/jobs?mode=saved')) setTool('coverLetter');
    else if (route.startsWith('/jobs')) setTool('jobs');
    else if (route.startsWith('/custom-resume')) setTool('resume');
    else setTool('generic');
  };

  // Locked toolkit, as a fresh account sees it (no referrals yet).
  const features = useMemo(() => REFERRAL_FEATURES.map((f) => ({ ...f, unlocked: false })), []);
  const ladder = useMemo(() => UNLOCK_LADDER.map((step) => ({ step, unlocked: false })), []);

  const onNavCta = () => {
    if (audience === 'partner') window.open(CALENDLY_URL, '_blank', 'noopener');
    else navigate('/payment');
  };
  const chatHref = `${DEMO_ROUTE}${audience === 'partner' ? '?p=partners' : ''}`;
  const pdfHref = demoPdfPath(choice.personaId, choice.language);

  const nav = (
    <>
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
              {t('dashboardDemo.nav.label')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Link
              to={chatHref}
              className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1F8282] hover:underline underline-offset-4 mr-2"
            >
              <ArrowLeft size={14} strokeWidth={2.4} />
              {t('dashboardDemo.nav.back')}
            </Link>
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
      {/* The honest label, always in view, as on the chat replay. */}
      <div
        className="px-4 sm:px-6 py-1.5 flex items-center justify-end gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ background: '#FDFBF2', color: '#122E3B', borderTop: '1px solid rgba(201,182,144,0.5)' }}
      >
        <ShieldCheck size={13} strokeWidth={2.4} style={{ color: '#B8860B' }} />
        {t('nav.honest')}
      </div>
    </nav>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title={t('dashboardDemo.seo.title')}
        description={t('dashboardDemo.seo.description')}
        path={DEMO_DASHBOARD_ROUTE}
      />

      {fixture ? (
        <>
          <DashboardV4
            nav={nav}
            firstName={fixture.persona.firstName}
            country={fixture.persona.country ?? null}
            reportId={fixture.persona.reportId}
            reportGeneratedAt={fixture.persona.reportCompletedAt ?? fixture.persona.exportedAt}
            sections={fixture.sections}
            execSummaryStatus={null}
            referralCode="DEMO"
            referralCount={0}
            features={features}
            ladder={ladder}
            savedResponses={fixture.savedResponses ?? []}
            onNavigate={handleNavigate}
            onProfile={() => setTool('generic')}
            onSignOut={() => setTool('generic')}
            onInvite={() => setTool('invite')}
            onOpenShareCard={() => setTool('share')}
            onDownloadPdf={() => {
              trackCtaClick('demo_dashboard_pdf');
              window.open(pdfHref, '_blank', 'noopener');
            }}
          />

          {/* Intro sits UNDER the dashboard, deliberately: the page should
              open on the product, the explanation is for whoever scrolls. */}
          <div className="relative" style={{ background: '#0F2530' }}>
            <div className="w-full max-w-[800px] mx-auto px-3 sm:px-6 pt-10 pb-16">
              <section
                className="rounded-[20px] border px-5 py-5 sm:px-7 sm:py-7"
                style={{
                  background: '#FDFBF2',
                  borderColor: 'rgba(201, 182, 144, 0.6)',
                  boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
                }}
              >
                <div className="lp-eyebrow text-[#1F8282] mb-3">{t('dashboardDemo.intro.eyebrow')}</div>
                <h1
                  className="font-heading text-[26px] sm:text-[32px]"
                  style={{ color: '#122E3B', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.15 }}
                >
                  {t('dashboardDemo.intro.title', { name: choice.firstName })}
                </h1>
                <p className="mt-3 text-[15px] text-[#4B6373] font-medium leading-[1.65]">
                  {t('dashboardDemo.intro.body')}
                </p>
                <p className="mt-3 text-[14px] text-[#4B6373]/85 font-medium leading-relaxed">
                  {t('dashboardDemo.intro.toolsNote')}
                </p>
                <p className="mt-5 text-[15px] font-medium">
                  <Link
                    to={chatHref}
                    onClick={() => trackCtaClick('demo_dashboard_to_chat')}
                    className="inline-flex items-center gap-1.5 text-[#1F8282] font-semibold underline underline-offset-4 decoration-[#1F8282]/40 hover:decoration-[#1F8282] transition-colors"
                  >
                    <ArrowLeft size={14} strokeWidth={2.4} />
                    {t('dashboardDemo.footer.chat')}
                  </Link>
                  <span className="block mt-1 text-[13px] text-[#4B6373]/85">{t('dashboardDemo.footer.chatNote')}</span>
                </p>
              </section>
              <DemoFooter
                audience={audience}
                personaId={choice.personaId}
                language={choice.language}
                firstName={choice.firstName}
                showDashboardLink={false}
              />
            </div>
          </div>

          <DemoToolDialog tool={tool} onClose={() => setTool(null)} audience={audience} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-24" style={{ background: '#0F2530' }}>
          <Loader2 className="h-6 w-6 animate-spin text-blue-100/70" />
        </div>
      )}

      <div className="relative z-10">
        <LandingFooter />
      </div>
    </div>
  );
};

export default DemoDashboard;
