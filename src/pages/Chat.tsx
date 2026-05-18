import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, MessageSquare, LayoutDashboard, RefreshCw } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { ClosingCard } from '@/components/chat/ClosingCard';
import { ReportSidebar, ALL_SECTIONS } from '@/components/chat/ReportSidebar';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { useReportSections } from '@/hooks/useReportSections';
import { TTSProvider } from '@/contexts/TTSContext';
import type { ChatMessagesHandle } from '@/components/chat/ChatMessages';
import { useEngagementTracking } from '@/hooks/useEngagementTracking';

type ReportData = Tables<'reports'>;

const Chat = () => {
  // Session management — same localStorage keys as n8n for backward compatibility.
  // Note: hasExistingSession used to drive the welcome-card decision, but a
  // sessionId can be present from a stale visit where the user never engaged.
  // For welcome-card logic we use a separate per-report engagement flag below.
  const hasExistingSession = localStorage.getItem('n8n-chat/sessionId') !== null;

  const getSessionTimestamp = () => {
    const timestamp = localStorage.getItem('n8n-chat/sessionTimestamp');
    return timestamp ? parseInt(timestamp) : null;
  };

  const isSessionStale = () => {
    const timestamp = getSessionTimestamp();
    if (!timestamp) return false;
    const hoursSinceLastActivity = (Date.now() - timestamp) / (1000 * 60 * 60);
    return hoursSinceLastActivity > 72;
  };

  const sessionIsStale = hasExistingSession && isSessionStale();

  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Career section data — used by the sidebar to surface the actual
  // career title + company size for the current top-career section.
  const { sections: reportSections } = useReportSections(reportData?.id);
  // Welcome card defaults to visible for everyone. An effect below flips it
  // off once we confirm the user has actually engaged with the chat for this
  // report (per `chat_engaged_${reportId}` flag set in handleWelcomeStart) or
  // when there's real chat history loaded from the server.
  const [showWelcome, setShowWelcome] = useState(true);
  const [showClosing, setShowClosing] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Initialize from localStorage to avoid 0/11 flash on session resume
  const [currentSectionIndex, setCurrentSectionIndex] = useState(() => {
    if (!reportData) return -1;
    const stored = localStorage.getItem(`chat_section_index_${reportData.id}`);
    return stored ? parseInt(stored, 10) : -1;
  });
  const [showSessionBanner, setShowSessionBanner] = useState(false);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  const [dreamJobsRead, setDreamJobsRead] = useState(false);
  const autoCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(
    localStorage.getItem('n8n-chat/sessionId')
  );
  const [autoResumeMessage, setAutoResumeMessage] = useState<string | undefined>(undefined);

  const chatMessagesRef = useRef<ChatMessagesHandle>(null);
  const { user, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trackChatStart, trackChatActivity, trackChatComplete } = useEngagementTracking();

  // Server-side progress fallback (for new device / stale session)
  const [serverSectionIndex, setServerSectionIndex] = useState<number | null>(null);

  // Load report on auth ready
  useEffect(() => {
    if (!authLoading) {
      loadUserReport();
    }
  }, [authLoading, user]);

  // Fetch server-side chat progress as fallback when localStorage is empty/stale
  useEffect(() => {
    if (!user?.id || (!showWelcome)) return;
    // Only fetch if we don't have valid localStorage progress
    if (hasExistingSession && !sessionIsStale) return;

    supabase
      .from('user_engagement_tracking' as any)
      .select('chat_last_section_index, chat_started_at')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.chat_started_at && data?.chat_last_section_index != null) {
          setServerSectionIndex(data.chat_last_section_index as number);
        }
      });
  }, [user?.id, showWelcome, hasExistingSession, sessionIsStale]);

  // Once reportData is available, dismiss the welcome card if the user
  // has either (a) explicitly clicked "I'm Ready!" before — tracked via
  // the per-report localStorage flag — or (b) has any chat_messages rows
  // in Supabase for this report. Either signal means "real engagement
  // already happened, no need for the welcome card."
  // Guards against stale sessionIds from drive-by visits suppressing
  // the welcome card on a real first chat session, while also handling
  // cross-device returns where localStorage is empty but server-side
  // chat history exists.
  useEffect(() => {
    if (!reportData) return;
    const engagedLocally = localStorage.getItem(`chat_engaged_${reportData.id}`) === '1';
    if (engagedLocally) {
      setShowWelcome(false);
      return;
    }
    // Server-side check
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('report_id', reportData.id)
      .then(({ count, error }) => {
        if (!error && count && count > 0) {
          localStorage.setItem(`chat_engaged_${reportData.id}`, '1');
          setShowWelcome(false);
        }
      });
  }, [reportData]);

  // Auto-restore session when returning with existing (non-stale) session.
  // Gated on the per-report engagement flag so a stale sessionId from a
  // drive-by visit doesn't trigger a "Hi, I'm back!" prompt for a user
  // who hasn't actually started chatting.
  useEffect(() => {
    if (!reportData || profileLoading || !profile) return;
    if (!hasExistingSession || sessionIsStale) return;
    if (!showWelcome) return; // Already past welcome
    // Real engagement check — only auto-resume if the user has actually
    // chatted before for this report.
    const engaged = localStorage.getItem(`chat_engaged_${reportData.id}`) === '1';
    if (!engaged) return;

    // Update session timestamp
    localStorage.setItem('n8n-chat/sessionTimestamp', Date.now().toString());

    // Restore section progress
    const storedIndex = localStorage.getItem(`chat_section_index_${reportData.id}`);
    if (storedIndex) {
      const index = parseInt(storedIndex, 10);
      if (!isNaN(index)) {
        setCurrentSectionIndex(index);
      }
    }

    // Show session restored banner
    setShowSessionBanner(true);
    setTimeout(() => setShowSessionBanner(false), 5000);

    // Set auto-resume in case Supabase messages are empty (migration gap)
    // ChatContainer will only send it if there are no loaded messages.
    setAutoResumeMessage("Hi, I'm back! Let's continue where we left off.");

    // Go straight to chat (skip welcome)
    setShowWelcome(false);
  }, [reportData, profileLoading]);

  // Subscribe to report status changes via Supabase Realtime
  useEffect(() => {
    if (!reportData?.id) return;
    if (isSessionCompleted) return;

    const isAtLastSection = currentSectionIndex >= ALL_SECTIONS.length - 1;
    if (!isAtLastSection) return;

    // One-time check
    const checkOnce = async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('status')
        .eq('id', reportData.id)
        .single();

      if (!error && data?.status === 'completed') {
        setIsSessionCompleted(true);
      }
    };
    checkOnce();

    // Realtime subscription
    const channel = supabase
      .channel(`report-status-${reportData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reports',
          filter: `id=eq.${reportData.id}`,
        },
        (payload) => {
          if ((payload.new as any).status === 'completed') {
            setIsSessionCompleted(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reportData?.id, currentSectionIndex, isSessionCompleted]);

  // Auto-complete session: 30 min after all dream jobs have been read AND backend is done.
  // Timer resets on any user message (handleSectionDetected is called per message).
  const AUTOCOMPLETE_DELAY = 30 * 60 * 1000; // 30 minutes

  const startAutoCompleteTimer = useCallback(() => {
    // Clear any existing timer
    if (autoCompleteTimerRef.current) {
      clearTimeout(autoCompleteTimerRef.current);
    }
    // Only start if dream jobs have been read
    if (!dreamJobsRead) return;

    autoCompleteTimerRef.current = setTimeout(() => {
      // When timer fires, check if backend is done too
      if (isSessionCompleted) {
        setShowClosing(true);
      } else {
        // Backend not done yet — re-check in 1 min
        autoCompleteTimerRef.current = setTimeout(() => {
          setShowClosing(true);
        }, 60 * 1000);
      }
    }, AUTOCOMPLETE_DELAY);
  }, [dreamJobsRead, isSessionCompleted]);

  // When dream jobs are read or session completes, start/restart the timer
  useEffect(() => {
    if (dreamJobsRead && isSessionCompleted && !showClosing) {
      startAutoCompleteTimer();
    }
    return () => {
      if (autoCompleteTimerRef.current) {
        clearTimeout(autoCompleteTimerRef.current);
      }
    };
  }, [dreamJobsRead, isSessionCompleted, showClosing, startAutoCompleteTimer]);

  const handleDreamJobsRead = useCallback(() => {
    setDreamJobsRead(true);
  }, []);

  // Reset auto-complete timer when user sends a message
  const handleUserActivity = useCallback(() => {
    if (dreamJobsRead && !showClosing) {
      startAutoCompleteTimer();
    }
  }, [dreamJobsRead, showClosing, startAutoCompleteTimer]);

  // Track chat completion for reminder system
  useEffect(() => {
    if (showClosing) {
      trackChatComplete();
    }
  }, [showClosing, trackChatComplete]);

  // Save section progress to localStorage
  useEffect(() => {
    if (reportData && currentSectionIndex >= 0) {
      localStorage.setItem(`chat_section_index_${reportData.id}`, currentSectionIndex.toString());
    }
  }, [currentSectionIndex, reportData]);

  // Called when the user clicks "I'm Ready!" inside the in-chat WelcomeCard.
  // Dismisses the welcome state AND fires a kickoff message so the bot
  // greets them right away, rather than waiting for a manual first message.
  const handleWelcomeStart = () => {
    if (profileLoading || !profile) {
      toast({
        title: "Loading...",
        description: "Please wait a moment while we load your profile.",
      });
      return;
    }
    // Record real engagement so future visits know the user has actually
    // started a chat (vs just landing on the page and bouncing). The
    // sessionId alone doesn't prove engagement because it gets minted
    // eagerly to allow ChatContainer to render.
    if (reportData) {
      localStorage.setItem(`chat_engaged_${reportData.id}`, '1');
    }
    setShowWelcome(false);
    setAutoResumeMessage("I'm ready, let's begin!");
    trackChatStart();
  };

  // Section click handler — uses ref to scroll within custom chat
  const handleSectionClick = (sectionId: string, _index: number) => {
    chatMessagesRef.current?.scrollToSection(sectionId);
  };

  // Handle section detected from bot messages — only goes forward
  const handleSectionDetected = (index: number) => {
    setCurrentSectionIndex((prev) => {
      const newIndex = Math.max(prev, index);
      // Track chat progress when section advances
      if (newIndex > prev) {
        trackChatActivity(newIndex);
      }
      return newIndex;
    });
  };

  // Determine returning user state — use localStorage first, server-side as fallback
  const localProgressIndex = reportData
    ? parseInt(localStorage.getItem(`chat_section_index_${reportData.id}`) || '-1', 10)
    : -1;
  const storedProgressIndex = localProgressIndex >= 0 ? localProgressIndex : (serverSectionIndex ?? -1);
  const isReturningUser = (!hasExistingSession || sessionIsStale) && storedProgressIndex >= 0;

  // Auto-initialize sessionId once profile is ready, so the chat layout
  // (sidebar + input) can mount immediately and the WelcomeCard renders
  // inside it as the empty state instead of replacing the whole page.
  // NOTE: This effect must come AFTER `isReturningUser` is declared above —
  // referencing it earlier puts a const in the temporal dead zone and
  // throws "Cannot access 'isReturningUser' before initialization".
  useEffect(() => {
    if (showClosing || sessionId) return;
    if (profileLoading || !profile) return;

    let sid = localStorage.getItem('n8n-chat/sessionId');
    const isNewSession = !sid || sessionIsStale;
    if (isNewSession) {
      sid = crypto.randomUUID();
      localStorage.setItem('n8n-chat/sessionId', sid);
    }
    localStorage.setItem('n8n-chat/sessionTimestamp', Date.now().toString());

    // For returning users with a stale session, auto-fire a resume prompt.
    // Gated on engagement flag so drive-by visits don't trigger the prompt.
    const engaged =
      reportData &&
      localStorage.getItem(`chat_engaged_${reportData.id}`) === '1';
    if (isNewSession && isReturningUser && engaged) {
      setAutoResumeMessage("Hi, I'm back! Let's continue where we left off.");
    }

    setSessionId(sid);
  }, [profileLoading, profile, sessionId, sessionIsStale, isReturningUser, showClosing]);

  const loadUserReport = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access your career coach.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    try {
      const { data: reports, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!reports || reports.length === 0) {
        toast({
          title: "No Report Available",
          description: "Complete your assessment first to access the career coach.",
          variant: "destructive",
        });
        navigate('/dashboard', { state: { fromChat: true } });
        return;
      }

      setReportData(reports[0]);
    } catch (error) {
      console.error('Error loading report:', error);
      toast({
        title: "Error",
        description: "Unable to load your report. Please try again.",
        variant: "destructive",
      });
      navigate('/dashboard', { state: { fromChat: true } });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading states
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-atlas-blue" />
          <p className="text-gray-600">Loading your career coach...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center p-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">No Report Available</h1>
            <p className="text-gray-600 mb-6">
              Complete your assessment to start chatting with your AI career coach.
            </p>
            <Button onClick={() => navigate('/dashboard', { state: { fromChat: true } })} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Visible section count excludes the hidden Executive Summary (canonical
  // index 0), matching the sidebar's "N / M" progress label.
  const visibleSectionCount = ALL_SECTIONS.length - 1;
  const chatProgressPct = Math.min(
    100,
    Math.max(0, (currentSectionIndex / visibleSectionCount) * 100)
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between items-center py-2.5">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center">
                <img src="/cairnly-logo.png" alt="Cairnly" className="h-12 w-auto" />
              </a>
              <span className="hidden sm:flex items-center gap-3 text-sm font-medium text-atlas-navy">
                <span className="h-4 w-px bg-gray-200" aria-hidden="true" />
                AI Coaching Session
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard', { state: { fromChat: true } })}
              className="hover:bg-atlas-blue/10 hover:text-atlas-navy hover:border-atlas-blue text-xs sm:text-sm"
            >
              <LayoutDashboard className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </div>
        </div>
        {/* Top progress bar — mirrors the assessment's global progress indicator */}
        <div className="h-[3px] bg-gray-100">
          <div
            className="h-full bg-atlas-teal transition-all duration-500 ease-out"
            style={{ width: `${chatProgressPct}%` }}
          />
        </div>
      </nav>

      {/* Content */}
      {showClosing ? (
        <div className="flex-1 bg-gray-50 overflow-auto flex items-center justify-center">
          <ClosingCard firstName={profile?.first_name || undefined} />
        </div>
      ) : (
        <div
          className="flex-1 flex relative bg-atlas-navy bg-cover bg-center"
          style={{ backgroundImage: "url('/images/trail_over_water.png')" }}
        >
          {/* Section-style dark overlay so chat content stays readable over the photo */}
          <div className="absolute inset-0 bg-black/40 pointer-events-none" aria-hidden="true" />
          {/* Chat Area */}
          <div className={`relative z-10 flex-1 flex flex-col transition-all ${isSidebarCollapsed ? 'md:mx-20' : 'md:mx-80'}`}>
            {/* Session Restored Banner */}
            {showSessionBanner && (
              <div className="bg-atlas-teal/10 border-b border-atlas-teal/20 px-4 py-2 flex items-center justify-center gap-2 text-sm text-atlas-navy">
                <RefreshCw className="h-4 w-4 text-atlas-teal" />
                <span>Session restored - your coach remembers the conversation</span>
                <button
                  onClick={() => setShowSessionBanner(false)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  x
                </button>
              </div>
            )}

            {/* Custom Chat — replaces n8n widget. WelcomeCard now lives
                inside the chat (as the empty state) so the input + sidebar
                are visible from the start; user can either click "I'm
                Ready!" or just type their first message. */}
            {sessionId && user ? (
              <TTSProvider>
              <ChatContainer
                ref={chatMessagesRef}
                reportId={reportData.id}
                userId={user.id}
                sessionId={sessionId}
                firstName={profile?.first_name || ''}
                country={profile?.country || ''}
                currentSectionIndex={currentSectionIndex}
                onSectionDetected={handleSectionDetected}
                onSessionComplete={() => setShowClosing(true)}
                onDreamJobsRead={handleDreamJobsRead}
                onUserActivity={handleUserActivity}
                isSessionCompleted={isSessionCompleted}
                isSidebarCollapsed={isSidebarCollapsed}
                autoResumeMessage={autoResumeMessage}
                showWelcome={showWelcome}
                isReturningUser={isReturningUser}
                welcomeCompletedSectionIndex={storedProgressIndex}
                onWelcomeReady={handleWelcomeStart}
                onUserSentMessage={() => {
                  if (reportData) {
                    localStorage.setItem(`chat_engaged_${reportData.id}`, '1');
                  }
                  setShowWelcome(false);
                }}
              />
              </TTSProvider>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-atlas-teal" />
              </div>
            )}
          </div>

          {/* Report Sidebar */}
          <ReportSidebar
            currentSectionIndex={currentSectionIndex}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onSectionClick={handleSectionClick}
            onCompleteSession={() => setShowClosing(true)}
            isSessionCompleted={isSessionCompleted}
            reportSections={reportSections}
          />
        </div>
      )}
    </div>
  );
};

export default Chat;

// ========================================================================
// OLD N8N CHAT CODE (preserved for rollback reference)
//
// The following code was replaced by the custom chat implementation above.
// It used the @n8n/chat widget with MutationObservers for:
// - Auto-expand textarea
// - Voice input (mic button injection)
// - Custom typing indicator
// - HTML tag conversion
// - Section detection
// - Disable input on session complete
//
// The original file is preserved in git history at commit 1f6acc7
// To restore: git checkout 1f6acc7 -- src/pages/Chat.tsx
// ========================================================================
