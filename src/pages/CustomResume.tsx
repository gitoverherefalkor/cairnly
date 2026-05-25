// Custom Résumé page — v2.
//
// Single-page builder (no multi-step wizard) styled like /jobs:
//   - approach_vis background, dashboard nav at top.
//   - Hero (gold eyebrow, big heading), career picker (max 3, glassy cards),
//     template grid (5 tiles), cover-letter pill toggle, gold "Generate" CTA.
//   - After kicking off generation, the same page swaps to the results view
//     with one tab per career, live PDF preview, and download buttons.
//
// State machine driven by ?ids= URL params: present → results, absent →
// builder. Reloading on the results URL goes straight to results.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Lock, Upload } from 'lucide-react';
import {
  PALETTE,
  FONT_DISPLAY,
  FONT_BODY,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { DashboardAppNav } from '@/components/dashboard/v2/DashboardAppNav';
import { ApproachBackground, REyebrow, glassCardStyle } from '@/components/custom-resume/v2/customResumeV2Shared';
import { CustomResumeBuilder } from '@/components/custom-resume/v2/CustomResumeBuilder';
import { CustomResumeIndex } from '@/components/custom-resume/v2/CustomResumeIndex';
import { CustomResumeResults } from '@/components/custom-resume/v2/CustomResumeResults';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useReports } from '@/hooks/useReports';
import { useReferralStatus } from '@/hooks/useReferralStatus';
import { useReportSections } from '@/hooks/useReportSections';
import { useGenerateCustomResume } from '@/components/custom-resume/hooks/useGenerateCustomResume';
import type { CareerSelection, TemplateId } from '@/components/custom-resume/types';

const CustomResume = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { reports, isLoading: reportsLoading } = useReports();
  const referralStatus = useReferralStatus();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const idsParam = searchParams.get('ids');
  const customResumeIds = useMemo(
    () => (idsParam ? idsParam.split(',').filter(Boolean) : []),
    [idsParam],
  );

  // Builder state.
  // Template is fixed to the ATS-safe default at generation time — switching
  // templates only re-renders the PDF and doesn't affect the AI output, so we
  // surface that choice on the Results screen instead of forcing it up-front.
  const [selected, setSelected] = useState<CareerSelection[]>([]);
  const [templateId] = useState<TemplateId>('ats-classic');
  const [includeCoverLetter, setIncludeCoverLetter] = useState(true);

  const generate = useGenerateCustomResume();
  const latestReport = reports?.length ? reports[0] : null;
  const { sections, isLoading: sectionsLoading } = useReportSections(latestReport?.id);

  const firstName = profile?.first_name || '';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const isLoading =
    authLoading ||
    profileLoading ||
    reportsLoading ||
    referralStatus.isLoading ||
    (latestReport && sectionsLoading);

  if (isLoading) {
    return (
      <ApproachBackground>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Loader2 size={28} className="animate-spin" color="#fff" />
        </div>
      </ApproachBackground>
    );
  }

  if (!latestReport || latestReport.status !== 'completed') {
    navigate('/dashboard', { replace: true });
    return null;
  }

  // Referral gate
  const resumeFeature = referralStatus.features.find((f) => f.key === 'resume');
  if (resumeFeature && !resumeFeature.unlocked) {
    return (
      <PageShell firstName={firstName}>
        <LockedScreen requiredReferrals={resumeFeature.requiredReferrals} />
      </PageShell>
    );
  }

  // Cover letter is a separate tier in the referral ladder. The wizard
  // checkbox stays disabled until that tier is unlocked.
  const coverLetterFeature = referralStatus.features.find((f) => f.key === 'cover-letter');
  const coverLetterUnlocked = coverLetterFeature?.unlocked ?? false;
  const referralsToCoverLetter = Math.max(
    0,
    (coverLetterFeature?.requiredReferrals ?? 3) - referralStatus.referralCount,
  );

  // Résumé prerequisite
  if (!profile?.resume_uploaded_at) {
    return (
      <PageShell firstName={firstName}>
        <NoResumeScreen onUpload={() => navigate('/profile')} />
      </PageShell>
    );
  }

  const startNew = () => {
    setSelected([]);
    setSearchParams({}, { replace: true });
  };

  return (
    <PageShell firstName={firstName}>
      {customResumeIds.length > 0 ? (
        <CustomResumeResults customResumeIds={customResumeIds} onStartNew={startNew} />
      ) : (
        <>
          {/* Past résumés appear above the builder so a returning user sees
              both "make new" and "view existing" without having to remember
              the ?ids= URL. Empty/no-data state is handled inside the index
              component — it renders nothing if the user has no saved rows. */}
          <CustomResumeIndex
            onView={(id) => setSearchParams({ ids: id }, { replace: false })}
          />
          <CustomResumeBuilder
          sections={sections}
          selected={selected}
          onSelectedChange={setSelected}
          includeCoverLetter={includeCoverLetter}
          onCoverLetterChange={setIncludeCoverLetter}
          coverLetterUnlocked={coverLetterUnlocked}
          referralsToCoverLetter={referralsToCoverLetter}
          isGenerating={generate.isPending}
          onGenerate={async () => {
            try {
              const result = await generate.mutateAsync({
                reportId: latestReport.id,
                selectedCareers: selected,
                templateId,
                // Belt-and-suspenders: ignore the checkbox state if the user
                // hasn't unlocked the cover-letter tier (the UI disables it
                // already, but never trust client state).
                includeCoverLetter: coverLetterUnlocked && includeCoverLetter,
              });
              setSearchParams({ ids: result.custom_resume_ids.join(',') }, { replace: false });
            } catch {
              // Toast already shown by the hook.
            }
          }}
        />
        </>
      )}
    </PageShell>
  );
};

