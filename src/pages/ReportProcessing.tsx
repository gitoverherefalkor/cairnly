import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import CairnProgress from '@/components/survey/CairnProgress';

// Stepper stages — timed to feel like real progress through the n8n pipeline
// (WF1 personality → WF2 research → WF3 scoring → WF4 career narratives).
const STEPS = [
  { label: 'Reading your responses', delay: 0 },
  { label: 'Building your personality profile', delay: 10 },
  { label: 'Researching career paths', delay: 60 },
  { label: 'Scoring your career matches', delay: 150 },
  { label: 'Preparing your AI career coach', delay: 240 },
];

// Timeout thresholds (seconds)
const SOFT_WARNING_AT = 5 * 60;   // 5 minutes — the normal pipeline finishes around here
const END_STATE_AT = 8 * 60;      // 8 minutes — genuine "something's wrong" threshold
const POLL_INTERVAL = 15_000;     // 15 seconds

type Phase = 'normal' | 'soft-warning' | 'end-state' | 'redirecting' | 'failed';

const ReportProcessing = () => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>('normal');
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
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
      title: "Your coach is ready!",
      description: "Connecting you now...",
    });
    setTimeout(() => navigate('/chat'), 1500);
  }, [navigate, toast]);

  const checkReportStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data: reports, error } = await supabase
        .from('reports')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['processing', 'completed', 'pending_review', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!reports || reports.length === 0) return; // report row not created yet — keep waiting

      const report = reports[0];

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
  }, [timeElapsed, phase]);

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
                onDashboard={goToDashboard}
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
  onDashboard,
}: {
  timeElapsed: number;
  phase: Phase;
  onDashboard: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Completed cairn — the payoff for finishing all seven sections. Full
          stack + gold capstone; the crown pops as the profile builds. */}
      <CairnProgress filled={5} crowned animate="crown" width={150} className="mx-auto" />

      {/* Header */}
      <div className="text-center space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-atlas-gold">
          All seven sections done
        </p>
        <h1 className="text-xl font-bold text-atlas-navy">
          Building Your Profile
        </h1>
        <p className="text-sm text-gray-500">
          {phase === 'soft-warning'
            ? 'Almost there, just finishing up.'
            : 'This usually takes about 5 minutes.'}
        </p>
      </div>

      {/* Stepper */}
      <div className="space-y-0">
        {STEPS.map((step, i) => {
          const isVisible = timeElapsed >= step.delay;
          const nextStep = STEPS[i + 1];
          const isComplete = nextStep ? timeElapsed >= nextStep.delay : phase === 'soft-warning';
          const isActive = isVisible && !isComplete;

          if (!isVisible) return null;

          return (
            <div
              key={step.label}
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
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar — subtle, fills over ~3 min */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-atlas-teal/60 rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${Math.min(100, phase === 'soft-warning' ? 100 : (timeElapsed / SOFT_WARNING_AT) * 100)}%`,
          }}
        />
      </div>

      {/* Leave-page reassurance + dashboard, kept inside the card */}
      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-start gap-2.5">
          <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-500">
            You can safely leave this page. We'll email you when your coach is ready.
          </p>
        </div>
        <Button variant="outline" onClick={onDashboard} className="w-full">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

// ─── Redirecting state ───────────────────────────────────────────────
function RedirectingState() {
  return (
    <div className="text-center space-y-4 py-4">
      <CheckCircle2 className="h-12 w-12 text-atlas-teal mx-auto" />
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-atlas-navy">Your coach is ready!</h2>
        <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
          Connecting you now <ArrowRight className="h-3.5 w-3.5" />
        </p>
      </div>
    </div>
  );
}

// ─── End state (5+ min) ──────────────────────────────────────────────
function EndState({ onDashboard }: { onDashboard: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-atlas-navy">
            Taking longer than expected
          </h2>
          <p className="text-sm text-gray-600">
            Our support team has been notified and will follow up shortly.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
        <p className="text-sm text-blue-800 font-medium">
          Your data is safe — nothing has been lost.
        </p>
        <p className="text-xs text-blue-600 mt-1">
          We'll email you as soon as your career coach is ready.
        </p>
      </div>

      <Button
        onClick={onDashboard}
        className="w-full bg-atlas-teal hover:bg-atlas-teal/90 text-white"
      >
        Go to Dashboard
      </Button>
    </div>
  );
}

// ─── Failed state ───────────────────────────────────────────────────
function FailedState({ onDashboard }: { onDashboard: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-atlas-navy">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-600">
            We hit a snag generating your report. Our team has been notified.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
        <p className="text-sm text-blue-800 font-medium">
          Your survey data is safe — nothing has been lost.
        </p>
        <p className="text-xs text-blue-600 mt-1">
          We'll email you as soon as your report is ready.
        </p>
      </div>

      <Button
        onClick={onDashboard}
        className="w-full bg-atlas-teal hover:bg-atlas-teal/90 text-white"
      >
        Go to Dashboard
      </Button>
    </div>
  );
}

export default ReportProcessing;
