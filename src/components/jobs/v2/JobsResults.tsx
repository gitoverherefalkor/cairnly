// Jobs · Results — cream cards per-career grouping (the ship target per the
// handoff README). Salary renders without a currency symbol since the data
// layer doesn't carry one (per product decision); chip row for seniority /
// employment / actively-hiring is dropped because those fields aren't wired
// through the search-jobs edge function yet.

import React, { useState } from 'react';
import { ArrowRight, ExternalLink, FilePlus, FileText, Heart, Loader2, Lock, Sliders } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { DashboardAppNav } from '@/components/dashboard/v2/DashboardAppNav';
import type { JobListing, JobSearchResult } from '@/hooks/useJobSearch';
import { CoverLetterModal } from '@/components/cover-letter/CoverLetterModal';
import {
  CareerTierBadge,
  CompanyLogo,
  JEyebrow,
  MatchHistogram,
  TIER_LABEL,
  matchTone,
  postedAgo as fmtPostedAgo,
  type JobsTier,
} from './jobsV2Shared';

export interface JobsResultsCareer {
  sectionType: string;
  title: string;
  tier: JobsTier;
}

interface JobsResultsProps {
  firstName: string;
  reportId: string;
  results: JobSearchResult[];
  careersBySectionType: Map<string, JobsResultsCareer>;
  savedCount: number;
  searchSummary: string;
  isJobSaved: (externalJobId: string) => boolean;
  onSaveJob: (job: JobListing, fromCareer: string) => void;
  onUnsaveJob: (externalJobId: string) => void;
  resumeUnlocked: boolean;
  coverUnlocked: boolean;
  onInvite: () => void;
  onBack: () => void;
  onEditSearch: () => void;
  onOpenSaved: () => void;
  onProfile: () => void;
  onSignOut: () => void;
  // Fires when the user clicks "Tailor resume" on any job card. Receives the
  // career the job came from so the resume page can pre-select it.
  onTailorResume: (careerTitle: string) => void;
}

