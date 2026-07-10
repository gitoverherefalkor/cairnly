import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useReports } from '@/hooks/useReports';
import { useReportSections, type ReportSection } from '@/hooks/useReportSections';
import { useEngagementTracking } from '@/hooks/useEngagementTracking';
import { useReferralStatus } from '@/hooks/useReferralStatus';
import { useSurvey } from '@/hooks/useSurvey';
import { computeSurveyProgress } from '@/lib/surveyProgress';
import { AccessCodeModal } from '@/components/dashboard/AccessCodeModal';
import { ExecSummaryModal } from '@/components/dashboard/ExecSummaryModal';
import { DashboardV4 } from '@/components/dashboard/v2/DashboardV4';
import { DashboardEntryState, type EntryMode, type EntryFlavor } from '@/components/dashboard/v2/DashboardEntryState';
import {
  STARTER_SURVEY_ID,
  STARTER_SURVEY_TYPE,
  ENCORE_SURVEY_ID,
  ENCORE_SURVEY_TYPE,
} from '@/components/assessment/constants';
import { ShareCardModal } from '@/components/dashboard/v2/ShareCardModal';
import {
  pickShareSentences,
  stripHtml,
} from '@/components/dashboard/v2/dashboardV2Shared';
import { extractAIImpact, type AIImpactLevel } from '@/components/chat/CareerScoreCard';
import { type MoveLevel } from '@/lib/moveScale';

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
// Total question count across all sections (DB: SUM of questions per section).
// Powers the finer-grained % on the dashboard's resume progress bar.
// Update when sections/questions change in Supabase.
const TOTAL_SURVEY_QUESTIONS = 60;

// How long to show the "generating your executive summary" state before
// giving up (WF7 normally finishes in well under a minute). After this the
// banner switches to a "taking longer than usual" message and polling stops.
const EXEC_SUMMARY_WAIT_CAP_MS = 3 * 60 * 1000;

const Dashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { reports, isLoading: reportsLoading } = useReports();
  const queryClient = useQueryClient();
  const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
  const [showExecSummaryModal, setShowExecSummaryModal] = useState(false);
  // Async executive-summary tracking. WF7 writes the exec_summary section a
  // few seconds AFTER wrap-up (i.e. after this dashboard has already loaded),
  // so we poll for it and surface a "generating" state instead of a silent
  // gap. `execWaitTimedOut` stops the poll after a cap; `sawExecPending`
  // records that we were ever waiting, so a late arrival shows a gentle
  // "ready — open" affordance rather than hijacking with an auto-modal.
  const [execWaitTimedOut, setExecWaitTimedOut] = useState(false);
  const [sawExecPending, setSawExecPending] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [userAccessCode, setUserAccessCode] = useState<string | null>(null);
  // survey_type of the verified access code — drives flavor-aware entry copy
  // (the starter flavor gets its own section list, timing, and preview cards).
  const [entrySurveyType, setEntrySurveyType] = useState<string | null>(null);
  // True when this user has a 'draft' row in the answers table — i.e., they've
  // started the survey on a different device (or after clearing localStorage)
  // but haven't submitted yet.
  const [hasDraftAnswers, setHasDraftAnswers] = useState(false);
  // Draft answer payload + its survey id, recovered from the DB in the effect
  // below. Used to compute exact resume progress (questions answered, sections
  // complete) that matches what the live survey considers done — covers the
  // fresh-device case where there's no localStorage session to read.
  const [draftPayload, setDraftPayload] = useState<Record<string, any> | null>(null);
  const [draftSurveyId, setDraftSurveyId] = useState<string | null>(null);
  // 'failed' dashboard state: re-running report generation from saved answers.
  const [isRetrying, setIsRetrying] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // If user explicitly navigated here (e.g. from chat), don't auto-redirect back.
  const cameFromChat = location.state?.fromChat === true;
  // Set by ReportProcessing's "Go to Dashboard" buttons. Without this, a user
  // who clicks that button while status is still 'processing' gets bounced
  // straight back to /report-processing by needsProcessingRedirect below —
  // the click looks like it does nothing.
  const cameFromProcessing = location.state?.fromProcessing === true;

  const savedSession = getAssessmentSession();

  // latestReport computed early so hooks can use it (hooks can't be conditional).
  const latestReport = !reports || reports.length === 0 ? null : reports[0];
  const reportCompleted = latestReport?.status === 'completed';

  // Poll for the exec summary while the report is complete but the summary
  // hasn't landed yet. The hook self-stops once it appears; we also stop once
  // we've timed out so a stuck/errored WF7 doesn't poll indefinitely.
  const { sections: reportSections } = useReportSections(latestReport?.id, {
    pollForExecSummary: reportCompleted && !execWaitTimedOut,
  });
  const execSummarySection = reportSections.find(
    (s) => s.section_type === 'exec_summary' || s.section_type === 'executive_summary'
  );

  // Still waiting on the async exec summary (report done, summary not written).
  const execSummaryPending = reportCompleted && !execSummarySection && !execWaitTimedOut;
  // Landed after we'd been waiting → show a "ready — open" affordance.
  const execSummaryJustArrived = sawExecPending && !!execSummarySection;
  // Drives the dashboard banner + the accordion placeholder row.
  const execSummaryStatus: 'pending' | 'arrived' | 'timedout' | null =
    execSummaryJustArrived
      ? 'arrived'
      : execSummaryPending
        ? 'pending'
        : reportCompleted && !execSummarySection && execWaitTimedOut
          ? 'timedout'
          : null;

  // Cap the wait so a stuck WF7 doesn't leave the "generating" state up forever.
  useEffect(() => {
    if (!reportCompleted || execSummarySection) return; // nothing to wait for
    const t = setTimeout(() => setExecWaitTimedOut(true), EXEC_SUMMARY_WAIT_CAP_MS);
    return () => clearTimeout(t);
  }, [reportCompleted, execSummarySection]);

  // Remember we were pending so a late arrival doesn't auto-pop the modal.
  useEffect(() => {
    if (execSummaryPending) setSawExecPending(true);
  }, [execSummaryPending]);

  // Referral / virality status — invite code, count, feature unlocks.
  const referralStatus = useReferralStatus();

  // Load the draft's survey structure (no-op until the effect resolves the id)
  // and compute exact progress from the recovered payload. Falls back to null
  // until both are available, so the render can use a coarse estimate meanwhile.
  const { data: draftSurvey } = useSurvey(draftSurveyId ?? '');
  const dbProgress = useMemo(
    () => computeSurveyProgress(draftSurvey, draftPayload),
    [draftSurvey, draftPayload]
  );

  // Track dashboard visit for users who have completed chat.
  const { trackDashboardVisit } = useEngagementTracking();
  useEffect(() => {
    if (latestReport && latestReport.status === 'completed') {
      trackDashboardVisit();
    }
  }, [latestReport?.id]);

  // Show exec summary modal on first visit after report completion — but only
  // when the summary was already present on load. If it arrived while the user
  // was already on the dashboard (sawExecPending), don't hijack their view;
  // the "ready — open" banner button drives the modal instead.
  useEffect(() => {
    if (!latestReport || latestReport.status !== 'completed' || !execSummarySection) return;
    if (sawExecPending) return;
    const dismissKey = `exec_summary_dismissed_${latestReport.id}`;
    if (!localStorage.getItem(dismissKey)) {
      setShowExecSummaryModal(true);
    }
  }, [latestReport, execSummarySection, sawExecPending]);

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
        setEntrySurveyType(verifiedCode.survey_type ?? null);

        // Does this code have an in-progress (draft) survey? Pull the payload +
        // survey id too, so we can compute exact resume progress for the
        // dashboard even on a fresh device with no localStorage session.
        const { data: answersRow } = await supabase
          .from('answers')
          .select('status, payload, survey_id')
          .eq('access_code_id', verifiedCode.id)
          .maybeSingle();
        const hasDraft = answersRow?.status === 'draft';

        if (hasDraft) {
          setHasDraftAnswers(true);
          if (answersRow?.payload && typeof answersRow.payload === 'object') {
            setDraftPayload(answersRow.payload as Record<string, any>);
          }
          if (answersRow?.survey_id) setDraftSurveyId(answersRow.survey_id);
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
    !authLoading && !reportsLoading && latestReport?.status === 'processing' && !cameFromProcessing;
  const needsChatRedirect =
    !authLoading && !reportsLoading && latestReport?.status === 'pending_review' && !cameFromChat;
  // Re-edit flow: when a user's survey has been re-opened for editing (their
  // answers.status flipped back to 'draft'), send them into the assessment to
  // revise their answers, even when an old completed report already exists
  // (which otherwise renders the dashboard and hides any "continue" path).
  // Fires once per browser session so exiting the survey doesn't trap them in
  // a redirect loop; it self-clears once they resubmit (status → 'submitted').
  // While a draft survey is open for re-editing, keep sending the user into the
  // assessment. No once-per-session guard (that survived hard refreshes and made
  // the redirect stop firing); this self-clears the moment they resubmit
  // (status → 'submitted' → hasDraftAnswers false).
  const needsResurveyRedirect = !authLoading && !reportsLoading && hasDraftAnswers;

  useEffect(() => {
    if (needsAuthRedirect) {
      navigate('/auth', { replace: true });
    } else if (needsProcessingRedirect) {
      navigate('/report-processing', { replace: true });
    } else if (needsChatRedirect) {
      navigate('/chat', { replace: true });
    } else if (needsResurveyRedirect) {
      navigate('/assessment', { replace: true });
    }
  }, [needsAuthRedirect, needsProcessingRedirect, needsChatRedirect, needsResurveyRedirect, navigate]);

  // Share-card data — two share types, each with its own pickable items.
  //   personalityShares: one entry per personality section the user has
  //     (strengths/values/approach/development/exec-summary), with 3-4
  //     candidate sentences pulled from the body.
  //   roleShares: one entry per shareable career (top 1/2/3 + outside-box),
  //     with sentences pulled from the "Why this role fits you" subsection
  //     (or "Why this might be a fit" for outside-box).
  const personalityShares = useMemo(() => {
    const order: { types: string[]; fallbackTitle: string }[] = [
      { types: ['strengths'], fallbackTitle: 'Core strengths' },
      { types: ['values'], fallbackTitle: 'Core values' },
      { types: ['approach', 'personality_team'], fallbackTitle: 'Approach' },
      { types: ['development'], fallbackTitle: 'Development' },
      { types: ['exec_summary', 'executive_summary'], fallbackTitle: 'Executive summary' },
    ];
    return order
      .map(({ types, fallbackTitle }) => {
        const s = reportSections.find((x) => types.includes(x.section_type));
        if (!s) return null;
        const title = stripHtml(s.title || '') || fallbackTitle;
        const quotes = pickShareSentences(s.content || '', title, 4);
        if (quotes.length === 0) return null;
        // First <h5> subsection header, shown under the section title on the card.
        const subMatch = (s.content || '').match(/<h5[^>]*>([\s\S]*?)<\/h5>/i);
        const subheader = subMatch ? stripHtml(subMatch[1]).trim() || null : null;
        return { sectionType: s.section_type, title, subheader, quotes };
      })
      .filter(Boolean) as { sectionType: string; title: string; subheader: string | null; quotes: string[] }[];
  }, [reportSections]);

  // Role shares — Top 1/2/3 + every outside-the-box career. Quotes come from
  // the cached `share_quotes` jsonb column on report_sections, which is
  // populated on-demand by the generate-share-quotes edge function. The
  // modal kicks off generation if any role's quotes are null.
  const roleShares = useMemo(() => {
    type Role = {
      sectionId: string;
      sectionType: string;
      title: string;
      matchPct: number | null;
      aiImpact: AIImpactLevel | null;
      move: MoveLevel | null;
      quotes: string[] | null;
      isOutsideBox: boolean;
    };
    const out: Role[] = [];
    const cleanTitle = (raw: string | null | undefined) =>
      stripHtml(raw || '').replace(/^\d+[.)]\s*/, '').trim();

    for (const type of ['top_career_1', 'top_career_2', 'top_career_3']) {
      const s = reportSections.find((x) => x.section_type === type);
      if (!s) continue;
      const title = cleanTitle(s.title) || 'Best-fit career';
      const matchPct = s.score != null ? Math.round(Number(s.score)) || 0 : null;
      out.push({
        sectionId: s.id,
        sectionType: type,
        title,
        matchPct,
        aiImpact: extractAIImpact(s.content || ''),
        move: (s.metadata?.move as MoveLevel | undefined) ?? null,
        quotes: Array.isArray(s.share_quotes) ? s.share_quotes : null,
        isOutsideBox: false,
      });
    }

    const outsideBox = reportSections.filter((x) => x.section_type === 'outside_box');
    for (const s of outsideBox) {
      const title = cleanTitle(s.title) || 'Outside-the-box career';
      out.push({
        sectionId: s.id,
        sectionType: 'outside_box',
        title,
        matchPct: null,
        aiImpact: extractAIImpact(s.content || ''),
        move: (s.metadata?.move as MoveLevel | undefined) ?? null,
        quotes: Array.isArray(s.share_quotes) ? s.share_quotes : null,
        isOutsideBox: true,
      });
    }
    return out;
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
    return (
      <>
        <DashboardV4
          firstName={firstName}
          country={profile?.country ?? null}
          reportId={latestReport.id}
          reportGeneratedAt={latestReport.updated_at ?? latestReport.created_at ?? null}
          sections={reportSections}
          execSummaryStatus={execSummaryStatus}
          onOpenExecSummary={() => setShowExecSummaryModal(true)}
          referralCode={referralStatus.referralCode}
          referralCount={referralStatus.referralCount}
          features={referralStatus.features}
          ladder={referralStatus.ladder}
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
            reportId={latestReport.id}
            personalityShares={personalityShares}
            roleShares={roleShares}
            onQuotesGenerated={(updates) => {
              // After the edge function returns, merge cached quotes into the
              // react-query cache for report-sections so the next render
              // (and any future modal opens) get them without a refetch.
              queryClient.setQueryData(
                ['report-sections', latestReport.id],
                (old: ReportSection[] | undefined) => {
                  if (!old) return old;
                  return old.map((s) =>
                    updates[s.id] ? { ...s, share_quotes: updates[s.id] } : s,
                  );
                },
              );
            }}
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
  // Flavor for the entry screen, resolved from (in order): the verified access
  // code's survey_type, a recovered draft's survey id, or the saved local
  // session. Unknown/absent means pro.
  const sessionSurveyType = savedSession?.accessCodeData?.survey_type ?? null;
  const entryFlavor: EntryFlavor =
    entrySurveyType === STARTER_SURVEY_TYPE ||
    draftSurveyId === STARTER_SURVEY_ID ||
    sessionSurveyType === STARTER_SURVEY_TYPE
      ? 'starter'
      : entrySurveyType === ENCORE_SURVEY_TYPE ||
          draftSurveyId === ENCORE_SURVEY_ID ||
          sessionSurveyType === ENCORE_SURVEY_TYPE
        ? 'encore'
        : 'pro';

  let mode: EntryMode = 'empty';
  if (latestReport?.status === 'pending_review' && cameFromChat) {
    mode = 'chat';
  } else if (latestReport?.status === 'processing' && cameFromProcessing) {
    mode = 'processing';
  } else if (latestReport?.status === 'failed') {
    mode = 'failed';
  } else if (!latestReport && hasMeaningfulProgress()) {
    mode = 'resume';
  }

  const resumeProgress =
    mode === 'resume'
      ? // Prefer the exact DB-payload computation (matches the live survey).
        // Until the survey structure loads, fall back to the coarse estimate
        // derived from whatever localStorage session we have.
        dbProgress ?? {
          sectionsComplete: Math.min(savedSession?.currentSectionIndex ?? 0, TOTAL_SURVEY_SECTIONS),
          totalSections: TOTAL_SURVEY_SECTIONS,
          questionsAnswered: Math.min(
            Object.keys(savedSession?.responses ?? {}).length,
            TOTAL_SURVEY_QUESTIONS
          ),
          totalQuestions: TOTAL_SURVEY_QUESTIONS,
        }
      : undefined;

  const handleStart = () => {
    if (mode === 'chat') {
      navigate('/chat');
    } else if (mode === 'processing') {
      navigate('/report-processing');
    } else if (mode === 'resume') {
      navigate('/assessment');
    } else if (userAccessCode) {
      setShowAccessCodeModal(true);
    } else {
      navigate('/assessment');
    }
  };

  // 'failed' mode retry: ask forward-to-n8n to re-run generation on the SAME
  // report row (it flips status back to 'processing'), then hand off to the
  // processing screen. No survey re-do — the saved answers are reused server-side.
  const handleRetryReport = async () => {
    if (!latestReport || isRetrying) return;
    setIsRetrying(true);
    try {
      const { error } = await supabase.functions.invoke('forward-to-n8n', {
        body: { retry_report_id: latestReport.id },
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['reports', user?.id] });
      navigate('/report-processing');
    } catch (err) {
      console.error('Error retrying report generation:', err);
      setIsRetrying(false);
      toast({
        title: 'Still having trouble',
        description: "We couldn't restart your report just now. Please try again in a moment.",
        variant: 'destructive',
      });
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
        onRetry={handleRetryReport}
        isRetrying={isRetrying}
        flavor={entryFlavor}
      />

      {showAccessCodeModal && userAccessCode && (
        <AccessCodeModal accessCode={userAccessCode} onClose={() => setShowAccessCodeModal(false)} />
      )}
    </>
  );
};

export default Dashboard;
