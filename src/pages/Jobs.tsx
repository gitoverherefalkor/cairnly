import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useReports } from '@/hooks/useReports';
import { useReferralStatus } from '@/hooks/useReferralStatus';
import { useReportSections, SECTION_TYPE_MAP } from '@/hooks/useReportSections';
import { useJobSearch, type JobListing, type UserLanguage, type WorkArrangement, type JobCommitment } from '@/hooks/useJobSearch';
import { useSavedJobs, type SavedJobStatus } from '@/hooks/useSavedJobs';
import { useToast } from '@/hooks/use-toast';
import { COUNTRIES, profileCountryToCode } from '@/components/jobs/LocationInput';
import type { CareerTier } from '@/components/jobs/CareerSelector';
import { JobsLocked } from '@/components/jobs/v2/JobsLocked';
import { JobsSearch, type JobsSearchCareerOption, type RecentSearch } from '@/components/jobs/v2/JobsSearch';
import { JobsResults, type JobsResultsCareer } from '@/components/jobs/v2/JobsResults';
import { JobsSavedKanban } from '@/components/jobs/v2/JobsSavedKanban';
import type { JobsTier } from '@/components/jobs/v2/jobsV2Shared';
import { useCustomResumeList } from '@/components/custom-resume/hooks/useCustomResumeList';
import { useCoverLetterList } from '@/components/cover-letter/hooks/useCoverLetterList';
import { ResumeViewerModal } from '@/components/custom-resume/v2/ResumeViewerModal';
import { CoverLetterModal } from '@/components/cover-letter/CoverLetterModal';
import type { CustomResumeRow } from '@/components/custom-resume/hooks/useCustomResumes';
import type { SavedJob } from '@/hooks/useSavedJobs';

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
  jobCommitment: JobCommitment;
  disabledAvoids: string[];
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

// Recent searches — last N search configs the user ran, stored in
// localStorage so they survive tab close. Shown as a chip-list under the
// Search button so the user can re-apply a previous setup in one click
// (backend cache makes that re-run effectively free).
const RECENT_SEARCHES_KEY = 'cairnly_recent_jobs_searches_v1';
const RECENT_SEARCHES_MAX = 5;

function readRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function snapshotsEqual(a: RecentSearch, b: Omit<RecentSearch, 'ranAt'>): boolean {
  return (
    a.primaryCountry === b.primaryCountry &&
    a.secondaryCountry === b.secondaryCountry &&
    a.city === b.city &&
    a.workArrangement === b.workArrangement &&
    a.jobCommitment === b.jobCommitment &&
    a.selectedCareers.length === b.selectedCareers.length &&
    a.selectedCareers.every((c, i) => c === b.selectedCareers[i])
  );
}

