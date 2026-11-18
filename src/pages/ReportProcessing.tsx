import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import CairnProgress from '@/components/survey/CairnProgress';
import { isEncoreSurveyId } from '@/components/assessment/constants';

// Stepper stages through the n8n pipeline (WF1 personality → WF2 research →
// WF3 scoring). STEPS stays at module level (useTranslation cannot run there)
// and carries a stable id plus a labelKey instead of an English label. The id
// is what the React key uses: keying on the label would change it on a
// language switch, remounting every row and replaying the fade-in animation.
const STEPS = [
  { id: 'reading', labelKey: 'reportProcessing.steps.reading' },
  { id: 'personality', labelKey: 'reportProcessing.steps.personality' },
  { id: 'research', labelKey: 'reportProcessing.steps.research' },
  { id: 'scoring', labelKey: 'reportProcessing.steps.scoring' },
  { id: 'coach', labelKey: 'reportProcessing.steps.coach' },
];

// Which step is "current", driven by the one real signal the page can see:
// WF1 done (report status → pending_review). Before that we're in steps 0-1;
// after it, WF2 (~4 min) then WF3 run, timed from the moment WF1 finished.
// WF3 finishing redirects to the chat, so the last step never shows a
// checkmark — the page never claims "done" while workflows are still running.
// WF2 takes ~4 min, WF3 ~4.5 min (Pro, measured 2026-11-18).
const SINCE_WF1 = { scoring: 4 * 60, coach: 7 * 60 }; // seconds after WF1 done

function currentStepIndex(timeElapsed: number, wf1DoneAt: number | null): number {
  if (wf1DoneAt === null) return timeElapsed < 10 ? 0 : 1;
  const since = timeElapsed - wf1DoneAt;
  if (since >= SINCE_WF1.coach) return 4;
  if (since >= SINCE_WF1.scoring) return 3;
  return 2;
}

// Progress bar: follows real progress instead of a fixed timer.
// - While WF1 runs, the bar can't pass 30%.
// - Once WF1 is done it jumps to at least 30%, then creeps toward (never
//   reaching) 95% — it slows down as it goes, so it is never "full" while WF3
//   is still running. It only hits 100% on the redirect to the chat.
// `expected` is the typical total run time; at that point the bar sits ~80%.
function progressPercent(timeElapsed: number, wf1DoneAt: number | null, expected: number): number {
  const curve = 95 * (1 - Math.exp(-timeElapsed / (expected / 2)));
  if (wf1DoneAt === null) return Math.min(curve, 30);
  return Math.max(curve, 30);
}

// Timeout thresholds (seconds). Pro/Starter: WF1 ~2 min + WF2 ~4 min + WF3
// ~4.5 min ≈ 10.5 min to the redirect (measured 2026-11-18; the old 5/8 min
// thresholds showed "support notified" while WF3 was still running normally).
// Encore's WF3P (scoring + outside-the-box) lands 8-10 minutes after submit
// (round 6, 2026-11-13), so the Pro thresholds showed "support notified"
// while the coach was about to open. Encore gets its own, later thresholds.
const THRESHOLDS = {
  pro: { soft: 11 * 60, end: 16 * 60 },
  encore: { soft: 9 * 60, end: 16 * 60 },
};
const POLL_INTERVAL = 15_000;     // 15 seconds

type Phase = 'normal' | 'soft-warning' | 'end-state' | 'redirecting' | 'failed';