// ── Shared page shell ─────────────────────────────────────────
const PageShell: React.FC<{ firstName: string; children: React.ReactNode }> = ({ firstName, children }) => {
  const navigate = useNavigate();
  return (
    <ApproachBackground>
      <DashboardAppNav
        firstName={firstName}
        pageLabel="Tailor Your Résumé"
        onProfile={() => navigate('/profile')}
        onSignOut={() => navigate('/auth')}
        onBack={() => navigate('/dashboard')}
        backLabel="Back to dashboard"
      />
      {children}
    </ApproachBackground>
  );
};

// ── Locked screen ─────────────────────────────────────────────
const LockedScreen: React.FC<{ requiredReferrals: number }> = ({ requiredReferrals }) => (
  <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
    <Lock size={48} color={PALETTE.goldBright} style={{ margin: '0 auto 16px' }} />
    <REyebrow>
      STEP 2 · {requiredReferrals} FRIEND{requiredReferrals === 1 ? '' : 'S'} TO UNLOCK
    </REyebrow>
    <h1
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 900,
        fontSize: 48,
        letterSpacing: '-0.03em',
        color: '#fff',
        margin: '14px 0 14px 0',
        lineHeight: 1.0,
      }}
    >
      Help {requiredReferrals} friend{requiredReferrals === 1 ? '' : 's'} find their path,
      <br />
      unlock yours.
    </h1>
    <p
      style={{
        fontFamily: FONT_BODY,
        fontSize: 16,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.78)',
        lineHeight: 1.55,
        margin: '0 auto 36px',
        maxWidth: 580,
      }}
    >
      Invite {requiredReferrals} friend{requiredReferrals === 1 ? '' : 's'} to take their
      assessment and we'll unlock tailored résumés for your top careers.
    </p>
  </div>
);

// ── No résumé on file screen ──────────────────────────────────
const NoResumeScreen: React.FC<{ onUpload: () => void }> = ({ onUpload }) => (
  <div style={{ maxWidth: 720, margin: '0 auto', padding: '80px 32px' }}>
    <div
      style={{
        ...glassCardStyle(false, false),
        padding: '40px 32px',
        textAlign: 'center',
        cursor: 'default',
      }}
    >
      <Upload size={44} color={PALETTE.goldBright} style={{ margin: '0 auto 14px' }} />
      <REyebrow>UPLOAD REQUIRED</REyebrow>
      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 900,
          fontSize: 32,
          letterSpacing: '-0.025em',
          color: '#fff',
          margin: '12px 0 10px 0',
          lineHeight: 1.1,
        }}
      >
        Upload your résumé first.
      </h1>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: 15,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.72)',
          lineHeight: 1.5,
          margin: '0 auto 24px',
          maxWidth: 480,
        }}
      >
        We need your current résumé as the base for tailoring. Upload it once and we'll re-use it
        for every career you pick.
      </p>
      <button
        type="button"
        onClick={onUpload}
        style={{
          background: PALETTE.gold,
          color: PALETTE.canvasDeep,
          border: 'none',
          padding: '14px 22px',
          borderRadius: 9999,
          fontFamily: FONT_BODY,
          fontWeight: 800,
          fontSize: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          boxShadow: '0 14px 32px -10px rgba(212,160,36,0.55)',
        }}
      >
        <Upload size={14} /> Upload résumé in Profile
      </button>
    </div>
  </div>
);

export default CustomResume;
