// Jobs · Results — cream cards per-career grouping (the ship target per the
// handoff README). Salary renders without a currency symbol since the data
// layer doesn't carry one (per product decision); chip row for seniority /
// employment / actively-hiring is dropped because those fields aren't wired
// through the search-jobs edge function yet.

import React from 'react';
import { ArrowRight, ExternalLink, FilePlus, FileText, Heart, Loader2, Lock, Sliders } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
  LakeBackground,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { DashboardAppNav } from '@/components/dashboard/v2/DashboardAppNav';
import type { JobListing, JobSearchResult } from '@/hooks/useJobSearch';
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
}

export const JobsResults: React.FC<JobsResultsProps> = ({
  firstName,
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
}) => {
  // Only render careers that finished. (Idle / searching / error are surfaced
  // separately via SearchProgress when relevant.)
  const finished = results.filter((r) => r.status === 'done');
  const totalJobs = finished.reduce((sum, r) => sum + r.jobs.length, 0);
  const showInviteHint = !resumeUnlocked || !coverUnlocked;

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
}> = ({ career, careerTitle, jobs, isJobSaved, onSaveJob, onUnsaveJob, resumeUnlocked, coverUnlocked, onInvite }) => (
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
          {jobs.length} {jobs.length === 1 ? 'role' : 'roles'}
        </span>
      </div>
    </div>
    {jobs.length === 0 ? (
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
        No openings found for this career right now. Try widening location filters.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {jobs.map((job) => (
          <JobCardCream
            key={job.id}
            job={job}
            saved={isJobSaved(job.id)}
            onSave={() => onSaveJob(job)}
            onUnsave={() => onUnsaveJob(job.id)}
            resumeUnlocked={resumeUnlocked}
            coverUnlocked={coverUnlocked}
            onLockedAction={onInvite}
          />
        ))}
      </div>
    )}
  </section>
);

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

// ── Cream job card ────────────────────────────────────────────
const JobCardCream: React.FC<{
  job: JobListing;
  saved: boolean;
  onSave: () => void;
  onUnsave: () => void;
  resumeUnlocked: boolean;
  coverUnlocked: boolean;
  onLockedAction: () => void;
}> = ({ job, saved, onSave, onUnsave, resumeUnlocked, coverUnlocked, onLockedAction }) => {
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
        />
        <LockedActionButton
          unlocked={coverUnlocked}
          icon={<FilePlus size={12} />}
          label="Cover letter"
          onLocked={onLockedAction}
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

const LockedActionButton: React.FC<{
  unlocked: boolean;
  icon: React.ReactNode;
  label: string;
  onLocked: () => void;
}> = ({ unlocked, icon, label, onLocked }) => (
  <button
    type="button"
    onClick={() => {
      if (!unlocked) onLocked();
      // When unlocked, the actual resume/cover flow is out of scope for this
      // redesign; the parent /jobs page will wire it later. For now, no-op.
    }}
    style={{
      background: 'transparent',
      border: `1px solid ${PALETTE.tan}`,
      padding: '8px 14px',
      borderRadius: 9999,
      color: unlocked ? PALETTE.tealDeep : PALETTE.inkMuted,
      fontFamily: FONT_BODY,
      fontWeight: 700,
      fontSize: 12.5,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      cursor: 'pointer',
    }}
  >
    {unlocked ? icon : <Lock size={12} />}
    {label}
  </button>
);

// "110–180k" with no currency symbol (per product decision — no currency in schema).
function formatSalaryRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null && max == null) return '';
  const k = (n: number) => Math.round(n / 1000);
  if (min != null && max != null && max > min) return `${k(min)}–${k(max)}k`;
  const v = (min ?? max) as number;
  return `${k(v)}k`;
}
