import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2 } from 'lucide-react';
import '../components/landing/landing.css';
import Seo from '@/components/Seo';
import LandingFooter from '@/components/landing/LandingFooter';
import { JobsResults, type JobsResultsCareer } from '@/components/jobs/v2/JobsResults';
import { JobsSavedKanban } from '@/components/jobs/v2/JobsSavedKanban';
import type { ApplyLinkOptions, JobsTier } from '@/components/jobs/v2/jobsV2Shared';
import type { JobListing } from '@/hooks/useJobSearch';
import type { SavedJob, SavedJobStatus } from '@/hooks/useSavedJobs';
import { trackSampleView, trackCtaClick } from '@/lib/analytics';
import { DemoFooter } from '@/components/demo/DemoFooter';
import { DemoPageNav, demoCtaTarget } from '@/components/demo/DemoPageNav';
import { DemoToolDialog, type DemoTool } from '@/components/demo/DemoToolDialog';
import { applyCuration, chooseFixture } from '@/demo/loadFixture';
import { demoLink, readPersonaParam } from '@/demo/links';
import { DEMO_DASHBOARD_ROUTE, DEMO_JOBS_ROUTE } from '@/demo/constants';
import type { DemoFixture } from '@/demo/types';

// The Jobs page's sectionType → tier (Jobs.tsx SECTION_TO_TIER).
const SECTION_TO_TIER: Record<string, JobsTier> = {
  'first-career': 'top-1',
  'second-career': 'top-2',
  'third-career': 'top-3',
  'runner-up': 'runner-up',
  'outside-box': 'outside-box',
};

// The results bar's one-line summary, as Jobs.tsx composes it.
const summarize = (opts: { countryCodes: string[]; workArrangement: string; jobCommitment: string } | undefined, careers: number) =>
  [
    `${careers} ${careers === 1 ? 'career' : 'careers'}`,
    (opts?.countryCodes ?? []).map((c) => c.toUpperCase()).join(' + '),
    opts?.workArrangement === 'remote_only' ? 'remote only' : opts?.workArrangement === 'remote_friendly' ? 'remote-friendly' : null,
    opts?.jobCommitment === 'full_time'
      ? 'full-time'
      : opts?.jobCommitment === 'part_time'
        ? 'part-time'
        : opts?.jobCommitment === 'contract'
          ? 'contract / freelance'
          : null,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * /demo/jobs — phase 4 of docs/handoff/demo-toolkit-plan.md: the persona's
 * job search, rendered through the REAL JobsResults / JobsSavedKanban from
 * ONE real search run frozen into the fixture. No auth, no edge functions,
 * no writes.
 *
 * What is different from the signed-in page, on purpose:
 *  - the results are the fixture's (the 24h server cache is the only other
 *    copy and it expires); "Edit search" opens the dialog that says a new
 *    search runs live for real users;
 *  - the saved-jobs pipeline starts from the fixture's rows; the save heart
 *    and the kanban drag update local state only, so the mechanic shows
 *    and a reload resets it;
 *  - the résumé tailor and cover-letter writer stay locked and open the
 *    dialog (so JobsResults's CoverLetterModal, with its Realtime
 *    subscription, can never mount);
 *  - the app nav is replaced by the demo's top bar; apply links stay real
 *    (LinkedIn), rel="nofollow noopener", counted as a CTA click.
 */
