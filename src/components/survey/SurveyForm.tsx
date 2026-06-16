import React, { useEffect, useCallback, useState, useRef } from 'react';
import { QuestionRenderer } from './QuestionRenderer';
import { SectionIntroduction } from './SectionIntroduction';
import { SurveyNavigation, MobileStepIndicator } from './SurveyNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Send, Loader2, CheckCircle, RefreshCw, Mountain, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSurveyState } from './hooks/useSurveyState';
import { useResumePreFill } from './hooks/useResumePreFill';
import { useSurveyNavigation } from './hooks/useSurveyNavigation';
import { useSurveySubmission } from './hooks/useSurveySubmission';
import { useEngagementTracking } from '@/hooks/useEngagementTracking';
import { useAssessmentSession } from '@/components/assessment/AssessmentSessionContext';
import { useToast } from '@/hooks/use-toast';
import { isQuestionAnswered } from './questionValidation';
import { computeSurveyProgress } from '@/lib/surveyProgress';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-center py-8 text-red-600">Something went wrong. Please refresh or contact support.</div>;
    }
    return this.props.children;
  }
}

// Milestone messages shown at key completion thresholds (fired once per session)
const MILESTONES: { pct: number; message: string; duration: number }[] = [
  {
    pct: 25,
    message: "The more honest your answers, the more useful your results will be. Keep going.",
    duration: 4000,
  },
  {
    pct: 50,
    message: "Good moment for a stretch or a cup of tea. Your progress is automatically saved — come back whenever you're ready.",
    duration: 6000,
  },
  {
    pct: 75,
    message: "This level of depth is exactly what makes the final report genuinely useful. Worth the time.",
    duration: 4000,
  },
  {
    pct: 90,
    message: "Final stretch — just a few more questions.",
    duration: 4000,
  },
];

interface SurveyFormProps {
  surveyId: string;
  onComplete: (responses: Record<string, any>) => void;
  accessCodeData?: any;
}