const ReportProcessing = () => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>('normal');
  const [isEncore, setIsEncore] = useState(false);
  // Seconds-on-page at which we first saw WF1 finish (status pending_review).
  const [wf1DoneAt, setWf1DoneAt] = useState<number | null>(null);
  const timeElapsedRef = useRef(0);
  timeElapsedRef.current = timeElapsed;
  const { soft: SOFT_WARNING_AT, end: END_STATE_AT } = isEncore ? THRESHOLDS.encore : THRESHOLDS.pro;
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation('survey');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectedRef = useRef(false);

  // Flags the navigation so Dashboard knows this is a deliberate "I'll check
  // back later" exit, not a stray page load — otherwise Dashboard's own
  // needsProcessingRedirect bounces the user straight back here (the bug
  // reported as "Go to Dashboard does nothing").
  const goToDashboard = useCallback(() => {
    navigate('/dashboard', { state: { fromProcessing: true } });
  }, [navigate]);

  const redirectToChat = useCallback(() => {
    if (redirectedRef.current) return; // guard against the poll firing again mid-redirect
    redirectedRef.current = true;
    setPhase('redirecting');
    toast({
      title: t('reportProcessing.redirecting.title'),
      description: t('reportProcessing.redirecting.toastBody'),
    });
    setTimeout(() => navigate('/chat'), 1500);
  }, [navigate, toast, t]);

  const checkReportStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data: reports, error } = await supabase
        .from('reports')
        .select('id, status, payload')
        .eq('user_id', user.id)
        .in('status', ['processing', 'completed', 'pending_review', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!reports || reports.length === 0) return; // report row not created yet — keep waiting

      const report = reports[0];
      const surveyId = (report.payload as { survey_id?: string } | null)?.survey_id;
      if (isEncoreSurveyId(surveyId)) setIsEncore(true);

      if (report.status === 'failed') {
        setPhase('failed');
        return;
      }

      // A completed report means the user already finished a session — send them
      // straight back in, no need to make them wait.
      if (report.status === 'completed') {
        redirectToChat();
        return;
      }

      // status === 'pending_review' means WF1 finished (personality sections written),
      // but WF2 → WF3 → WF4 are still running. We hold the user here until WF3 is done
      // so the career chapter is ready by the time they reach it. WF3's last DB write is
      // the 'outside_box' section row, so its existence is our "WF3 done" signal — WF4
      // then finishes in the background while the user reads the personality chapter.
      if (report.status === 'pending_review') {
        setWf1DoneAt(prev => prev ?? timeElapsedRef.current);
        const { data: oobRows, error: oobError } = await supabase
          .from('report_sections')
          .select('id')
          .eq('report_id', report.id)
          .eq('section_type', 'outside_box')
          .limit(1);

        if (oobError) throw oobError;

        const wf3Done = Array.isArray(oobRows) && oobRows.length > 0;
        if (wf3Done) redirectToChat();
        // else: WF3 not done yet — the next poll will check again
      }
    } catch (error) {
      console.error('Error checking report status:', error);
    }
  }, [user, redirectToChat]);

  // Polling + timer
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    checkReportStatus();
    pollRef.current = setInterval(checkReportStatus, POLL_INTERVAL);
    timerRef.current = setInterval(() => setTimeElapsed(prev => prev + 1), 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [authLoading, user, checkReportStatus]);

  // Phase transitions based on elapsed time
  useEffect(() => {
    if (phase === 'redirecting') return;
    if (timeElapsed >= END_STATE_AT) setPhase('end-state');
    else if (timeElapsed >= SOFT_WARNING_AT) setPhase('soft-warning');
  }, [timeElapsed, phase, SOFT_WARNING_AT, END_STATE_AT]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-atlas-blue" />
      </div>
    );
  }

  return (
    <div className="min-h-screen survey-bg bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="shadow-lg border-0">
          <CardContent className="pt-8 pb-6 px-6">
            {phase === 'failed' ? (
              <FailedState onDashboard={goToDashboard} />
            ) : phase === 'redirecting' ? (
              <RedirectingState />
            ) : phase === 'end-state' ? (
              <EndState onDashboard={goToDashboard} />
            ) : (
              <NormalState
                timeElapsed={timeElapsed}
                phase={phase}
                wf1DoneAt={wf1DoneAt}
                expectedDuration={SOFT_WARNING_AT}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ─── Normal + soft-warning state ─────────────────────────────────────
function NormalState({
  timeElapsed,
  phase,
  wf1DoneAt,
  expectedDuration,
}: {
  timeElapsed: number;
  phase: Phase;
  wf1DoneAt: number | null;
  expectedDuration: number;
}) {
  const { t } = useTranslation('survey');
  const current = currentStepIndex(timeElapsed, wf1DoneAt);
  return (
    <div className="space-y-6">
      {/* Completed cairn — the payoff for finishing all seven sections. Full
          stack + gold capstone; the crown pops as the profile builds. */}
      <CairnProgress filled={5} crowned animate="crown" width={150} className="mx-auto" />

      {/* Header */}
      <div className="text-center space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-atlas-gold">
          {t('reportProcessing.header.eyebrow')}
        </p>
        <h1 className="text-xl font-bold text-atlas-navy">
          {t('reportProcessing.header.title')}
        </h1>
        <p className="text-sm text-gray-500">
          {phase === 'soft-warning'
            ? t('reportProcessing.header.subtitleSoftWarning')
            // Both tiers now take ~10 min, so both use the already-approved
            // "about 10 minutes" line (subtitleEncore). The old "about 5 minutes"
            // key (header.subtitle) is unused for now.
            : t('reportProcessing.header.subtitleEncore')}
        </p>
      </div>

      {/* Stepper */}
      <div className="space-y-0">
        {STEPS.map((step, i) => {
          const isVisible = i <= current;
          const isComplete = i < current;
          const isActive = i === current;

          if (!isVisible) return null;

          return (
            <div
              key={step.id}
              className="flex items-start gap-3 py-3 animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-atlas-teal" />
                ) : (
                  <div className="h-5 w-5 flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-atlas-teal animate-pulse" />
                  </div>
                )}
              </div>
              {/* Label */}
              <span className={`text-sm ${isActive ? 'text-atlas-navy font-medium' : 'text-gray-500'}`}>
                {t(step.labelKey)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar — follows real progress, never full until the redirect */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-atlas-teal/60 rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${progressPercent(timeElapsed, wf1DoneAt, expectedDuration)}%`,
          }}
        />
      </div>

      {/* Leave-page reassurance. No "Go to Dashboard" button here on purpose:
          it read as an end point, so users left instead of waiting for the
          coach. The button stays on the end/failed states, where leaving is
          the right move. */}
      <div className="border-t border-border pt-4">
        <div className="flex items-start gap-2.5">
          <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-500">
            {t('reportProcessing.leaveNote')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Redirecting state ───────────────────────────────────────────────
function RedirectingState() {
  const { t } = useTranslation('survey');
  return (
    <div className="text-center space-y-4 py-4">
      <CheckCircle2 className="h-12 w-12 text-atlas-teal mx-auto" />
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-atlas-navy">{t('reportProcessing.redirecting.title')}</h2>
        <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
          {t('reportProcessing.redirecting.body')} <ArrowRight className="h-3.5 w-3.5" />
        </p>
      </div>
    </div>
  );
}

// ─── End state (5+ min) ──────────────────────────────────────────────
function EndState({ onDashboard }: { onDashboard: () => void }) {
  const { t } = useTranslation('survey');
  return (
    <div className="space-y-5">
      <div className="text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-atlas-navy">
            {t('reportProcessing.endState.title')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('reportProcessing.endState.body')}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
        <p className="text-sm text-blue-800 font-medium">
          {t('reportProcessing.endState.safeTitle')}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          {t('reportProcessing.endState.safeBody')}
        </p>
      </div>

      <Button
        onClick={onDashboard}
        className="w-full bg-atlas-teal hover:bg-atlas-teal/90 text-white"
      >
        {t('reportProcessing.goToDashboard')}
      </Button>
    </div>
  );
}

// ─── Failed state ───────────────────────────────────────────────────
function FailedState({ onDashboard }: { onDashboard: () => void }) {
  const { t } = useTranslation('survey');
  return (
    <div className="space-y-5">
      <div className="text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-atlas-navy">
            {t('reportProcessing.failed.title')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('reportProcessing.failed.body')}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
        <p className="text-sm text-blue-800 font-medium">
          {t('reportProcessing.failed.safeTitle')}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          {t('reportProcessing.failed.safeBody')}
        </p>
      </div>

      <Button
        onClick={onDashboard}
        className="w-full bg-atlas-teal hover:bg-atlas-teal/90 text-white"
      >
        {t('reportProcessing.goToDashboard')}
      </Button>
    </div>
  );
}

export default ReportProcessing;
