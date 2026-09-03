import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Briefcase, Loader2 } from 'lucide-react';
import '../components/landing/landing.css';
import Seo from '@/components/Seo';
import LandingFooter from '@/components/landing/LandingFooter';
import { DashboardV4 } from '@/components/dashboard/v2/DashboardV4';
import { REFERRAL_FEATURES, UNLOCK_LADDER } from '@/hooks/useReferralStatus';
import { trackSampleView, trackCtaClick } from '@/lib/analytics';
import { DemoFooter } from '@/components/demo/DemoFooter';
import { DemoPageNav, demoCtaTarget } from '@/components/demo/DemoPageNav';
import { DemoToolDialog, type DemoTool } from '@/components/demo/DemoToolDialog';
import { applyCuration, chooseFixture } from '@/demo/loadFixture';
import { demoLink, readPersonaParam } from '@/demo/links';
import { DEMO_DASHBOARD_ROUTE, DEMO_JOBS_ROUTE, DEMO_ROUTE, demoPdfPath } from '@/demo/constants';
import type { DemoFixture } from '@/demo/types';

// The toolkit as the demo shows it: the job search unlocked (one referral
// counted, the state /demo/jobs is built on), the other two tools locked.
const DEMO_REFERRAL_COUNT = 1;

/**
 * /demo/dashboard — phase 3 of docs/handoff/demo-replay-plan.md: the persona's
 * finished dashboard, rendered through the REAL DashboardV4 from the same
 * frozen fixture the chat replay uses. No auth, no queries, no n8n.
 *
 * What is different from a signed-in dashboard, on purpose:
 *  - the app nav (profile, sign-out) is replaced by the demo's top bar;
 *  - the job search is the one tool switched on (phase 4,
 *    docs/handoff/demo-toolkit-plan.md): its tile is unlocked and pulses, a
 *    one-line banner above the toolkit says why, and every route into /jobs
 *    lands on /demo/jobs (frozen results). The résumé tailor, cover letters,
 *    share-card generation and the invite flow open DemoToolDialog instead,
 *    which says what they do and points at the CTA;
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

  const choice = useMemo(
    () => chooseFixture(i18n.language, readPersonaParam(location.search)),
    [i18n.language, location.search],
  );
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

  const chatHref = demoLink(DEMO_ROUTE, location.search);
  const jobsHref = demoLink(DEMO_JOBS_ROUTE, location.search);
  const pdfHref = demoPdfPath(choice.personaId, choice.language);

  // Every in-app route the dashboard would navigate to is a signed-in tool,
  // except the job search: that one has a frozen twin at /demo/jobs.
  const handleNavigate = (route: string) => {
    if (route.startsWith('/jobs')) {
      trackCtaClick('demo_dashboard_to_jobs');
      navigate(jobsHref);
    } else if (route.startsWith('/custom-resume')) setTool('resume');
    else setTool('generic');
  };

  const features = useMemo(
    () => REFERRAL_FEATURES.map((f) => ({ ...f, unlocked: DEMO_REFERRAL_COUNT >= f.requiredReferrals })),
    [],
  );
  const ladder = useMemo(
    () => UNLOCK_LADDER.map((step) => ({ step, unlocked: DEMO_REFERRAL_COUNT >= step.requiredReferrals })),
    [],
  );

  const nav = (
    <DemoPageNav
      audience={audience}
      label={t('dashboardDemo.nav.label')}
      backTo={chatHref}
      backLabel={t('dashboardDemo.nav.back')}
      onCta={demoCtaTarget(audience, navigate)}
    />
  );

  // One line above the toolkit: the job search is on, go and look.
  const toolkitBanner = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        marginBottom: 14,
        padding: '12px 18px',
        borderRadius: 14,
        background: 'rgba(39,161,161,0.14)',
        border: '1px solid rgba(39,161,161,0.40)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.45,
      }}
    >
      <Briefcase size={16} style={{ color: '#EFBE48', flexShrink: 0 }} />
      <span style={{ flex: '1 1 320px' }}>{t('dashboardDemo.jobsNudge.body', { name: choice.firstName })}</span>
      <Link
        to={jobsHref}
        onClick={() => trackCtaClick('demo_dashboard_jobs_nudge')}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold"
        style={{ background: '#27A1A1', color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap' }}
      >
        {t('dashboardDemo.jobsNudge.cta')}
        <ArrowRight size={14} strokeWidth={2.4} />
      </Link>
    </div>
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
            referralCount={DEMO_REFERRAL_COUNT}
            features={features}
            ladder={ladder}
            pulseStepKey="jobs"
            toolkitBanner={toolkitBanner}
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
                  {t('dashboardDemo.intro.body', { name: choice.firstName })}
                </p>
                <p className="mt-3 text-[14px] text-[#4B6373]/85 font-medium leading-relaxed">
                  {t('dashboardDemo.intro.toolsNote', { name: choice.firstName })}
                </p>
                <p className="mt-5 text-[15px] font-medium">
                  <Link
                    to={jobsHref}
                    onClick={() => trackCtaClick('demo_dashboard_to_jobs')}
                    className="inline-flex items-center gap-1.5 text-[#1F8282] font-semibold underline underline-offset-4 decoration-[#1F8282]/40 hover:decoration-[#1F8282] transition-colors"
                  >
                    {t('dashboardDemo.footer.jobs', { name: choice.firstName })}
                    <ArrowRight size={14} strokeWidth={2.4} />
                  </Link>
                  <span className="block mt-1 text-[13px] text-[#4B6373]/85">{t('dashboardDemo.footer.jobsNote')}</span>
                </p>
                <p className="mt-4 text-[15px] font-medium">
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

          <DemoToolDialog tool={tool} onClose={() => setTool(null)} audience={audience} firstName={choice.firstName} />
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