export const SurveyForm: React.FC<SurveyFormProps> = ({
  surveyId,
  onComplete,
  accessCodeData
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { triggerSave } = useAssessmentSession();

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC
  // Custom hooks for state management
  const surveyState = useSurveyState(surveyId, accessCodeData?.id);
  const {
    survey,
    isLoading,
    error,
    currentSectionIndex,
    currentQuestionIndex,
    responses,
    isSubmitting,
    submissionStatus,
    showSectionIntro,
    completedSections,
    isSessionLoaded,
    setCurrentSectionIndex,
    setCurrentQuestionIndex,
    setResponses,
    setIsSubmitting,
    setSubmissionStatus,
    setShowSectionIntro,
    setCompletedSections,
    shouldSkipQuestion,
    getFilteredQuestions,
    clearSession
  } = surveyState;

  // Milestone state
  const [activeMilestone, setActiveMilestone] = useState<string | null>(null);
  const firedMilestonesRef = useRef<Set<number>>(new Set());
  const milestoneInitRef = useRef(false);

  // "You can't continue yet" hint — shown when the user clicks Continue while
  // the current question still has missing required fields. We keep the button
  // clickable (instead of silently disabled) so we can explain why and scroll
  // them to the first red field.
  const [showIncompleteHint, setShowIncompleteHint] = useState(false);
  const questionCardRef = useRef<HTMLDivElement>(null);

  // Clear the "can't continue yet" hint whenever we move to a different question,
  // so it never carries over to a freshly shown (and possibly incomplete) one.
  useEffect(() => {
    setShowIncompleteHint(false);
  }, [currentSectionIndex, currentQuestionIndex, showSectionIntro]);

  // Engagement tracking for reminder emails
  const { trackSurveyStart, trackSurveyProgress, trackSurveyQuestionProgress, trackSurveyComplete } =
    useEngagementTracking();

  // Track survey start when first response appears
  const hasStartedRef = React.useRef(false);
  useEffect(() => {
    if (!hasStartedRef.current && isSessionLoaded && Object.keys(responses).length > 0) {
      hasStartedRef.current = true;
      trackSurveyStart();
    }
  }, [isSessionLoaded, responses, trackSurveyStart]);

  // Track section changes
  const prevSectionRef = React.useRef(currentSectionIndex);
  useEffect(() => {
    if (survey && currentSectionIndex !== prevSectionRef.current) {
      prevSectionRef.current = currentSectionIndex;
      trackSurveyProgress(currentSectionIndex, survey.sections?.length ?? 0);
    }
  }, [currentSectionIndex, survey, trackSurveyProgress]);

  // Persist question-level progress (debounced) so the reminder email reads the
  // SAME number the dashboard shows. Uses the shared validator-based helper, so
  // there's exactly one definition of "answered" / "section complete".
  useEffect(() => {
    if (!survey || !isSessionLoaded || Object.keys(responses).length === 0) return;
    const timeout = setTimeout(() => {
      const progress = computeSurveyProgress(survey, responses);
      if (progress) {
        trackSurveyQuestionProgress(progress as unknown as Record<string, number>);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [responses, survey, isSessionLoaded, trackSurveyQuestionProgress]);

  // Milestone effect: fire encouragement messages at key completion thresholds
  useEffect(() => {
    if (!survey || !isSessionLoaded) return;

    const totalQ = survey.sections.reduce((acc: number, s: any) =>
      acc + getFilteredQuestions(s).length, 0);
    const answered = Object.values(responses).filter(
      v => v !== null && v !== undefined && v !== ''
    ).length;
    const pct = totalQ > 0 ? (answered / totalQ) * 100 : 0;

    // On first load, silently pre-mark milestones that were already passed
    if (!milestoneInitRef.current) {
      milestoneInitRef.current = true;
      for (const m of MILESTONES) {
        if (pct >= m.pct) firedMilestonesRef.current.add(m.pct);
      }
      return;
    }

    // Check for newly crossed milestones
    let timerId: ReturnType<typeof setTimeout> | null = null;
    for (const m of MILESTONES) {
      if (pct >= m.pct && !firedMilestonesRef.current.has(m.pct)) {
        firedMilestonesRef.current.add(m.pct);
        setActiveMilestone(m.message);
        timerId = setTimeout(() => setActiveMilestone(null), m.duration);
        break; // Only one at a time
      }
    }
    return () => { if (timerId) clearTimeout(timerId); };
  }, [responses, survey, isSessionLoaded, getFilteredQuestions]);

  // IMPORTANT: Call ALL hooks unconditionally
  useResumePreFill({ isSessionLoaded, responses, setResponses, surveyId });

  const surveyNavigation = useSurveyNavigation({
    survey,
    currentSectionIndex,
    currentQuestionIndex,
    completedSections,
    setCurrentSectionIndex,
    setCurrentQuestionIndex,
    setShowSectionIntro,
    setCompletedSections,
    getFilteredQuestions,
  });
  const { handleNext: rawHandleNext, handleBack: rawHandleBack, handleSectionNavigation, navigationDirection } = surveyNavigation;

  // Wrap navigation handlers to flash the "auto-saved" indicator
  const handleNext = useCallback(() => {
    setActiveMilestone(null);
    triggerSave();
    rawHandleNext();
  }, [rawHandleNext, triggerSave]);

  const handleBack = useCallback(() => {
    setActiveMilestone(null);
    triggerSave();
    rawHandleBack();
  }, [rawHandleBack, triggerSave]);

  const surveySubmission = useSurveySubmission({
    surveyId,
    responses,
    accessCodeData,
    setIsSubmitting,
    setSubmissionStatus,
    onComplete
  });
  const { handleSubmit: rawHandleSubmit, handleRetrySubmission } = surveySubmission;

  const handleSubmit = useCallback(() => {
    // Completeness backstop: a question can end up unanswered if it was
    // cleared after being answered (the per-question Continue gate only
    // covers the question you are on). Catch any gap before submitting and
    // send the user straight to it.
    if (survey) {
      for (let s = 0; s < survey.sections.length; s++) {
        const qs = getFilteredQuestions(survey.sections[s]);
        for (let q = 0; q < qs.length; q++) {
          if (!isQuestionAnswered(qs[q], responses[qs[q].id])) {
            setCurrentSectionIndex(s);
            setCurrentQuestionIndex(q);
            setShowSectionIntro(false);
            toast({
              title: 'A question still needs an answer',
              description: "We've taken you back to it. Fill it in to submit.",
              variant: 'destructive',
            });
            return;
          }
        }
      }
    }
    triggerSave();
    return rawHandleSubmit();
  }, [survey, getFilteredQuestions, responses, setCurrentSectionIndex, setCurrentQuestionIndex, setShowSectionIntro, toast, rawHandleSubmit, triggerSave]);

  // Whether a question is satisfied — delegates to the shared validator so the
  // Continue gate, resume cursor and submit check all agree on "answered".
  const checkIfCurrentQuestionComplete = useCallback(
    (question: any) => isQuestionAnswered(question, responses[question?.id]),
    [responses]
  );

  const handleSectionIntroContinue = useCallback(() => {
    setActiveMilestone(null);
    triggerSave();
    setShowSectionIntro(false);
  }, [setShowSectionIntro, triggerSave]);

  // Keyboard event handler for Enter key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!survey) return;

    const isCmdOrCtrlEnter = event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;
    const isPlainEnter = event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (isPlainEnter || isCmdOrCtrlEnter) {
      // Plain Enter skips textarea (so users can add line breaks); Cmd/Ctrl+Enter works everywhere
      const target = event.target as HTMLElement;
      if (isPlainEnter && target.tagName === 'TEXTAREA') {
        return;
      }

      // Section intro screen: Enter / Cmd+Enter advances to the first question
      if (showSectionIntro) {
        event.preventDefault();
        handleSectionIntroContinue();
        return;
      }

      const filteredQuestions = getFilteredQuestions(survey.sections[currentSectionIndex]);
      const currentQuestion = filteredQuestions[currentQuestionIndex];
      const isCurrentQuestionComplete = checkIfCurrentQuestionComplete(currentQuestion);
      const isLastQuestion = currentSectionIndex === survey.sections.length - 1 &&
                           currentQuestionIndex === filteredQuestions.length - 1;

      // Only proceed if current question is complete
      if (isCurrentQuestionComplete) {
        event.preventDefault();

        if (isLastQuestion) {
          handleSubmit();
        } else {
          handleNext();
        }
      }
    }
  }, [survey, currentSectionIndex, currentQuestionIndex, responses, handleSubmit, handleNext, getFilteredQuestions, checkIfCurrentQuestionComplete, showSectionIntro, handleSectionIntroContinue]);

  const handleResponseChange = useCallback((questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  }, [setResponses]);

  const handleClearSession = useCallback(() => {
    clearSession();
    navigate('/dashboard');
  }, [clearSession, navigate]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // NOW we can do conditional returns, AFTER all hooks have been called

  // Loading states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load survey. Please try again.</p>
      </div>
    );
  }

  // Don't render anything until session is loaded
  if (!isSessionLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your progress...</span>
      </div>
    );
  }

  const currentSection = survey.sections[currentSectionIndex];
  const filteredQuestions = getFilteredQuestions(currentSection);
  const currentQuestion = filteredQuestions[currentQuestionIndex];

  // Calculate progress within current section only (shown in the sidebar)
  const currentQuestionInSection = currentQuestionIndex + 1;
  const totalQuestionsInSection = filteredQuestions.length;

  // Calculate global progress across all sections
  const totalQuestions = survey.sections.reduce((acc: number, s: any) =>
    acc + getFilteredQuestions(s).length, 0);
  const totalAnswered = Object.values(responses).filter(
    v => v !== null && v !== undefined && v !== ''
  ).length;
  const globalPct = totalQuestions > 0 ? Math.min(100, (totalAnswered / totalQuestions) * 100) : 0;

  const isCurrentQuestionComplete = () => {
    return checkIfCurrentQuestionComplete(currentQuestion);
  };

  const isLastQuestion = () => {
    return currentSectionIndex === survey.sections.length - 1 &&
           currentQuestionIndex === filteredQuestions.length - 1;
  };

  const isFirstQuestion = () => {
    return currentSectionIndex === 0 && currentQuestionIndex === 0 && !showSectionIntro;
  };

  // Continue/Submit click. If the question still has missing required fields,
  // show an inline hint and scroll the user to the first red field instead of
  // silently doing nothing (the old behaviour: a disabled button with no reason).
  const handleAdvance = () => {
    if (!isCurrentQuestionComplete()) {
      setShowIncompleteHint(true);
      // Wait a frame so the hint is in the DOM, then scroll to the first
      // highlighted-in-red field within the question card.
      requestAnimationFrame(() => {
        const firstInvalid = questionCardRef.current?.querySelector('.border-red-300');
        firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    setShowIncompleteHint(false);
    if (isLastQuestion()) {
      handleSubmit();
    } else {
      handleNext();
    }
  };

  // Global progress bar — rendered in all active survey states
  const GlobalProgressBar = (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-30 bg-gray-100">
      <div
        className="h-full bg-atlas-teal transition-all duration-500 ease-out"
        style={{ width: `${globalPct}%` }}
      />
    </div>
  );

  // Milestone message banner — mobile only (desktop shows it in the sidebar,
  // replacing the autosave block). Mustard pill with a white mountain icon.
  const MilestoneBanner = activeMilestone ? (
    <div className="md:hidden fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-4 w-full max-w-md">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-2.5 bg-atlas-gold rounded-full px-5 py-3 shadow-lg">
        <Mountain className="h-4 w-4 text-white flex-shrink-0" />
        <span className="text-sm font-medium text-white">{activeMilestone}</span>
      </div>
    </div>
  ) : null;

  // Subtle Cairnly brand mark. Rendered in-flow under the "Your Progress"
  // sidebar (see the sidebar column below) rather than as a fixed overlay —
  // the old fixed bottom-left anchor overlapped the question card once a card
  // grew tall enough to scroll behind it.
  const SurveyLogoMark = (
    <img
      src="/cairnly-logo-white.png"
      alt="Cairnly"
      className="w-[150px] h-auto opacity-70 pl-1"
    />
  );

  // Show section introduction for all sections (including first)
  if (showSectionIntro) {
    // Unlock the current section as soon as its intro is shown
    if (!completedSections.includes(currentSectionIndex)) {
      setCompletedSections(prev => prev.includes(currentSectionIndex) ? prev : [...prev, currentSectionIndex]);
    }
    const sectionDescription = currentSection.description || "Let's continue with the next set of questions.";
    return (
      <div className="min-h-screen pt-10 pb-6 sm:pt-20 sm:pb-12">
        {GlobalProgressBar}
        <MobileStepIndicator
          sections={survey.sections}
          currentSectionIndex={currentSectionIndex}
          completedSections={completedSections}
          onSectionClick={handleSectionNavigation}
        />
        <div className="flex flex-row-reverse gap-6 max-w-7xl mx-auto px-3 sm:px-6">
          <div className="hidden md:flex flex-col gap-5 w-80 flex-shrink-0">
            <SurveyNavigation
              sections={survey.sections}
              currentSectionIndex={currentSectionIndex}
              completedSections={completedSections}
              onSectionClick={handleSectionNavigation}
              currentQuestionInSection={currentQuestionInSection}
              totalQuestionsInSection={totalQuestionsInSection}
              activeMilestone={activeMilestone}
            />
            {SurveyLogoMark}
          </div>
          <div className="flex-1">
            <SectionIntroduction
              sectionNumber={currentSectionIndex + 1}
              sectionTitle={currentSection.title}
              description={sectionDescription}
              onContinue={handleSectionIntroContinue}
              completedCount={currentSectionIndex}
              justCompletedTitle={currentSectionIndex > 0 ? (survey.sections[currentSectionIndex - 1]?.title ?? null) : null}
            />
          </div>
        </div>
      </div>
    );
  }

  // If no questions available after filtering, show error
  if (!currentQuestion) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">No questions available in this section.</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen pt-10 pb-6 sm:pt-20 sm:pb-12">
      {GlobalProgressBar}
      {MilestoneBanner}

      {/* Mobile step indicator */}
      <MobileStepIndicator
        sections={survey.sections}
        currentSectionIndex={currentSectionIndex}
        completedSections={completedSections}
        onSectionClick={handleSectionNavigation}
      />

      <div className="flex flex-row-reverse gap-6 max-w-7xl mx-auto px-3 sm:px-6">
        <div className="hidden md:flex flex-col gap-5 w-80 flex-shrink-0">
          <SurveyNavigation
            sections={survey.sections}
            currentSectionIndex={currentSectionIndex}
            completedSections={completedSections}
            onSectionClick={handleSectionNavigation}
            currentQuestionInSection={currentQuestionInSection}
            totalQuestionsInSection={totalQuestionsInSection}
          />
          {SurveyLogoMark}
        </div>

        <div className="flex-1 max-w-4xl">
          {/* Submission Status Banner */}
          {submissionStatus === 'submitted' && (
            <Card className="mb-6 border-green-200 bg-green-50">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-green-800 font-medium text-sm sm:text-base">Assessment Submitted Successfully!</p>
                    <p className="text-green-700 text-xs sm:text-sm">Your responses are saved. Taking you to the next step...</p>
                  </div>
                  <Button
                    onClick={handleClearSession}
                    variant="outline"
                    size="sm"
                    className="border-green-300 text-green-700 hover:bg-green-100 w-full sm:w-auto"
                  >
                    Continue to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {submissionStatus === 'failed' && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-red-800 font-medium text-sm sm:text-base">Submission Failed</p>
                    <p className="text-red-700 text-xs sm:text-sm">Don't worry - your answers are saved! You can try submitting again.</p>
                  </div>
                  <Button
                    onClick={handleRetrySubmission}
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-100 w-full sm:w-auto"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      'Retry Submission'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Question — keyed wrapper triggers slide animation on question change */}
          <div
            key={currentQuestion.id}
            className={`animate-in fade-in-0 duration-500 ease-out ${
              navigationDirection === 'forward'
                ? 'slide-in-from-right-16'
                : 'slide-in-from-left-16'
            }`}
          >
            <div
              className="relative overflow-hidden rounded-[22px] border bg-white shadow-[0_30px_60px_-24px_rgba(0,0,0,0.45)]"
              style={{
                background: '#FDFBF2',
                borderColor: 'rgba(201, 182, 144, 0.6)',
              }}
            >
              {/* Soft gold radial bloom top-right */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  top: -60,
                  right: -60,
                  width: 280,
                  height: 280,
                  background:
                    'radial-gradient(circle, rgba(212,160,36,0.18) 0%, rgba(212,160,36,0) 70%)',
                }}
              />
              <div className="relative space-y-6 pt-5 sm:pt-7 px-4 sm:px-8 pb-5 sm:pb-7">
                {/* Gold editorial eyebrow */}
                <div
                  className="font-heading uppercase text-[11px]"
                  style={{
                    color: '#C8891A',
                    letterSpacing: '0.24em',
                    fontWeight: 700,
                  }}
                >
                  Section {currentSectionIndex + 1} · Question {currentQuestionInSection} of {totalQuestionsInSection}
                </div>
                <div ref={questionCardRef} className="text-base sm:text-lg font-light text-gray-900">
                  <QuestionRenderer
                    question={currentQuestion}
                    value={responses[currentQuestion.id]}
                    onChange={(value) => handleResponseChange(currentQuestion.id, value)}
                    allResponses={responses}
                  />
                </div>

                {/* "Can't continue yet" hint — only while the question is still incomplete */}
                {showIncompleteHint && !isCurrentQuestionComplete() && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Please complete all required fields before continuing. Any missing fields are outlined in red.</span>
                  </div>
                )}

                {/* Navigation — bottom of the question card */}
                <div
                  className="flex justify-between items-center pt-4"
                  style={{ borderTop: '1px solid rgba(201,182,144,0.5)' }}
                >
                  <Button
                    variant="ghost"
                    onClick={handleBack}
                    disabled={isFirstQuestion() || submissionStatus === 'submitted'}
                    className={`px-0 hover:bg-transparent ${isFirstQuestion() ? "text-muted-foreground" : "text-atlas-teal hover:text-atlas-teal"}`}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleAdvance}
                    disabled={
                      submissionStatus === 'submitted' ||
                      isLoading ||
                      isSubmitting
                    }
                    className="bg-atlas-teal text-white hover:bg-atlas-teal/90 rounded-full px-5"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : isLastQuestion() ? (
                      <>
                        Submit
                        <Send className="h-4 w-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};
