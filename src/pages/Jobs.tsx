import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useReports } from '@/hooks/useReports';
import { useReferralStatus } from '@/hooks/useReferralStatus';
import { useReportSections, SECTION_TYPE_MAP } from '@/hooks/useReportSections';
import { useJobSearch, type JobListing, type UserLanguage, type WorkArrangement } from '@/hooks/useJobSearch';
import { useSavedJobs, type SavedJobStatus } from '@/hooks/useSavedJobs';
import { useToast } from '@/hooks/use-toast';
import { COUNTRIES, profileCountryToCode } from '@/components/jobs/LocationInput';
import type { CareerTier } from '@/components/jobs/CareerSelector';
import { JobsLocked } from '@/components/jobs/v2/JobsLocked';
import { JobsSearch, type JobsSearchCareerOption } from '@/components/jobs/v2/JobsSearch';
import { JobsResults, type JobsResultsCareer } from '@/components/jobs/v2/JobsResults';
import { JobsSavedKanban } from '@/components/jobs/v2/JobsSavedKanban';
import type { JobsTier } from '@/components/jobs/v2/jobsV2Shared';

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/\*+/g, '').trim();

// Career section IDs that represent actual career recommendations.
const CAREER_SECTION_IDS = ['first-career', 'second-career', 'third-career', 'runner-up', 'outside-box'];

const SECTION_TO_TIER: Record<string, CareerTier & JobsTier> = {
  'first-career': 'top-1',
  'second-career': 'top-2',
  'third-career': 'top-3',
  'runner-up': 'runner-up',
  'outside-box': 'outside-box',
};

type View = 'search' | 'results' | 'saved';

// Persisted search snapshot so a page refresh restores the user's careers,
// location filters, and results instead of resetting to defaults. sessionStorage
// (not localStorage) so it lives for the browsing session and clears on tab
// close — job results go stale, and the backend re-caches them cheaply anyway.
const JOBS_STATE_KEY = 'cairnly_jobs_search_v1';

interface PersistedJobsState {
  view: View;
  selectedCareers: string[];
  primaryCountry: string;
  secondaryCountry: string;
  city: string;
  workArrangement: WorkArrangement;
  results: import('@/hooks/useJobSearch').JobSearchResult[];
}

function readPersistedJobsState(): PersistedJobsState | null {
  try {
    const raw = sessionStorage.getItem(JOBS_STATE_KEY);
    return raw ? (JSON.parse(raw) as PersistedJobsState) : null;
  } catch {
    return null;
  }
}