function pushRecentSearch(snapshot: Omit<RecentSearch, 'ranAt'>): RecentSearch[] {
  const current = readRecentSearches();
  const deduped = current.filter((s) => !snapshotsEqual(s, snapshot));
  const next: RecentSearch[] = [{ ...snapshot, ranAt: Date.now() }, ...deduped].slice(
    0,
    RECENT_SEARCHES_MAX,
  );
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    /* quota / unavailable — best-effort only */
  }
  return next;
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

  // Was this page entered with explicit "fresh search" intent? Any
  // "Find Open Roles" CTA on the dashboard sends ?mode=search (and optionally
  // ?career=<title>). In that case we override the persisted view/selection
  // so the user lands on the filter page with a focused start, not on stale
  // results that may not include the career they just clicked.
  const [freshIntent] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return { mode: p.get('mode'), career: p.get('career') };
    } catch {
      return { mode: null as string | null, career: null as string | null };
    }
  });
  const wantsFreshSearch = freshIntent.mode === 'search' || !!freshIntent.career;

  // View / filter state — seeded from the persisted snapshot when present,
  // unless the URL signals a fresh search intent (in which case we force the
  // filter view).
  const [view, setView] = useState<View>(() => {
    if (wantsFreshSearch) return 'search';
    if (persisted?.view === 'results' && !persisted?.results?.some((r) => r.status === 'done')) {
      return 'search'; // had a results view but nothing completed — fall back to the picker
    }
    return persisted?.view ?? 'search';
  });
  // When entering with a fresh-search intent, start with no selection so the
  // pre-select effect (below) can replace it cleanly with the clicked career
  // instead of stacking on top of restored picks.
  const [selectedCareers, setSelectedCareers] = useState<string[]>(() =>
    wantsFreshSearch ? [] : (persisted?.selectedCareers ?? []),
  );
  const [primaryCountry, setPrimaryCountry] = useState(() => persisted?.primaryCountry ?? 'us');
  const [secondaryCountry, setSecondaryCountry] = useState(() => persisted?.secondaryCountry ?? '');
  const [city, setCity] = useState(() => persisted?.city ?? '');
  const [workArrangement, setWorkArrangement] = useState<WorkArrangement>(() => persisted?.workArrangement ?? 'any');
  const [jobCommitment, setJobCommitment] = useState<JobCommitment>(() => persisted?.jobCommitment ?? 'any');
  // Avoid items the user has unchecked for this search (so they can override
  // assessment preferences they don't remember / no longer want applied).
  const [disabledAvoids, setDisabledAvoids] = useState<string[]>(() => persisted?.disabledAvoids ?? []);

  // Build career options from real report sections.
  // Pull the "<h5>Overview</h5>" paragraph out of a report section's content
  // and return it as plain text. Sections look like:
  //   <h5>Overview</h5>\n\n<25-40 word paragraph>\n\n<h5>Why this role fits…
  // Strip HTML, collapse whitespace, cap at 400 chars for safety.
  const extractOverview = (content: string | null | undefined): string | null => {
    if (!content) return null;
    const m = content.match(/<h\d>\s*Overview\s*<\/h\d>\s*([\s\S]*?)(?=<h\d>|$)/i);
    if (!m) return null;
    const text = m[1]
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400);
    return text || null;
  };

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
            overview: extractOverview(s.content),
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
          overview: extractOverview(s.content),
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

  // Cherry-pick the survey's "avoid" answers straight from the report payload
  // (deterministic — no LLM parsing of the prose summary). These feed the n8n
  // scorer as a penalty signal so jobs the user told us to avoid rank lower.
  //   44…447 = industries to avoid, 33…338 = career aspects to avoid.
  const avoidPreferences = useMemo<string[]>(() => {
    const AVOID_INDUSTRIES_QID = '44444444-4444-4444-4444-444444444447';
    const AVOID_ASPECTS_QID = '33333333-3333-3333-3333-333333333338';
    const resp = (latestReport as any)?.payload?.responses;
    if (!resp) return [];
    // Strip markdown bold + trailing "(e.g. …)" examples and newlines.
    const clean = (s: unknown) =>
      String(s ?? '')
        .replace(/\*\*/g, '')
        .split(/\n|\(e\.g/i)[0]
        .replace(/\s+/g, ' ')
        .trim();
    // "Industry doesn't matter to me…" is a no-preference sentinel, not an avoid.
    const isNoPref = (s: string) => /doesn'?t matter|no preference|not applicable/i.test(s);
    const out: string[] = [];
    for (const qid of [AVOID_INDUSTRIES_QID, AVOID_ASPECTS_QID]) {
      const v = resp[qid];
      if (Array.isArray(v)) {
        for (const item of v) {
          const c = clean(item);
          if (c && !isNoPref(c)) out.push(c);
        }
      }
    }
    return [...new Set(out)];
  }, [latestReport]);

  // The avoid items actually sent to the scorer = everything the user hasn't
  // unchecked in the foldout.
  const activeAvoids = useMemo(
    () => avoidPreferences.filter((a) => !disabledAvoids.includes(a)),
    [avoidPreferences, disabledAvoids],
  );
  const toggleAvoid = (item: string) =>
    setDisabledAvoids((prev) => (prev.includes(item) ? prev.filter((p) => p !== item) : [...prev, item]));

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
        JSON.stringify({ view, selectedCareers, primaryCountry, secondaryCountry, city, workArrangement, jobCommitment, disabledAvoids, results }),
      );
    } catch {
      // sessionStorage full or unavailable — non-fatal, just skip persisting.
    }
  }, [view, selectedCareers, primaryCountry, secondaryCountry, city, workArrangement, jobCommitment, disabledAvoids, results]);

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

  // Pre-select career from ?career= — accepts either a sectionType
  // ('first-career', 'runner-up', or a full 'runner-up__<uuid>') OR a plain
  // career title (case-insensitive). The dashboard "Find Open Roles" CTAs pass
  // the title since CareerMatch doesn't carry a sectionType.
  useEffect(() => {
    const preselect = searchParams.get('career');
    if (!preselect || careerOptions.length === 0) return;
    const needle = preselect.toLowerCase();
    let matches = careerOptions
      .filter((c) => c.sectionType === preselect || c.sectionType.startsWith(`${preselect}__`))
      .map((c) => c.sectionType);
    if (matches.length === 0) {
      matches = careerOptions
        .filter((c) => c.title.toLowerCase() === needle)
        .map((c) => c.sectionType);
    }
    matches = matches.slice(0, 3);
    if (matches.length > 0) setSelectedCareers(matches);
  }, [searchParams, careerOptions]);

  // Default-select the user's top 3 careers ONCE, when sections first load and
  // nothing is already selected (no persisted snapshot or query param). Guarded
  // by a ref so that later unselecting everything does NOT re-trigger the
  // default — selecting none is a valid state (the search button just disables).
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (didAutoSelectRef.current || careerOptions.length === 0) return;
    didAutoSelectRef.current = true;
    if (selectedCareers.length > 0) return;
    const topThree = careerOptions
      .filter((c) => c.tier === 'top-1' || c.tier === 'top-2' || c.tier === 'top-3')
      .map((c) => c.sectionType);
    if (topThree.length > 0) setSelectedCareers(topThree);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careerOptions]);

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

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => readRecentSearches());

  const handleSearch = () => {
    const careers = selectedCareers
      .map((st) => {
        const option = careerOptions.find((c) => c.sectionType === st);
        return {
          careerTitle: option?.title || '',
          sectionType: st,
          overview: option?.overview ?? undefined,
        };
      })
      .filter((c) => c.careerTitle);
    if (careers.length === 0) return;
    const countryCodes = secondaryCountry ? [primaryCountry, secondaryCountry] : [primaryCountry];
    awaitingSearchRef.current = true;
    // Capture this search in the recent-searches list (localStorage) so users
    // can replay it later without re-picking. Stays out of sessionStorage on
    // purpose — that holds the live results snapshot, this holds inputs only.
    setRecentSearches(
      pushRecentSearch({
        selectedCareers,
        primaryCountry,
        secondaryCountry,
        city,
        workArrangement,
        jobCommitment,
      }),
    );
    searchJobs(careers, countryCodes, city || undefined, workArrangement, jobCommitment, userLanguages, latestReport?.id, activeAvoids);
  };

  // Clicking a recent-search chip restores the inputs (selection + filters).
  // The user then clicks Search to actually run it — keeps behavior explicit
  // and avoids any state/effect timing issues with auto-firing.
  const applyRecentSearch = (s: RecentSearch) => {
    setSelectedCareers(s.selectedCareers);
    setPrimaryCountry(s.primaryCountry);
    setSecondaryCountry(s.secondaryCountry);
    setCity(s.city);
    setWorkArrangement(s.workArrangement);
    setJobCommitment(s.jobCommitment);
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

  // ── Lookup maps for kanban "Résumé" / "Cover" affordances ────
  // The kanban needs to know whether the user already has a tailored résumé
  // for each card's origin career and/or a cover letter for each specific
  // posting, so the buttons can light up gold + open the right modal instead
  // of being dead.
  const { data: savedResumes } = useCustomResumeList();
  const { data: savedLetters } = useCoverLetterList();

  // career_title (lowercased) → résumés for that career.
  const resumesByCareerTitle = useMemo(() => {
    const map = new Map<string, CustomResumeRow[]>();
    (savedResumes ?? []).forEach((r) => {
      if (r.status !== 'completed') return;
      const key = (r.career_title || '').toLowerCase().trim();
      if (!key) return;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    });
    return map;
  }, [savedResumes]);

  // career_title (lowercased) → count, for the kanban (uses count only).
  const resumesByCareerKey = useMemo(() => {
    const map = new Map<string, number>();
    resumesByCareerTitle.forEach((list, key) => map.set(key, list.length));
    return map;
  }, [resumesByCareerTitle]);

  // job_external_id → cover_letter id (latest completed letter wins, since
  // savedLetters is ordered newest first).
  const coverLetterByJobKey = useMemo(() => {
    const map = new Map<string, string>();
    (savedLetters ?? []).forEach((l) => {
      if (l.status !== 'completed' || !l.job_external_id) return;
      if (!map.has(l.job_external_id)) map.set(l.job_external_id, l.id);
    });
    return map;
  }, [savedLetters]);

  // Modal state for the two affordances opened from the kanban.
  const [resumeModalCareer, setResumeModalCareer] = useState<string | null>(null);
  const [coverModalState, setCoverModalState] = useState<
    { job: JobListing; existingId: string | null } | null
  >(null);

  // Adapt a SavedJob row into the JobListing shape CoverLetterModal expects.
  const savedJobToListing = (j: SavedJob): JobListing => ({
    id: j.external_job_id,
    title: j.job_title,
    company: j.company_name || '',
    location: j.location || '',
    description: j.description_snippet || '',
    apply_url: j.apply_url || '',
    posted_date: j.posted_date || undefined,
    source: j.source || 'LinkedIn',
    match_score: j.match_score ?? null,
  });

  // ── Saved kanban ─────────────────────────────────────────────
  if (view === 'saved') {
    const resumesForModal = resumeModalCareer
      ? resumesByCareerTitle.get(resumeModalCareer.toLowerCase().trim()) ?? []
      : [];
    return (
      <>
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
          resumesByCareerKey={resumesByCareerKey}
          coverLetterByJobKey={coverLetterByJobKey}
          onOpenResumes={(careerTitle) => setResumeModalCareer(careerTitle)}
          onCreateLetter={(j) => setCoverModalState({ job: savedJobToListing(j), existingId: null })}
          onViewLetter={(j, id) =>
            setCoverModalState({ job: savedJobToListing(j), existingId: id })
          }
        />
        {resumeModalCareer && resumesForModal.length > 0 && (
          <ResumeViewerModal
            careerTitle={resumeModalCareer}
            resumes={resumesForModal}
            onClose={() => setResumeModalCareer(null)}
          />
        )}
        {coverModalState && (
          <CoverLetterModal
            job={coverModalState.job}
            reportId={latestReport.id}
            existingCoverLetterId={coverModalState.existingId}
            onClose={() => setCoverModalState(null)}
          />
        )}
      </>
    );
  }

  // ── Results ──────────────────────────────────────────────────
  if (view === 'results') {
    const summaryParts = [
      `${selectedCareers.length} ${selectedCareers.length === 1 ? 'career' : 'careers'}`,
      [primaryCountry, secondaryCountry].filter(Boolean).map((c) => c.toUpperCase()).join(' + '),
      workArrangement === 'remote_only' ? 'remote only' : workArrangement === 'remote_friendly' ? 'remote-friendly' : null,
      jobCommitment === 'full_time'
        ? 'full-time'
        : jobCommitment === 'part_time'
          ? 'part-time'
          : jobCommitment === 'contract'
            ? 'contract / freelance'
            : null,
    ].filter(Boolean);
    return (
      <JobsResults
        firstName={firstName}
        reportId={latestReport.id}
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
        onTailorResume={(careerTitle) =>
          navigate(`/custom-resume?career=${encodeURIComponent(careerTitle)}`)
        }
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
      jobCommitment={jobCommitment}
      onJobCommitmentChange={setJobCommitment}
      avoidPreferences={avoidPreferences}
      disabledAvoids={disabledAvoids}
      onToggleAvoid={toggleAvoid}
      isSearching={isSearching}
      onSearch={handleSearch}
      onBack={() => navigate('/dashboard')}
      onProfile={() => navigate('/profile')}
      onSignOut={() => navigate('/auth')}
      savedCount={savedCount}
      onOpenSaved={() => setView('saved')}
      recentSearches={recentSearches}
      onApplyRecentSearch={applyRecentSearch}
      countryLabelByCode={(code: string) =>
        COUNTRIES.find((c) => c.code === code)?.label ?? code.toUpperCase()
      }
    />
  );
};

export default Jobs;