const DemoJobs: React.FC = () => {
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

  const [view, setView] = useState<'results' | 'saved'>('results');
  const [tool, setTool] = useState<DemoTool | null>(null);

  // The pipeline, local only. Seeded from the fixture once it arrives; the
  // persona switch (language, ?persona=) reseeds it.
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  useEffect(() => {
    setSavedJobs(fixture?.savedJobs ?? []);
  }, [fixture]);

  const results = useMemo(() => fixture?.jobs ?? [], [fixture]);
  const careersBySectionType = useMemo(() => {
    const m = new Map<string, JobsResultsCareer>();
    for (const r of results) {
      m.set(r.sectionType, { sectionType: r.sectionType, title: r.careerTitle, tier: SECTION_TO_TIER[r.sectionType] ?? 'top-1' });
    }
    return m;
  }, [results]);
  const searchedAt = results[0]?.searchedAt ?? fixture?.persona.exportedAt;
  const searchSummary = summarize(results[0]?.searchOptions, results.length);

  const isJobSaved = (externalJobId: string) => savedJobs.some((j) => j.external_job_id === externalJobId);
  const saveJob = (job: JobListing, fromCareer: string) => {
    if (isJobSaved(job.id)) return;
    const now = new Date().toISOString();
    setSavedJobs((prev) => [
      {
        id: `demo-${job.id}`,
        user_id: 'demo',
        job_search_id: null,
        external_job_id: job.id,
        job_title: job.title,
        company_name: job.company || null,
        location: job.location || null,
        salary_min: job.salary_min ?? null,
        salary_max: job.salary_max ?? null,
        description_snippet: job.description?.slice(0, 500) || null,
        apply_url: job.apply_url || null,
        source: job.source || 'unknown',
        posted_date: job.posted_date || null,
        saved_at: now,
        status: 'saved',
        applied_at: null,
        note: null,
        stage: null,
        archived_reason: null,
        from_career: fromCareer,
        match_score: job.match_score ?? null,
      },
      ...prev,
    ]);
  };
  const unsaveJob = (externalJobId: string) =>
    setSavedJobs((prev) => prev.filter((j) => j.external_job_id !== externalJobId));
  const updateStatus = (externalJobId: string, status: SavedJobStatus) =>
    setSavedJobs((prev) =>
      prev.map((j) =>
        j.external_job_id === externalJobId
          ? { ...j, status, applied_at: status === 'applied' ? new Date().toISOString() : j.applied_at }
          : j,
      ),
    );

  const applyLink: ApplyLinkOptions = useMemo(
    () => ({ rel: 'nofollow noopener noreferrer', onClick: () => trackCtaClick('demo_job_apply') }),
    [],
  );

  const dashboardHref = demoLink(DEMO_DASHBOARD_ROUTE, location.search);
  const goDashboard = () => navigate(dashboardHref);

  const nav = (
    <DemoPageNav
      audience={audience}
      label={t('jobsDemo.nav.label')}
      backTo={dashboardHref}
      backLabel={t('jobsDemo.nav.back')}
      onCta={demoCtaTarget(audience, navigate)}
    />
  );

  const dateText = searchedAt
    ? new Date(searchedAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const careerTitle = results[0]?.careerTitle ?? '';
  const chromeIsForeign = !i18n.language.toLowerCase().startsWith('en');

  return (
    <div className="min-h-screen flex flex-col">
      <Seo title={t('jobsDemo.seo.title')} description={t('jobsDemo.seo.description')} path={DEMO_JOBS_ROUTE} />

      {fixture ? (
        <>
          {view === 'saved' ? (
            <JobsSavedKanban
              nav={nav}
              applyLink={applyLink}
              firstName={fixture.persona.firstName}
              savedJobs={savedJobs}
              resumeUnlocked={false}
              coverUnlocked={false}
              onUpdateStatus={updateStatus}
              onBackToSearch={() => setView('results')}
              onBack={goDashboard}
              onInvite={() => setTool('invite')}
              onProfile={() => setTool('generic')}
              onSignOut={() => setTool('generic')}
              resumesByCareerKey={new Map()}
              coverLetterByJobKey={new Map()}
              onOpenResumes={() => setTool('resume')}
              onCreateLetter={() => setTool('coverLetter')}
              onViewLetter={() => setTool('coverLetter')}
            />
          ) : (
            <JobsResults
              nav={nav}
              applyLink={applyLink}
              resultsNote={dateText ? t('jobsDemo.foundOn', { date: dateText }) : undefined}
              firstName={fixture.persona.firstName}
              reportId={fixture.persona.reportId}
              results={results}
              careersBySectionType={careersBySectionType}
              savedCount={savedJobs.length}
              searchSummary={searchSummary}
              isJobSaved={isJobSaved}
              onSaveJob={saveJob}
              onUnsaveJob={unsaveJob}
              resumeUnlocked={false}
              coverUnlocked={false}
              onInvite={() => setTool('invite')}
              onBack={goDashboard}
              onEditSearch={() => setTool('jobsSearch')}
              onOpenSaved={() => setView('saved')}
              onProfile={() => setTool('generic')}
              onSignOut={() => setTool('generic')}
              onTailorResume={() => setTool('resume')}
            />
          )}

          {/* Intro sits UNDER the page, as on the dashboard demo. */}
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
                <div className="lp-eyebrow text-[#1F8282] mb-3">{t('jobsDemo.intro.eyebrow')}</div>
                <h1
                  className="font-heading text-[26px] sm:text-[32px]"
                  style={{ color: '#122E3B', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.15 }}
                >
                  {t('jobsDemo.intro.title', { name: choice.firstName })}
                </h1>
                <p className="mt-3 text-[15px] text-[#4B6373] font-medium leading-[1.65]">
                  {t('jobsDemo.intro.body', { name: choice.firstName, career: careerTitle, date: dateText })}
                </p>
                <p className="mt-3 text-[15px] text-[#4B6373] font-medium leading-[1.65]">
                  {t('jobsDemo.intro.pipeline', { name: choice.firstName })}
                </p>
                <p className="mt-3 text-[14px] text-[#4B6373]/85 font-medium leading-relaxed">
                  {t('jobsDemo.intro.ageNote', { date: dateText })}
                </p>
                {chromeIsForeign && (
                  <p
                    className="mt-4 rounded-lg px-3.5 py-2.5 text-[14px] font-medium leading-relaxed"
                    style={{ background: 'rgba(212,160,36,0.12)', color: '#122E3B' }}
                  >
                    {t('jobsDemo.intro.englishNote')}
                  </p>
                )}
                <p className="mt-5 text-[15px] font-medium">
                  <Link
                    to={dashboardHref}
                    onClick={() => trackCtaClick('demo_jobs_to_dashboard')}
                    className="inline-flex items-center gap-1.5 text-[#1F8282] font-semibold underline underline-offset-4 decoration-[#1F8282]/40 hover:decoration-[#1F8282] transition-colors"
                  >
                    <ArrowLeft size={14} strokeWidth={2.4} />
                    {t('jobsDemo.footer.dashboard', { name: choice.firstName })}
                  </Link>
                  <span className="block mt-1 text-[13px] text-[#4B6373]/85">{t('jobsDemo.footer.dashboardNote')}</span>
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

export default DemoJobs;