const Jobs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { reports, isLoading: reportsLoading } = useReports();
  const referralStatus = useReferralStatus();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const latestReport = reports?.length ? reports[0] : null;
  const { sections, isLoading: sectionsLoading } = useReportSections(latestReport?.id);

  const { results, isSearching, searchJobs, restoreResults } = useJobSearch();
  const { savedJobs, saveJob, unsaveJob, updateStatus, isJobSaved } = useSavedJobs();

  // Read the persisted snapshot once (lazy — runs a single time on mount).
  const [persisted] = useState<PersistedJobsState | null>(() => readPersistedJobsState());

  // View / filter state — seeded from the persisted snapshot when present.
  const [view, setView] = useState<View>(() =>
    persisted?.view === 'results' && !persisted?.results?.some((r) => r.status === 'done')
      ? 'search' // had a results view but nothing completed — fall back to the picker
      : persisted?.view ?? 'search',
  );
  const [selectedCareers, setSelectedCareers] = useState<string[]>(() => persisted?.selectedCareers ?? []);
  const [primaryCountry, setPrimaryCountry] = useState(() => persisted?.primaryCountry ?? 'us');
  const [secondaryCountry, setSecondaryCountry] = useState(() => persisted?.secondaryCountry ?? '');
  const [city, setCity] = useState(() => persisted?.city ?? '');
  const [workArrangement, setWorkArrangement] = useState<WorkArrangement>(() => persisted?.workArrangement ?? 'any');

  // Build career options from real report sections.
  const careerOptions = useMemo<JobsSearchCareerOption[]>(() => {
    const opts: JobsSearchCareerOption[] = [];
    for (const sectionId of CAREER_SECTION_IDS) {
      const matching = sections.filter((s) => SECTION_TYPE_MAP[s.section_type] === sectionId);
      if (matching.length === 0) continue;

      const tier = SECTION_TO_TIER[sectionId];
      if (['runner-up', 'outside-box'].includes(sectionId)) {
        // Multi-career sections — each row becomes its own pickable option.
        for (const s of matching) {
          const title = s.title ? stripHtml(s.title) : '';
          if (!title) continue;
          opts.push({
            sectionType: `${sectionId}__${s.id}`,
            title,
            tier,
            shape: s.company_size_type ? stripHtml(s.company_size_type) : null,
          });
        }
      } else {
        const s = matching[0];
        const title = s.title ? stripHtml(s.title) : '';
        if (!title) continue;
        opts.push({
          sectionType: sectionId,
          title,
          tier,
          shape: s.company_size_type ? stripHtml(s.company_size_type) : null,
        });
      }
    }
    return opts;
  }, [sections]);

  // Career lookup keyed by sectionType for the Results screen.
  const careersBySectionType = useMemo(() => {
    const m = new Map<string, JobsResultsCareer>();
    for (const c of careerOptions) {
      m.set(c.sectionType, { sectionType: c.sectionType, title: c.title, tier: c.tier });
    }
    return m;
  }, [careerOptions]);

  // Extract languages from the Skills/Achievements answer in the report payload.
  // Question id for Skills/Achievements/Languages: 11111111-1111-1111-1111-11111111111f.
  const userLanguages = useMemo<UserLanguage[]>(() => {
    const SKILLS_QID = '11111111-1111-1111-1111-11111111111f';
    const payload = (latestReport as any)?.payload;
    const langs = payload?.responses?.[SKILLS_QID]?.languages;
    if (!langs) return [];
    const out: UserLanguage[] = [];
    const validProf = new Set(['native', 'fluent', 'conversational', 'basic']);
    const collect = (obj: Record<string, unknown> | null | undefined) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [lang, prof] of Object.entries(obj)) {
        const p = String(prof || '').toLowerCase();
        if (lang && validProf.has(p)) {
          out.push({ language: lang, proficiency: p as UserLanguage['proficiency'] });
        }
      }
    };
    collect(langs.presets);
    collect(langs.other);
    return out;
  }, [latestReport]);

  // Restore a completed search from the persisted snapshot once on mount.
  useEffect(() => {
    if (persisted?.results?.length) restoreResults(persisted.results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the search snapshot whenever inputs or results change, so a refresh
  // restores exactly what the user was looking at.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        JOBS_STATE_KEY,
        JSON.stringify({ view, selectedCareers, primaryCountry, secondaryCountry, city, workArrangement, results }),
      );
    } catch {
      // sessionStorage full or unavailable — non-fatal, just skip persisting.
    }
  }, [view, selectedCareers, primaryCountry, secondaryCountry, city, workArrangement, results]);

  // Pre-fill primary country from profile — only when there's no restored
  // snapshot, so we don't clobber a country the user already picked.
  useEffect(() => {
    if (!persisted && profile?.country) {
      setPrimaryCountry(profileCountryToCode(profile.country));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.country]);

  // Defensive: if user picks the same country in both selects, clear the secondary.
  useEffect(() => {
    if (secondaryCountry && secondaryCountry === primaryCountry) {
      setSecondaryCountry('');
    }
  }, [primaryCountry, secondaryCountry]);

  // Pre-select career from query param (?career=first-career).
  useEffect(() => {
    const preselect = searchParams.get('career');
    if (preselect && careerOptions.length > 0) {
      const matches = careerOptions
        .filter((c) => c.sectionType === preselect || c.sectionType.startsWith(`${preselect}__`))
        .map((c) => c.sectionType)
        .slice(0, 3);
      if (matches.length > 0) setSelectedCareers(matches);
    }
  }, [searchParams, careerOptions]);

  // Default-select the user's top 3 careers when sections load and no
  // pre-selection or query param has set them yet.
  useEffect(() => {
    if (selectedCareers.length > 0 || careerOptions.length === 0) return;
    const topThree = careerOptions
      .filter((c) => c.tier === 'top-1' || c.tier === 'top-2' || c.tier === 'top-3')
      .map((c) => c.sectionType);
    if (topThree.length > 0) setSelectedCareers(topThree);
  }, [careerOptions, selectedCareers.length]);

  // Auth gate.
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Flip to results once at least one career finishes — but only for a freshly
  // initiated search. Without this guard, clicking "Edit search" (which sets
  // view back to 'search') would instantly bounce to 'results' because the
  // previous run's results are still present.
  const awaitingSearchRef = useRef(false);
  useEffect(() => {
    if (awaitingSearchRef.current && results.some((r) => r.status === 'done')) {
      awaitingSearchRef.current = false;
      setView('results');
    }
  }, [results]);

  const handleToggleCareer = (sectionType: string) => {
    setSelectedCareers((prev) =>
      prev.includes(sectionType) ? prev.filter((s) => s !== sectionType) : [...prev, sectionType],
    );
  };

  const handleSearch = () => {
    const careers = selectedCareers
      .map((st) => {
        const option = careerOptions.find((c) => c.sectionType === st);
        return { careerTitle: option?.title || '', sectionType: st };
      })
      .filter((c) => c.careerTitle);
    const countryCodes = secondaryCountry ? [primaryCountry, secondaryCountry] : [primaryCountry];
    awaitingSearchRef.current = true;
    searchJobs(careers, countryCodes, city || undefined, workArrangement, userLanguages, latestReport?.id);
  };

  const handleInvite = async () => {
    const link = referralStatus.referralLink;
    if (!link) {
      toast({ title: 'One moment', description: 'Your invite link is still being prepared. Try again shortly.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Invite link copied', description: 'Share it with a friend to unlock your next tool.' });
    } catch {
      toast({ title: 'Your invite link', description: link });
    }
  };

  // ── Loading / no-report / auth gates ─────────────────────────
  const isPageLoading =
    authLoading || profileLoading || reportsLoading || sectionsLoading || referralStatus.isLoading;

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-atlas-teal" />
      </div>
    );
  }

  const firstName = profile?.first_name || '';

  if (!latestReport || latestReport.status !== 'completed') {
    // Pre-report state — bounce to dashboard, which handles the
    // assessment/coach flow.
    navigate('/dashboard', { replace: true });
    return null;
  }

  // ── Tier-1 referral gate → Locked screen ─────────────────────
  const jobsFeature = referralStatus.features.find((f) => f.key === 'jobs');
  const resumeFeature = referralStatus.features.find((f) => f.key === 'resume');
  const coverFeature = referralStatus.features.find((f) => f.key === 'cover-letter');
  if (jobsFeature && !jobsFeature.unlocked) {
    return (
      <JobsLocked
        firstName={firstName}
        referralCode={referralStatus.referralCode}
        onBack={() => navigate('/dashboard')}
        onShare={handleInvite}
        onProfile={() => navigate('/profile')}
        onSignOut={() => navigate('/auth')}
      />
    );
  }

  const resumeUnlocked = !!resumeFeature?.unlocked;
  const coverUnlocked = !!coverFeature?.unlocked;
  const savedCount = savedJobs.length;

  // ── Saved kanban ─────────────────────────────────────────────
  if (view === 'saved') {
    return (
      <JobsSavedKanban
        firstName={firstName}
        savedJobs={savedJobs}
        resumeUnlocked={resumeUnlocked}
        coverUnlocked={coverUnlocked}
        onUpdateStatus={(jobId, status) => updateStatus({ externalJobId: jobId, status })}
        onBackToSearch={() => setView('search')}
        onBack={() => navigate('/dashboard')}
        onInvite={handleInvite}
        onProfile={() => navigate('/profile')}
        onSignOut={() => navigate('/auth')}
      />
    );
  }

  // ── Results ──────────────────────────────────────────────────
  if (view === 'results') {
    const summaryParts = [
      `${selectedCareers.length} ${selectedCareers.length === 1 ? 'career' : 'careers'}`,
      [primaryCountry, secondaryCountry].filter(Boolean).map((c) => c.toUpperCase()).join(' + '),
      workArrangement === 'remote_only' ? 'remote only' : workArrangement === 'remote_friendly' ? 'remote-friendly' : null,
    ].filter(Boolean);
    return (
      <JobsResults
        firstName={firstName}
        results={results}
        careersBySectionType={careersBySectionType}
        savedCount={savedCount}
        searchSummary={summaryParts.join(' · ')}
        isJobSaved={isJobSaved}
        onSaveJob={(job: JobListing, fromCareer: string) => saveJob({ job, fromCareer } as any)}
        onUnsaveJob={unsaveJob}
        resumeUnlocked={resumeUnlocked}
        coverUnlocked={coverUnlocked}
        onInvite={handleInvite}
        onBack={() => navigate('/dashboard')}
        onEditSearch={() => setView('search')}
        onOpenSaved={() => setView('saved')}
        onProfile={() => navigate('/profile')}
        onSignOut={() => navigate('/auth')}
      />
    );
  }

  // ── Search (default) ─────────────────────────────────────────
  return (
    <JobsSearch
      firstName={firstName}
      careers={careerOptions}
      selected={selectedCareers}
      onToggleSelected={handleToggleCareer}
      countries={COUNTRIES}
      primaryCountry={primaryCountry}
      onPrimaryCountryChange={setPrimaryCountry}
      secondaryCountry={secondaryCountry}
      onSecondaryCountryChange={setSecondaryCountry}
      city={city}
      onCityChange={setCity}
      workArrangement={workArrangement}
      onWorkArrangementChange={setWorkArrangement}
      isSearching={isSearching}
      onSearch={handleSearch}
      onBack={() => navigate('/dashboard')}
      onProfile={() => navigate('/profile')}
      onSignOut={() => navigate('/auth')}
      savedCount={savedCount}
      onOpenSaved={() => setView('saved')}
    />
  );
};

export default Jobs;