export const JobsResults: React.FC<JobsResultsProps> = ({
  firstName,
  reportId,
  results,
  careersBySectionType,
  savedCount,
  searchSummary,
  isJobSaved,
  onSaveJob,
  onUnsaveJob,
  resumeUnlocked,
  coverUnlocked,
  onInvite,
  onBack,
  onEditSearch,
  onOpenSaved,
  onProfile,
  onSignOut,
  onTailorResume,
}) => {
  // Only render careers that finished. (Idle / searching / error are surfaced
  // separately via SearchProgress when relevant.)
  const finished = results.filter((r) => r.status === 'done');
  const totalJobs = finished.reduce((sum, r) => sum + r.jobs.length, 0);
  const showInviteHint = !resumeUnlocked || !coverUnlocked;

  // Which job has the cover-letter modal open. null = modal closed.
  // Lives here so a single modal instance can be controlled from any
  // JobCardCream below.
  const [coverLetterJob, setCoverLetterJob] = useState<JobListing | null>(null);

  return (
    <LakeBackground intensity="normal">
      <DashboardAppNav
        firstName={firstName}
        pageLabel="Find Open Roles"
        onProfile={onProfile}
        onSignOut={onSignOut}
        onBack={onBack}
        backLabel="Back to dashboard"
      />

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 32px 80px' }}>
        {/* Summary bar */}
        <div
          style={{
            background: 'rgba(18, 46, 59, 0.62)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 18,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginBottom: showInviteHint ? 18 : 32,
            flexWrap: 'wrap',
          }}
        >
          <JEyebrow>RESULTS</JEyebrow>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: '#fff' }}>
            {searchSummary}
          </span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
            {totalJobs} {totalJobs === 1 ? 'job' : 'jobs'} found
          </span>
          <button
            type="button"
            onClick={onEditSearch}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '8px 14px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 12.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <Sliders size={13} /> Edit search
          </button>
          <button
            type="button"
            onClick={onOpenSaved}
            style={{
              background: 'rgba(39,161,161,0.20)',
              color: '#fff',
              border: '1px solid rgba(39,161,161,0.36)',
              padding: '8px 14px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 12.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <Heart size={13} /> Saved · {savedCount}
          </button>
        </div>

        {/* Invite hint — only when something is still locked */}
        {showInviteHint && (
          <div
            style={{
              marginBottom: 32,
              background: 'rgba(212,160,36,0.10)',
              border: '1px solid rgba(212,160,36,0.28)',
              borderRadius: 14,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Lock size={14} color={PALETTE.goldBright} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              {!resumeUnlocked && (
                <>
                  <strong style={{ color: PALETTE.goldBright }}>Tailor resume</strong> opens after your 2nd
                  invited friend joins
                </>
              )}
              {!resumeUnlocked && !coverUnlocked && ' · '}
              {!coverUnlocked && (
                <>
                  <strong style={{ color: PALETTE.goldBright }}>Cover letter</strong> after the 3rd
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onInvite}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                color: PALETTE.goldBright,
                border: '1px solid rgba(212,160,36,0.45)',
                padding: '6px 12px',
                borderRadius: 9999,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              Invite a friend <ArrowRight size={12} />
            </button>
          </div>
        )}

        {results.length === 0 && (
          <div
            style={{
              padding: 40,
              background: 'rgba(18,46,59,0.55)',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 18,
              textAlign: 'center',
              fontFamily: FONT_BODY,
              fontSize: 14,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            No completed career searches yet.
          </div>
        )}

        {/* Render every career in its original order. Completed ones show
            results; the rest show a live "searching" / "queued" state so the
            user knows more is still coming below, not that the list is done. */}
        {results.map((result) => {
          const career = careersBySectionType.get(result.sectionType);
          const careerTitle = career?.title ?? result.careerTitle;
          if (result.status === 'done') {
            return (
              <CareerGrouping
                key={result.sectionType}
                career={career}
                careerTitle={careerTitle}
                jobs={result.jobs}
                isJobSaved={isJobSaved}
                onSaveJob={(job) => onSaveJob(job, careerTitle)}
                onUnsaveJob={onUnsaveJob}
                resumeUnlocked={resumeUnlocked}
                coverUnlocked={coverUnlocked}
                onInvite={onInvite}
                onGenerateCoverLetter={(job) => setCoverLetterJob(job)}
                onTailorResume={onTailorResume}
              />
            );
          }
          return (
            <CareerSearching
              key={result.sectionType}
              career={career}
              careerTitle={careerTitle}
              status={result.status}
              error={result.error}
            />
          );
        })}
      </div>

      {coverLetterJob && (
        <CoverLetterModal
          job={coverLetterJob}
          reportId={reportId}
          onClose={() => setCoverLetterJob(null)}
        />
      )}
    </LakeBackground>
  );
};

// ── Per-career grouping ───────────────────────────────────────
const CareerGrouping: React.FC<{
  career?: JobsResultsCareer;
  careerTitle: string;
  jobs: JobListing[];
  isJobSaved: (id: string) => boolean;
  onSaveJob: (job: JobListing) => void;
  onUnsaveJob: (externalJobId: string) => void;
  resumeUnlocked: boolean;
  coverUnlocked: boolean;
  onInvite: () => void;
  onGenerateCoverLetter: (job: JobListing) => void;
  onTailorResume: (careerTitle: string) => void;
}> = ({
  career,
  careerTitle,
  jobs,
  isJobSaved,
  onSaveJob,
  onUnsaveJob,
  resumeUnlocked,
  coverUnlocked,
  onInvite,
  onGenerateCoverLetter,
  onTailorResume,
}) => {
  // Score buckets (backend already drops 0-2):
  //   6+    → main results (strong matches)
  //   3-5   → collapsed "filtered" panel (weaker matches with visible reasoning)
  //   null  → scoring failed; treat as main (don't penalize for infra issues)
  const mainJobs = jobs.filter((j) => j.match_score == null || j.match_score >= 6);
  const lowJobs = jobs.filter((j) => typeof j.match_score === 'number' && j.match_score >= 3 && j.match_score <= 5);
  const [showLow, setShowLow] = useState(false);

  return (
    <section style={{ marginBottom: 44 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          {career && <CareerTierBadge tier={career.tier} tierLabel={TIER_LABEL[career.tier]} />}
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: '-0.025em',
              color: '#fff',
              margin: '8px 0 0 0',
              lineHeight: 1.05,
            }}
          >
            {careerTitle}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <MatchHistogram jobs={jobs} />
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            {mainJobs.length} {mainJobs.length === 1 ? 'strong match' : 'strong matches'}
          </span>
        </div>
      </div>
      {mainJobs.length === 0 ? (
        <div
          style={{
            padding: 20,
            background: 'rgba(18,46,59,0.40)',
            border: '1px dashed rgba(255,255,255,0.10)',
            borderRadius: 14,
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            textAlign: 'center',
          }}
        >
          {lowJobs.length > 0
            ? 'No strong matches (6+/10) found. Lower-scoring matches are listed below.'
            : 'No openings found for this career right now. Try widening location filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mainJobs.map((job) => {
            // Clicking Cover letter or Tailor resume from a search-result
            // card implicitly saves the job to the kanban, then opens the
            // normal saved-job flow. Saved-jobs are the single source of
            // truth for both résumés and letters, so this keeps the search
            // page from being a parallel "create from nowhere" entry point.
            const saveIfNeeded = () => {
              if (!isJobSaved(job.id)) onSaveJob(job);
            };
            return (
              <JobCardCream
                key={job.id}
                job={job}
                saved={isJobSaved(job.id)}
                onSave={() => onSaveJob(job)}
                onUnsave={() => onUnsaveJob(job.id)}
                resumeUnlocked={resumeUnlocked}
                coverUnlocked={coverUnlocked}
                onLockedAction={onInvite}
                onGenerateCoverLetter={() => {
                  saveIfNeeded();
                  onGenerateCoverLetter(job);
                }}
                onTailorResume={() => {
                  saveIfNeeded();
                  onTailorResume(careerTitle);
                }}
              />
            );
          })}
        </div>
      )}

      {/* Lower-scoring matches (3-5/10): collapsed by default. Lets users
          sanity-check what the AI cut and override if they disagree. */}
      {lowJobs.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setShowLow((v) => !v)}
            style={{
              background: 'transparent',
              color: 'rgba(255,255,255,0.65)',
              border: '1px solid rgba(255,255,255,0.16)',
              padding: '10px 16px',
              borderRadius: 9999,
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {showLow ? '▾' : '▸'} {lowJobs.length} more {lowJobs.length === 1 ? 'role' : 'roles'} scored 3-5
            {showLow ? ' — hide' : ' — show why'}
          </button>
          {showLow && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14, opacity: 0.78 }}>
              {lowJobs.map((job) => {
                // Same save-then-open wrapper as the main list above.
                const saveIfNeeded = () => {
                  if (!isJobSaved(job.id)) onSaveJob(job);
                };
                return (
                  <JobCardCream
                    key={job.id}
                    job={job}
                    saved={isJobSaved(job.id)}
                    onSave={() => onSaveJob(job)}
                    onUnsave={() => onUnsaveJob(job.id)}
                    resumeUnlocked={resumeUnlocked}
                    coverUnlocked={coverUnlocked}
                    onLockedAction={onInvite}
                    onGenerateCoverLetter={() => {
                      saveIfNeeded();
                      onGenerateCoverLetter(job);
                    }}
                    onTailorResume={() => {
                      saveIfNeeded();
                      onTailorResume(careerTitle);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

// ── Per-career searching / queued placeholder ─────────────────
// Keeps in-progress careers visible (with the same header as a finished one)
// so streamed results don't appear to "pop in" out of nowhere.
const CareerSearching: React.FC<{
  career?: JobsResultsCareer;
  careerTitle: string;
  status: JobSearchResult['status'];
  error?: string;
}> = ({ career, careerTitle, status, error }) => {
  const isError = status === 'error';
  const isSearching = status === 'searching';
  return (
    <section style={{ marginBottom: 44 }}>
      <div style={{ marginBottom: 16 }}>
        {career && <CareerTierBadge tier={career.tier} tierLabel={TIER_LABEL[career.tier]} />}
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: '-0.025em',
            color: '#fff',
            margin: '8px 0 0 0',
            lineHeight: 1.05,
            opacity: isError ? 1 : 0.85,
          }}
        >
          {careerTitle}
        </h2>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 20,
          background: 'rgba(18,46,59,0.40)',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 14,
          fontFamily: FONT_BODY,
          fontSize: 13.5,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        {isError ? (
          <span style={{ color: 'rgba(255,180,180,0.9)' }}>
            {error || 'Search failed for this career. Try again.'}
          </span>
        ) : (
          <>
            <Loader2 size={16} className="animate-spin" style={{ color: PALETTE.goldBright }} />
            <span>{isSearching ? 'Searching live openings…' : 'Queued — searching next…'}</span>
          </>
        )}
      </div>
    </section>
  );
};

// ── Workplace / employment badge ──────────────────────────────
// `highlight` = gold fill (used for Remote, the thing we want to draw the eye).
const JobBadge: React.FC<{ label: string; highlight?: boolean }> = ({ label, highlight }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 9999,
      fontFamily: FONT_BODY,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.02em',
      background: highlight ? PALETTE.gold : 'rgba(18,46,59,0.08)',
      color: highlight ? PALETTE.canvasDeep : PALETTE.inkMuted,
      border: highlight ? '1px solid transparent' : `1px solid ${PALETTE.tan}`,
    }}
  >
    {label}
  </span>
);

// ── Cream job card ────────────────────────────────────────────
const JobCardCream: React.FC<{
  job: JobListing;
  saved: boolean;
  onSave: () => void;
  onUnsave: () => void;
  resumeUnlocked: boolean;
  coverUnlocked: boolean;
  onLockedAction: () => void;
  onGenerateCoverLetter: () => void;
  // Fires when the user clicks "Tailor resume" on this card AND the resume
  // feature is unlocked. Should send them to /custom-resume with the originating
  // career pre-selected so they don't have to re-pick it.
  onTailorResume: () => void;
}> = ({
  job,
  saved,
  onSave,
  onUnsave,
  resumeUnlocked,
  coverUnlocked,
  onLockedAction,
  onGenerateCoverLetter,
  onTailorResume,
}) => {
  const tone = matchTone(job.match_score, 'cream');
  const salaryText = formatSalaryRange(job.salary_min, job.salary_max);
  const postedText = fmtPostedAgo(job.posted_date);

  return (
    <article
      style={{
        position: 'relative',
        background: PALETTE.cream,
        borderRadius: 16,
        border: `1px solid ${PALETTE.tan}`,
        boxShadow: '0 14px 30px -16px rgba(0,0,0,0.40)',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 14,
          bottom: 14,
          left: 0,
          width: 3,
          borderRadius: 9999,
          background: tone,
          zIndex: 1,
        }}
      />

      {/* LEFT — content */}
      <div
        style={{
          flex: '1 1 60%',
          minWidth: 0,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <CompanyLogo company={job.company} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: '-0.015em',
                color: PALETTE.canvasDeep,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {job.title}
            </h4>
            <div
              style={{
                marginTop: 4,
                fontFamily: FONT_BODY,
                fontSize: 13,
                fontWeight: 700,
                color: PALETTE.canvasDeep,
              }}
            >
              {job.company}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: FONT_BODY,
                fontSize: 12.5,
                fontWeight: 500,
                color: PALETTE.inkMuted,
              }}
            >
              {[job.location, postedText].filter(Boolean).join(' · ')}
            </div>
            {(job.workplace_type || job.employment_type) && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {job.workplace_type && (
                  <JobBadge
                    label={job.workplace_type}
                    highlight={/remote/i.test(job.workplace_type)}
                  />
                )}
                {job.employment_type && <JobBadge label={job.employment_type} />}
              </div>
            )}
          </div>
        </div>
        {job.description && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              fontWeight: 500,
              color: PALETTE.ink,
              lineHeight: 1.55,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {job.description}
          </p>
        )}
        {job.match_reason && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12.5,
              fontWeight: 500,
              color: PALETTE.inkSoft,
              fontStyle: 'italic',
            }}
          >
            Why: {job.match_reason.replace(/[.\s]+$/, '')}...
          </div>
        )}
      </div>

      {/* RIGHT — actions */}
      <div
        style={{
          flex: '0 0 240px',
          borderLeft: '1px solid rgba(201, 182, 144, 0.5)',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'rgba(255,255,255,0.20)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {salaryText ? (
            <span
              style={{
                background: 'rgba(39,161,161,0.14)',
                color: PALETTE.tealDeep,
                padding: '4px 12px',
                borderRadius: 9999,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 12,
                border: '1px solid rgba(39,161,161,0.26)',
                whiteSpace: 'nowrap',
              }}
            >
              {salaryText}
            </span>
          ) : (
            <span style={{ fontFamily: FONT_BODY, fontSize: 11, fontWeight: 500, color: PALETTE.inkSoft }}>
              Salary not stated
            </span>
          )}
          {job.match_score != null && (
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: 17,
                color: tone,
                letterSpacing: '-0.01em',
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 2,
              }}
            >
              {job.match_score}
              <span style={{ fontSize: 10, opacity: 0.6 }}>/10</span>
            </span>
          )}
        </div>
        <a
          href={job.apply_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: PALETTE.teal,
            color: '#fff',
            textDecoration: 'none',
            padding: '10px 16px',
            borderRadius: 9999,
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 8px 18px -6px rgba(39,161,161,0.45)',
            marginTop: 4,
          }}
        >
          View &amp; apply <ExternalLink size={12} />
        </a>
        <LockedActionButton
          unlocked={resumeUnlocked}
          icon={<FileText size={12} />}
          label="Tailor resume"
          onLocked={onLockedAction}
          onClick={onTailorResume}
        />
        <LockedActionButton
          tone="gold"
          unlocked={coverUnlocked}
          icon={<FilePlus size={12} />}
          label="Cover letter"
          onLocked={onLockedAction}
          onClick={onGenerateCoverLetter}
        />
        <button
          type="button"
          onClick={saved ? onUnsave : onSave}
          style={{
            marginTop: 'auto',
            background: 'transparent',
            border: 'none',
            padding: '6px 0',
            color: saved ? PALETTE.tealDeep : PALETTE.inkSoft,
            cursor: 'pointer',
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 12.5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Heart size={13} fill={saved ? PALETTE.tealDeep : 'none'} />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </article>
  );
};

// Card-side action button used for the "Tailor resume" and "Cover letter"
// CTAs. `tone="teal"` (default) stays outlined-teal to keep the secondary
// hierarchy; `tone="gold"` fills with mustard so the unlocked action reads
// as a primary CTA on the cream card. Locked state uses the same muted
// grey + lock icon regardless of tone, so the contrast between locked and
// unlocked is unmistakable.
const LockedActionButton: React.FC<{
  unlocked: boolean;
  icon: React.ReactNode;
  label: string;
  onLocked: () => void;
  // Fired when the user clicks the button and the feature *is* unlocked.
  // Optional — buttons that don't have a wired-up flow yet (e.g. Tailor
  // resume from a job posting) leave it undefined and become no-ops.
  onClick?: () => void;
  tone?: 'teal' | 'gold';
}> = ({ unlocked, icon, label, onLocked, onClick, tone = 'teal' }) => {
  const lockedStyle: React.CSSProperties = {
    background: 'rgba(18, 46, 59, 0.04)',
    border: `1px dashed ${PALETTE.tan}`,
    color: PALETTE.inkMuted,
    boxShadow: 'none',
  };
  const unlockedStyle: React.CSSProperties =
    tone === 'gold'
      ? {
          background: PALETTE.gold,
          border: '1px solid transparent',
          color: PALETTE.canvasDeep,
          boxShadow: '0 8px 18px -8px rgba(212,160,36,0.55)',
        }
      : {
          background: 'transparent',
          border: `1px solid ${PALETTE.tan}`,
          color: PALETTE.tealDeep,
          boxShadow: 'none',
        };

  return (
    <button
      type="button"
      onClick={() => {
        if (!unlocked) {
          onLocked();
          return;
        }
        onClick?.();
      }}
      style={{
        padding: '8px 14px',
        borderRadius: 9999,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 12.5,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        ...(unlocked ? unlockedStyle : lockedStyle),
      }}
    >
      {unlocked ? icon : <Lock size={12} />}
      {label}
    </button>
  );
};

// "110–180k" with no currency symbol (per product decision — no currency in schema).
function formatSalaryRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return '';
  const k = (n: number) => Math.round(n / 1000);
  if (min != null && max != null && max > min) return `${k(min)}–${k(max)}k`;
  const v = (min ?? max) as number;
  return `${k(v)}k`;
}
