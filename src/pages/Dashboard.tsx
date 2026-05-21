import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useReports } from '@/hooks/useReports';
import { useReportSections } from '@/hooks/useReportSections';
import { useEngagementTracking } from '@/hooks/useEngagementTracking';
import { useReferralStatus } from '@/hooks/useReferralStatus';
import { AccessCodeModal } from '@/components/dashboard/AccessCodeModal';
import { ExecSummaryModal } from '@/components/dashboard/ExecSummaryModal';
import { DashboardV4 } from '@/components/dashboard/v2/DashboardV4';
import { DashboardEntryState, type EntryMode } from '@/components/dashboard/v2/DashboardEntryState';
import { ShareCardModal } from '@/components/dashboard/v2/ShareCardModal';
import { firstSentences } from '@/components/dashboard/v2/dashboardV2Shared';

// Helper to get assessment session from localStorage.
// Live survey progress is written by useSurveyState/useSurveySession under
// `survey_session_<surveyId>_<accessCodeId>`. The legacy `assessment_session`
// key is only touched pre-survey (AccessCodeModal, AssessmentSessionContext)
// and never advances, so reading it alone leaves the dashboard frozen at
// "Section 1 of 6 in progress". Pick the most-advanced survey_session_* and
// fall back to the legacy key for pre-survey states.
const getAssessmentSession = () => {
  try {
    let best: any = null;
    let bestScore = -1;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('survey_session_')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const score =
          (parsed?.currentSectionIndex ?? 0) * 1000 +
          (parsed?.currentQuestionIndex ?? 0);
        if (score > bestScore) {
          bestScore = score;
          best = parsed;
        }
      } catch {
        // ignore unparseable entries
      }
    }
    if (best) return best;
    const legacy = localStorage.getItem('assessment_session');
    return legacy ? JSON.parse(legacy) : null;
  } catch {
    return null;
  }
};

// Survey section count — matches the assessment-section strip in the entry
// state, which mirrors the survey_sections table in Supabase.
const TOTAL_SURVEY_SECTIONS = 7;

const Dashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { reports, isLoading: reportsLoading } = useReports();
  const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
  const [showExecSummaryModal, setShowExecSummaryModal] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [userAccessCode, setUserAccessCode] = useState<string | null>(null);
  // True when this user has a 'draft' row in the answers table — i.e., they've
  // started the survey on a different device (or after clearing localStorage)
  // but haven't submitted yet.
  const [hasDraftAnswers, setHasDraftAnswers] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // If user explicitly navigated here (e.g. from chat), don't auto-redirect back.
  const cameFromChat = location.state?.fromChat === true;

  const savedSession = getAssessmentSession();

  // latestReport computed early so hooks can use it (hooks can't be conditional).
  const latestReport = !reports || reports.length === 0 ? null : reports[0];

  const { sections: reportSections } = useReportSections(latestReport?.id);
  const execSummarySection = reportSections.find(
    (s) => s.section_type === 'exec_summary' || s.section_type === 'executive_summary'
  );

  // Referral / virality status — invite code, count, feature unlocks.
  const referralStatus = useReferralStatus();

  // Track dashboard visit for users who have completed chat.
  const { trackDashboardVisit } = useEngagementTracking();
  useEffect(() => {
    if (latestReport && latestReport.status === 'completed') {
      trackDashboardVisit();
    }
  }, [latestReport?.id]);

  // Show exec summary modal on first visit after report completion.
  useEffect(() => {
    if (!latestReport || latestReport.status !== 'completed' || !execSummarySection) return;
    const dismissKey = `exec_summary_dismissed_${latestReport.id}`;
    if (!localStorage.getItem(dismissKey)) {
      setShowExecSummaryModal(true);
    }
  }, [latestReport, execSummarySection]);

  const handleDismissExecSummary = () => {
    setShowExecSummaryModal(false);
    if (latestReport) {
      localStorage.setItem(`exec_summary_dismissed_${latestReport.id}`, 'true');
    }
  };

  const handleExploreReport = () => {
    // Just close the modal — the dashboard behind it already shows the full
    // report. Previously navigated to /report, which yanked the user away
    // from the populated dashboard they expect to land on.
    handleDismissExecSummary();
  };

  // Resolve the user's access code and recover any in-progress assessment.
  // Code sources, in order: user_metadata (email signup) → purchase_data in
  // localStorage (payment flow) → get-my-access-code (DB lookup by user id).
  useEffect(() => {
    if (!(user && !authLoading && !profileLoading && !reportsLoading)) return;

    const hasReport = reports && reports.length > 0;
    const hasLocalSession =
      savedSession?.isVerified ||
      savedSession?.accessCodeData ||
      (savedSession?.responses && Object.keys(savedSession.responses).length > 0);

    (async () => {
      try {
        let verifiedCode: any = null;

        let codeString: string | null = user.user_metadata?.access_code || null;
        if (!codeString) {
          try {
            const purchaseData = localStorage.getItem('purchase_data');
            if (purchaseData) codeString = JSON.parse(purchaseData).accessCode || null;
          } catch {
            // Ignore parse errors
          }
        }

        if (codeString) {
          const { data: verifyData } = await supabase.functions.invoke('verify-access-code', {
            body: { code: codeString },
          });
          if (verifyData?.valid) verifiedCode = verifyData.accessCode;
        } else {
          // No code on this device — recover it from the database by user id.
          const { data: lookupData } = await supabase.functions.invoke('get-my-access-code');
          if (lookupData?.found) verifiedCode = lookupData.accessCode;
        }

        if (!verifiedCode?.id) return; // genuinely no access code yet

        setUserAccessCode(verifiedCode.code);

        // Does this code have an in-progress (draft) survey?
        const { data: answersRow } = await supabase
          .from('answers')
          .select('status')
          .eq('access_code_id', verifiedCode.id)
          .maybeSingle();
        const hasDraft = answersRow?.status === 'draft';

        if (hasDraft) {
          setHasDraftAnswers(true);
          if (!hasLocalSession) {
            const session = {
              isVerified: true,
              accessCodeData: verifiedCode,
              sessionToken: verifiedCode.id,
              currentSectionIndex: 0,
              currentQuestionIndex: 0,
              responses: {},
            };
            localStorage.setItem('assessment_session', JSON.stringify(session));
          }
          setShowAccessCodeModal(false);
        } else if (!hasLocalSession && !hasReport) {
          setShowAccessCodeModal(true);
        }
      } catch (err) {
        console.warn('[Dashboard] assessment recovery failed:', err);
      }
    })();

    // Update profile with country from localStorage if available (from payment form).
    const paymentCountry = localStorage.getItem('payment_country');
    if (paymentCountry && profile && !profile.country) {
      supabase
        .from('profiles')
        .update({ country: paymentCountry })
        .eq('id', user.id)
        .then(
          () => {
            localStorage.removeItem('payment_country');
          },
          (error) => {
            console.error('Error updating profile with country:', error);
          }
        );
    }
  }, [user, authLoading, profileLoading, reportsLoading, reports, profile]);

  const handleSignOut = async () => {
    try {
      // Local-scope signout — global logout has been 403-ing on this project.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        toast({ title: 'Error', description: 'Failed to sign out. Please try again.', variant: 'destructive' });
      } else {
        toast({ title: 'Signed out', description: "You've been signed out successfully." });
        navigate('/');
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Meaningful assessment progress — server-side draft row wins regardless of
  // local state (covers the fresh-device / cleared-cache case).
  const hasMeaningfulProgress = () => {
    if (hasDraftAnswers) return true;
    if (!savedSession) return false;
    const beyondFirstQuestion =
      savedSession.currentSectionIndex > 0 || savedSession.currentQuestionIndex > 0;
    const hasResponses = savedSession.responses && Object.keys(savedSession.responses).length > 0;
    const hasVerified = savedSession.isVerified || savedSession.accessCodeData;
    return beyondFirstQuestion || hasResponses || hasVerified;
  };

  // Redirects must happen in useEffect, not during render.
  const needsAuthRedirect = !authLoading && !user;
  const needsProcessingRedirect =
    !authLoading && !reportsLoading && latestReport?.status === 'processing';
  const needsChatRedirect =
    !authLoading && !reportsLoading && latestReport?.status === 'pending_review' && !cameFromChat;

  useEffect(() => {
    if (needsAuthRedirect) {
      navigate('/auth', { replace: true });
    } else if (needsProcessingRedirect) {
      navigate('/report-processing', { replace: true });
    } else if (needsChatRedirect) {
      navigate('/chat', { replace: true });
    }
  }, [needsAuthRedirect, needsProcessingRedirect, needsChatRedirect, navigate]);

  // Candidate quotes for the share card — pulled from real report sections.
  const shareQuotes = useMemo(() => {
    const order = ['strengths', 'values', 'exec_summary', 'executive_summary', 'approach'];
    const seen = new Set<string>();
    const quotes: string[] = [];
    for (const type of order) {
      const s = reportSections.find((x) => x.section_type === type);
      if (!s) continue;
      const q = firstSentences(s.content || '', 1);
      if (q && q.length > 12 && q.length < 220 && !seen.has(q)) {
        seen.add(q);
        quotes.push(q);
      }
    }
    return quotes;
  }, [reportSections]);

  // Copy the personal invite link to the clipboard.
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

  // Loading spinner while data loads OR a redirect is about to happen.
  if (
    authLoading ||
    profileLoading ||
    reportsLoading ||
    needsAuthRedirect ||
    needsProcessingRedirect ||
    needsChatRedirect
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const firstName = profile?.first_name || '';

  // ── Completed report → V4 dashboard ──────────────────────────
  if (latestReport && latestReport.status === 'completed') {
    const heroSection = reportSections.find((s) => s.section_type === 'top_career_1');
    const heroTitle = heroSection?.title?.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim() || 'Your best-fit career';
    const heroShape = heroSection?.company_size_type
      ? heroSection.company_size_type.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim()
      : null;
    const heroPct = heroSection?.score != null ? Math.round(Number(heroSection.score)) || 0 : 0;

    return (
      <>
        <DashboardV4
          firstName={firstName}
          country={profile?.country ?? null}
          reportGeneratedAt={latestReport.updated_at ?? latestReport.created_at ?? null}
          sections={reportSections}
          referralCode={referralStatus.referralCode}
          referralCount={referralStatus.referralCount}
          features={referralStatus.features}
          onNavigate={(route) => navigate(route)}
          onProfile={() => navigate('/profile')}
          onSignOut={handleSignOut}
          onInvite={handleInvite}
          onOpenShareCard={() => setShowShareCard(true)}
        />

        {showShareCard && (
          <ShareCardModal
            open={showShareCard}
            onClose={() => setShowShareCard(false)}
            firstName={firstName}
            heroTitle={heroTitle}
            heroShape={heroShape}
            heroMatchPct={heroPct}
            quotes={shareQuotes}
          />
        )}

        {showExecSummaryModal && execSummarySection && (
          <ExecSummaryModal
            content={execSummarySection.content}
            onClose={handleDismissExecSummary}
            onViewReport={handleExploreReport}
          />
        )}
      </>
    );
  }

  // ── Pre-report states (empty / resume / chat) ────────────────
  let mode: EntryMode = 'empty';
  if (latestReport?.status === 'pending_review' && cameFromChat) {
    mode = 'chat';
  } else if (!latestReport && hasMeaningfulProgress()) {
    mode = 'resume';
  }

  const resumeProgress =
    mode === 'resume'
      ? {
          sectionsComplete: Math.min(savedSession?.currentSectionIndex ?? 0, TOTAL_SURVEY_SECTIONS),
          totalSections: TOTAL_SURVEY_SECTIONS,
        }
      : undefined;

  const handleStart = () => {
    if (mode === 'chat') {
      navigate('/chat');
    } else if (mode === 'resume') {
      navigate('/assessment');
    } else if (userAccessCode) {
      setShowAccessCodeModal(true);
    } else {
      navigate('/assessment');
    }
  };

  return (
    <>
      <DashboardEntryState
        mode={mode}
        firstName={firstName}
        onStart={handleStart}
        onProfile={() => navigate('/profile')}
        onSignOut={handleSignOut}
        resumeProgress={resumeProgress}
      />

      {showAccessCodeModal && userAccessCode && (
        <AccessCodeModal accessCode={userAccessCode} onClose={() => setShowAccessCodeModal(false)} />
      )}
    </>
  );
};

export default Dashboard;
