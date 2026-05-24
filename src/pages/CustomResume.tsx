// Custom Résumé page — entry point for the WF_custom_resume flow.
//
// State machine (single page, query-param driven):
//   1. Wizard step 1 (career picker) → step 2 (template + cover letter)
//   2. On Generate → kicks off edge function, stores returned IDs in
//      ?ids=… and switches to results view.
//   3. Reloading with ?ids=… in the URL goes straight to results view,
//      letting users come back to a generation in progress.
//
// Gates (in order):
//   - Auth → if signed out, the protected routes already bounce; we still
//     render a loader until useAuth resolves.
//   - Completed report → no completed report = no careers to tailor for;
//     bounce to /dashboard.
//   - Referral tier 2 → 'resume' feature must be unlocked; otherwise show
//     a small locked screen.
//   - Résumé on file → if not, show an upload CTA before letting them in.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, ArrowLeft, Upload, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useReports } from '@/hooks/useReports';
import { useReferralStatus } from '@/hooks/useReferralStatus';
import { CareerPickerStep } from '@/components/custom-resume/steps/CareerPickerStep';
import { TemplateAndOptionsStep } from '@/components/custom-resume/steps/TemplateAndOptionsStep';
import { ResultsView } from '@/components/custom-resume/ResultsView';
import { useGenerateCustomResume } from '@/components/custom-resume/hooks/useGenerateCustomResume';
import type { CareerSelection, TemplateId } from '@/components/custom-resume/types';

type WizardStep = 'careers' | 'template';

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

  // Wizard state
  const [step, setStep] = useState<WizardStep>('careers');
  const [selected, setSelected] = useState<CareerSelection[]>([]);
  const [templateId, setTemplateId] = useState<TemplateId>('ats-classic');
  const [includeCoverLetter, setIncludeCoverLetter] = useState(true);

  const generate = useGenerateCustomResume();
  const latestReport = reports?.length ? reports[0] : null;

  // Reset wizard state if user navigates back via "Generate more"
  const startNew = () => {
    setSelected([]);
    setStep('careers');
    setSearchParams({}, { replace: true });
  };

  // Loading state
  const isLoading = authLoading || profileLoading || reportsLoading || referralStatus.isLoading;

  // Bounce to auth if signed out (parent layout should also handle this,
  // but be defensive — this page makes no sense without a user).
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-atlas-teal" />
      </div>
    );
  }

  if (!latestReport || latestReport.status !== 'completed') {
    // Without a completed report there are no careers to tailor for.
    navigate('/dashboard', { replace: true });
    return null;
  }

  // Referral gate: 'resume' feature must be unlocked
  const resumeFeature = referralStatus.features.find((f) => f.key === 'resume');
  if (resumeFeature && !resumeFeature.unlocked) {
    return <LockedScreen requiredReferrals={resumeFeature.requiredReferrals} />;
  }

  // Résumé prerequisite
  if (!profile?.resume_uploaded_at) {
    return <NoResumeOnFile onUpload={() => navigate('/profile')} />;
  }

  // If we have generated IDs, show the results view.
  if (customResumeIds.length > 0) {
    return (
      <Layout>
        <ResultsView customResumeIds={customResumeIds} onStartNew={startNew} />
      </Layout>
    );
  }

  // Wizard
  return (
    <Layout>
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
        </button>
        <span className="opacity-50">/</span>
        <span>Tailored résumé</span>
      </div>

      {step === 'careers' ? (
        <CareerPickerStep
          reportId={latestReport.id}
          selected={selected}
          onChange={setSelected}
          onNext={() => setStep('template')}
        />
      ) : (
        <TemplateAndOptionsStep
          templateId={templateId}
          onTemplateChange={setTemplateId}
          includeCoverLetter={includeCoverLetter}
          onCoverLetterChange={setIncludeCoverLetter}
          onBack={() => setStep('careers')}
          isGenerating={generate.isPending}
          careersCount={selected.length}
          onGenerate={async () => {
            try {
              const result = await generate.mutateAsync({
                reportId: latestReport.id,
                selectedCareers: selected,
                templateId,
                includeCoverLetter,
              });
              setSearchParams({ ids: result.custom_resume_ids.join(',') }, { replace: false });
            } catch {
              // Toast already shown by the hook.
            }
          }}
        />
      )}
    </Layout>
  );
};

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">{children}</div>
    </div>
  );
}

function LockedScreen({ requiredReferrals }: { requiredReferrals: number }) {
  const navigate = useNavigate();
  return (
    <Layout>
      <Card className="border-atlas-gold/40">
        <CardContent className="space-y-4 p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-atlas-gold" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Tailor your résumé — unlock with {requiredReferrals} invites
          </h1>
          <p className="text-muted-foreground">
            Invite {requiredReferrals} friend{requiredReferrals === 1 ? '' : 's'} to take their
            assessment and you'll unlock tailored résumés for your top careers.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}

function NoResumeOnFile({ onUpload }: { onUpload: () => void }) {
  return (
    <Layout>
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-atlas-orange" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Upload your résumé first
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            We need your current résumé as the base for tailoring. Upload it once and we'll re-use
            it for every career you pick.
          </p>
          <Button onClick={onUpload} className="bg-atlas-teal hover:bg-atlas-teal/90">
            <Upload className="mr-2 h-4 w-4" /> Upload résumé in Profile
          </Button>
        </CardContent>
      </Card>
    </Layout>
  );
}

export default CustomResume;
