import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from 'react';
import { ChatMessages, ChatMessagesHandle } from './ChatMessages';
import { ChatInput, ChatInputHandle } from './ChatInput';
import { ALL_SECTIONS } from './ReportSidebar';
import { type QuickReplyIntent } from './QuickReplies';
import { ChapterFeedbackModal, type ChapterFeedbackPayload } from './ChapterFeedbackModal';
import { useN8nWebhook } from '@/hooks/useN8nWebhook';
import { useDeliverSection, type DeliverableSectionType } from '@/hooks/useDeliverSection';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useReportSections } from '@/hooks/useReportSections';
import { useContentFeedback } from '@/hooks/useContentFeedback';
import { useSubmitChapterFeedback } from '@/hooks/useSubmitChapterFeedback';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Maps the sidebar section index (0..10) to the section_type used by the
// `deliver-section` edge function. Indices that aren't delivered via chat
// (executive-summary at 0) map to null.
const SECTION_INDEX_TO_TYPE: Record<number, DeliverableSectionType | null> = {
  0: null, // executive-summary — never delivered via chat
  1: 'approach',
  2: 'strengths',
  3: 'development',
  4: 'values',
  5: 'top_career_1',
  6: 'top_career_2',
  7: 'top_career_3',
  8: 'runner_ups',
  9: 'outside_box',
  10: 'dream_jobs',
};

/**
 * Feature flag for the platform-side fast-path delivery.
 *
 * The WF5.3 agent prompt explicitly delegates ALL section delivery to the
 * platform ("The platform delivers all section content directly. You do
 * NOT deliver sections."). When the fast path is off, "Continue to next
 * section" clicks fall through to the agent, which correctly per its
 * prompt replies with "click the Continue to next section button below"
 * — locking the chat in a loop because no one is actually delivering the
 * next section.
 *
 * Default: ON. Add `?fast=0` to the URL to opt out for debugging or
 * rollback to the (currently unimplemented) agent-driven delivery.
 */
function isFastPathEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('fast') !== '0';
}

interface ChatContainerProps {
  reportId: string;
  userId: string;
  sessionId: string;
  firstName: string;
  country: string;
  currentSectionIndex: number;
  onSectionDetected: (index: number) => void;
  onSessionComplete: () => void;
  onDreamJobsRead?: () => void;
  onUserActivity?: () => void;
  isSessionCompleted: boolean;
  isSidebarCollapsed: boolean;
  autoResumeMessage?: string; // If set, send this message automatically on mount (for session resume)
  // Welcome card lives inside the chat as the empty state. Parent owns the
  // showWelcome flag so the page can react (e.g. dismiss on first user send).
  showWelcome?: boolean;
  isReturningUser?: boolean;
  welcomeCompletedSectionIndex?: number;
  onWelcomeReady?: () => void;
  onUserSentMessage?: () => void;
}

export const ChatContainer = forwardRef<ChatMessagesHandle, ChatContainerProps>(
  (
    {
      reportId,
      userId,
      sessionId,
      firstName,
      country,
      currentSectionIndex,
      onSectionDetected,
      onSessionComplete,
      onDreamJobsRead,
      onUserActivity,
      isSessionCompleted,
      isSidebarCollapsed,
      autoResumeMessage,
      showWelcome,
      isReturningUser,
      welcomeCompletedSectionIndex = -1,
      onWelcomeReady,
      onUserSentMessage,
    },
    ref
  ) => {
    const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
    // 'delivery' for fast-path section loads (just a Supabase SELECT + render,
    // ~200ms), 'agent' for LLM replies. Drives the typing indicator's copy
    // so it doesn't claim to be doing analysis when it's just rendering.
    const [loadingMode, setLoadingMode] = useState<'delivery' | 'agent'>('agent');
    // Wrap-up flow state. When the user clicks "All done, wrap up session"
    // we intercept (don't route to the agent) and show the WrapUpCard
    // instead. While 'pending' we hide the regular QuickReplies; on
    // completion we surface the POST_WRAP_REPLIES (Exit to Dashboard).
    const [wrapUpState, setWrapUpState] = useState<'idle' | 'pending' | 'completed'>('idle');
    // Track whether we've already rehydrated wrapUpState from chat history
    // on this mount, so we don't loop-set state every time messages or
    // sections change later in the session.
    const wrapUpRehydratedRef = useRef(false);
    // IDs of bot messages the user bookmarked via the inline "Save"
    // button. Persisted to localStorage so a refresh mid-session
    // doesn't drop selections. Sent to wrap-up-save as verbatim
    // "Saved Responses" appended to the chat_highlights row.
    const BOOKMARK_STORAGE_KEY = `atlas_chat_bookmarks_${reportId}`;
    const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
      if (typeof window === 'undefined') return [];
      try {
        const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
      } catch {
        return [];
      }
    });
    useEffect(() => {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarkedIds));
      } catch {
        // Storage full / disabled — bookmarks just won't survive refresh.
      }
    }, [bookmarkedIds, BOOKMARK_STORAGE_KEY]);
    // Map of user-message-id -> the original send args, populated when the
    // agent path throws. Lets us render a small retry icon next to the
    // failed message instead of forcing the user to retype. Cleared per
    // entry on successful retry. Lost on refresh — that's fine; the failed
    // user message is still in chat history, the user can just re-send.
    const [failedSends, setFailedSends] = useState<
      Record<string, { message: string; intent?: QuickReplyIntent }>
    >({});
    const [isUserTyping, setIsUserTyping] = useState(false);
    // When user clicks a quick-reply that focuses the input ('I see this
    // differently', 'Something else'), we set this to a custom placeholder
    // like 'Tell me how you see it…'. Cleared the moment the user actually
    // sends a message so it doesn't linger across turns.
    const [inputPlaceholderOverride, setInputPlaceholderOverride] = useState<string | null>(null);
    // Track how many sub-sections of the LATEST bot message are still hidden
    // behind a chevron. -1 = not yet reported (treat as locked); 0 = fully
    // revealed (unlocked); >0 = locked until reveals happen. New bot messages
    // reset to -1 so the UI defaults to LOCKED until ChatMessage reports
    // back, preventing a flash of QuickReplies before the sub-section
    // structure is registered.
    const [latestUnrevealedCount, setLatestUnrevealedCount] = useState(-1);
    const lastBotMessageIdRef = useRef<string | null>(null);
    // Set every time we add a user message via handleSend. Used as the
    // anchor for the failed-send retry icon when the agent call throws.
    const lastUserMessageIdRef = useRef<string | null>(null);
    // Tracks whether the most recent user action was an 'advance' click —
    // i.e. the next bot reply will be / was a section delivery, not a
    // discussion turn. The fast-path routing requires this to be TRUE,
    // otherwise we route Continue clicks through the agent so it can call
    // fb_unified with the real discussion summary before the platform
    // delivers the next section. Defaults to TRUE: a fresh page load
    // with no prior interaction is treated as "ready to advance."
    const lastTurnWasAdvanceRef = useRef(true);
    const inputRef = useRef<ChatInputHandle>(null);
    const { toast } = useToast();
    const { sendMessage, loadPreviousSession } = useN8nWebhook();
    const { deliver } = useDeliverSection();
    const { submit: submitChapterFeedback } = useSubmitChapterFeedback();
    const fastPathEnabled = useRef(isFastPathEnabled()).current;

    // Chapter feedback modal state. Shown when the user clicks Continue
    // from the values section AND no chapter_1_feedback row exists yet.
    // Pending advance args are stashed so the actual fast-path delivery
    // runs only after modal submit.
    const [chapterFeedbackOpen, setChapterFeedbackOpen] = useState(false);
    const [pendingAdvance, setPendingAdvance] = useState<{
      message: string;
      intent: QuickReplyIntent;
    } | null>(null);

    const { messages, isLoading, addMessage, seedFromHistory, hasMessages } =
      useChatMessages({ sessionId, reportId, userId });

    // Toggle a coach response's "Saved" state. The localStorage list above
    // drives the instant in-chat UI; here we also persist (or remove) the
    // response in Supabase so it surfaces in the dashboard report, tagged
    // with the section currently in focus.
    const handleBookmarkToggle = useCallback(
      (messageId: string) => {
        const isSaved = bookmarkedIds.includes(messageId);
        setBookmarkedIds((prev) =>
          isSaved ? prev.filter((id) => id !== messageId) : [...prev, messageId],
        );

        const message = messages.find((m) => m.id === messageId);
        if (!message?.content) return;

        if (!isSaved) {
          const sectionType = SECTION_INDEX_TO_TYPE[currentSectionIndex] ?? null;
          supabase.functions
            .invoke('save-chat-response', {
              body: {
                report_id: reportId,
                content: message.content,
                section_type: sectionType,
              },
            })
            .then(({ error }) => {
              if (error) console.error('Failed to save chat response:', error);
            });
        } else {
          supabase
            .from('saved_chat_responses')
            .delete()
            .eq('report_id', reportId)
            .eq('content', message.content)
            .then(({ error }) => {
              if (error) console.error('Failed to remove saved chat response:', error);
            });
        }
      },
      [bookmarkedIds, messages, reportId, currentSectionIndex],
    );
    // Thumbs-up "I'm impressed" feedback on bot replies. Loaded from + written
    // to content_feedback so it persists and we can learn from what lands.
    const { isLiked, toggleFeedback } = useContentFeedback(reportId, userId);
    const likedMessageIds = useMemo(
      () => messages.filter((m) => m.sender === 'bot' && isLiked('chat_message', m.id)).map((m) => m.id),
      [messages, isLiked],
    );
    const handleLikeToggle = useCallback(
      (messageId: string, text: string) => {
        void toggleFeedback('chat_message', messageId, text);
      },
      [toggleFeedback],
    );

    // Pull career sections from the report so ChatMessage can show match
    // scores + AI impact next to the career titles the agent presents.
    const { sections } = useReportSections(reportId);

    // Already submitted chapter_1_feedback for this report? Skip the modal
    // if so. Derived from the report_sections query that's already running.
    const chapterFeedbackAlreadySubmitted = useMemo(
      () => sections.some((s) => s.section_type === 'chapter_1_feedback'),
      [sections],
    );

    // Track whether we've attempted to load previous session from n8n
    const migrationAttemptedRef = useRef(false);
    const sectionScanDoneRef = useRef(false);

    // On mount: if no messages in Supabase, try loading from n8n (migration path)
    useEffect(() => {
      if (isLoading || migrationAttemptedRef.current) return;
      if (hasMessages) return; // Already have messages in Supabase

      migrationAttemptedRef.current = true;

      const tryLoadPrevious = async () => {
        const history = await loadPreviousSession(sessionId, {
          report_id: reportId,
          first_name: firstName,
          country,
        });

        if (history.length > 0) {
          seedFromHistory(history);

          // Scan history for section headers
          console.log('[Section] Scanning', history.length, 'messages from n8n migration');
          history.forEach((msg) => {
            if (msg.sender === 'bot') {
              scanForSections(msg.content);
            }
          });
          sectionScanDoneRef.current = true;
        }
      };

      tryLoadPrevious();
    }, [isLoading, hasMessages, sessionId, reportId, firstName, country, loadPreviousSession, seedFromHistory]);

    // Backup: scan messages loaded from Supabase for sections (runs once after load)
    useEffect(() => {
      if (isLoading || !hasMessages || sectionScanDoneRef.current) return;
      sectionScanDoneRef.current = true;

      console.log('[Section] Scanning', messages.length, 'messages from Supabase');
      messages.forEach((msg) => {
        if (msg.sender === 'bot') {
          scanForSections(msg.content);
        }
      });
    }, [isLoading, hasMessages, messages]);

    // ChatMessage is the source of truth for the latest bot message's
    // reveal state — it fires `onSequentialRevealStateChange` on mount
    // with either (1, total) for sub-section messages or (0, 0) for
    // discussion replies. We deliberately do NOT reset the count here
    // when `messages` changes: parent useEffects run AFTER child mount
    // effects, so a parent reset would clobber the child's correct
    // report. The ref is kept in case any other code path needs to
    // detect bot-message changes.
    useEffect(() => {
      const latestBot = [...messages].reverse().find((m) => m.sender === 'bot');
      if (latestBot && latestBot.id !== lastBotMessageIdRef.current) {
        lastBotMessageIdRef.current = latestBot.id;
      }
    }, [messages]);

    // Callback handed to SequentialSubsections (via ChatMessage). Receives
    // (revealed, total) — we store the gap as 'unrevealed'.
    const handleRevealStateChange = useCallback((revealed: number, total: number) => {
      setLatestUnrevealedCount(Math.max(0, total - revealed));
    }, []);

    // Auto-send a resume message when returning to the chat (e.g. after session restore)
    // This prevents the empty "Send a message to start your session" screen.
    const autoResumeAttemptedRef = useRef(false);
    useEffect(() => {
      if (!autoResumeMessage || autoResumeAttemptedRef.current) return;
      if (isLoading) return; // Wait until messages have loaded
      if (hasMessages) return; // If there are already messages, don't auto-send
      autoResumeAttemptedRef.current = true;

      // Small delay so the UI renders before the request fires
      const timer = setTimeout(() => {
        handleSend(autoResumeMessage);
      }, 300);
      return () => clearTimeout(timer);
    }, [isLoading, hasMessages, autoResumeMessage]);

    // Rehydrate wrapUpState on chat load. Without this, refreshing mid-
    // wrap-up loses the WrapUpCard AND leaves the user with no Exit
    // pill (last message is the user's "wrap up" click — no bot message
    // follows, so the in-loop QuickReplies wrapper doesn't render).
    //
    // - If the most recent user message looks like a wrap-up click AND
    //   no bot message follows it, derive state from report_sections:
    //     - chat_highlights row exists -> 'completed' (show Exit pill)
    //     - no chat_highlights row     -> 'pending'   (re-show WrapUpCard)
    // - Otherwise leave wrapUpState as 'idle'.
    //
    // Only runs once per mount (the ref) so legitimate state transitions
    // during the session aren't second-guessed.
    useEffect(() => {
      if (wrapUpRehydratedRef.current) return;
      if (isLoading) return;
      if (!messages.length) return;
      if (sections === undefined) return;

      let mostRecentWrapUpIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.sender === 'user' && /wrap up/i.test(m.content)) {
          mostRecentWrapUpIdx = i;
          break;
        }
      }
      if (mostRecentWrapUpIdx === -1) {
        wrapUpRehydratedRef.current = true;
        return;
      }

      // If a bot message arrived AFTER the wrap-up click, the user
      // either typed "wrap up" mid-conversation or the agent responded
      // somehow. Don't re-show the card in that case.
      const botAfter = messages
        .slice(mostRecentWrapUpIdx + 1)
        .some((m) => m.sender === 'bot');
      if (botAfter) {
        wrapUpRehydratedRef.current = true;
        return;
      }

      const hasHighlightsRow = sections.some(
        (s) => s.section_type === 'chat_highlights',
      );
      setWrapUpState(hasHighlightsRow ? 'completed' : 'pending');
      wrapUpRehydratedRef.current = true;
    }, [isLoading, messages, sections]);

    // Exact boilerplate intro phrases from the agent's BOILERPLATE QUICK REFERENCE.
    // ONLY used as fallback when heading-based detection misses.
    // Each phrase is taken verbatim from the knowledge base so they reliably
    // match and are long enough to avoid false positives in casual conversation.
    //
    // Heading detection (Strategy 1) already handles:
    //   - Approach/Strengths/Development/Values via SOP headers
    //   - Career 1-3 via "### Career N: [title]"
    //   - Runner-ups via "### Runner up: [title]"
    //
    // Boilerplate detection is critical for outside_box and dream_jobs
    // because their SOP header is just "### [career title]" with no prefix.
    const BOILERPLATE_PHRASES: { phrase: string; sectionIndex: number }[] = [
      // Approach — exact intro: "Let's dive into your personality profile."
      { phrase: "let's dive into your personality profile", sectionIndex: 1 },
      // Strengths — exact intro: "Let's talk about your strengths"
      { phrase: "let's talk about your strengths", sectionIndex: 2 },
      // Development — exact intro: "Now for the growth opportunities"
      { phrase: 'now for the growth opportunities', sectionIndex: 3 },
      // Values — exact intro: "let's look at your core values"
      { phrase: "let's look at your core values", sectionIndex: 4 },
      // Top Career 1 — exact intro: "one of the most suitable jobs for you is"
      { phrase: 'one of the most suitable jobs for you is', sectionIndex: 5 },
      // Career 2 — agent often says "that was your second career match" or "your second top career"
      { phrase: 'second career match', sectionIndex: 6 },
      { phrase: 'second top career', sectionIndex: 6 },
      { phrase: 'your second career', sectionIndex: 6 },
      // Career 3 — agent often says "that was your third career match" or "your third top career"
      { phrase: 'third career match', sectionIndex: 7 },
      { phrase: 'third top career', sectionIndex: 7 },
      { phrase: 'your third career', sectionIndex: 7 },
      // Runner-ups — exact intro phrase as backup for heading detection
      { phrase: 'runner-up career matches', sectionIndex: 8 },
      // Outside-the-box — NEEDS boilerplate (bare ### [title] headers in SOP)
      { phrase: 'outside-the-box career options', sectionIndex: 9 },
      // Dream jobs — NEEDS boilerplate (bare ### [title] headers in SOP)
      // Multiple phrases across intro/outro in case agent paraphrases the intro
      { phrase: 'everyone has an idea of their ideal job', sectionIndex: 10 },
      { phrase: "that's your dream job analysis", sectionIndex: 10 },
      { phrase: 'your dream job assessment', sectionIndex: 10 },
    ];

    // Scan bot message content for section headings and boilerplate phrases
    const scanForSections = (content: string) => {
      const lower = content.toLowerCase();

      // Strategy 1: Look for markdown headings (### Title) or HTML headings (<h3>Title</h3>)
      const headingRegex = /(?:###\s*(.+)|<h3[^>]*>(.+?)<\/h3>)/gi;
      let match;
      let foundViaHeading = false;
      while ((match = headingRegex.exec(content)) !== null) {
        const headingText = (match[1] || match[2] || '').trim();
        if (headingText) {
          console.log('[Section] Regex found heading:', headingText);
          const normalized = headingText.toLowerCase();
          const idx = ALL_SECTIONS.findIndex((section: any) => {
            if (normalized.includes(section.title.toLowerCase())) return true;
            if (section.altTitles?.some((alt: string) => normalized.includes(alt.toLowerCase()))) return true;
            if (normalized.includes(section.id.replace(/-/g, ' '))) return true;
            return false;
          });
          console.log('[Section] Heading match:', idx, idx >= 0 ? `(${ALL_SECTIONS[idx].title})` : '(no match)');
          if (idx >= 0) {
            onSectionDetected(idx);
            foundViaHeading = true;
          }
        }
      }

      // Strategy 2: Boilerplate phrase detection — always runs alongside heading detection.
      // Safe to always check because phrases are long/specific enough to avoid false positives,
      // and onSectionDetected uses Math.max so it can only move the sidebar forward.
      for (const { phrase, sectionIndex } of BOILERPLATE_PHRASES) {
        if (lower.includes(phrase)) {
          console.log('[Section] Boilerplate match:', `"${phrase}"`, '→', ALL_SECTIONS[sectionIndex].title);
          onSectionDetected(sectionIndex);
          break; // One match per message is enough
        }
      }

      // Check for session complete signal
      if (content.includes('SESSION_COMPLETE')) {
        onSessionComplete();
      }
    };

    // Called by quick replies that focus the input instead of sending a
    // message. Optional placeholder overrides the default "Type here" so the
    // user sees an inviting prompt that matches what we asked them to share.
    const handleFocusInput = (placeholder?: string) => {
      setInputPlaceholderOverride(placeholder ?? null);
      inputRef.current?.focus();
    };

    // Set when the user clicks "Ask about this role" on a specific career
    // card. The next free-text message they send gets prefixed with
    // [About <roleTitle>] so the agent has explicit context. Cleared after
    // one use (next free-text turn) — if the user changes their mind and
    // does something else (advance click, different button), we let it
    // stick until they actually type, then it clears on send. Using a ref
    // (not state) so the prefix doesn't trigger re-renders.
    const pendingAskRoleRef = useRef<string | null>(null);

    const handleAskAboutRole = (roleTitle: string) => {
      pendingAskRoleRef.current = roleTitle;
      setInputPlaceholderOverride(`Ask about ${roleTitle}…`);
      inputRef.current?.focus();
    };

    const handleSend = async (
      message: string,
      intent?: QuickReplyIntent,
      // Internal flag: bypass the chapter-feedback intercept. Used by the
      // modal submit handler so the second invocation (after feedback was
      // captured) doesn't re-open the modal in an infinite loop.
      skipChapterFeedback: boolean = false,
    ) => {
      if (isSessionCompleted || isWaitingForResponse) return;

      // Infer 'advance' or 'wrap_up' intent from typed text that mirrors what
      // a QuickReply button would have sent. Without this, a user who types
      // "let's continue to the next section" instead of clicking the pill
      // gets routed through the slow agent path; the agent then replies
      // "click the Continue to next section button below" — which the user
      // keeps responding to with the same phrase, locking the chat in a loop.
      // We treat exact/substring matches as the equivalent button click.
      if (!intent) {
        const lower = message.trim().toLowerCase().replace(/[!.,?]+$/, '');
        const looksLikeAdvance =
          lower.includes('continue to the next section') ||
          lower.includes('continue to next section') ||
          lower === 'next section' ||
          lower === 'continue' ||
          lower === 'next' ||
          lower === "let's continue" ||
          lower === 'lets continue' ||
          // Kickoff: clicking "I'm Ready!" auto-sends this exact phrase.
          // Treating it as an advance makes the platform deliver the first
          // section (approach) straight away instead of routing to the agent.
          lower === "i'm ready, let's begin" ||
          lower === "im ready, lets begin";
        const looksLikeWrapUp =
          lower.includes("wrap up the session") ||
          lower.includes("all done, wrap up") ||
          lower.includes("i'm all done") ||
          lower === 'wrap up';
        if (looksLikeWrapUp) {
          intent = 'wrap_up';
        } else if (looksLikeAdvance) {
          intent = 'advance';
        }
      }

      // Apply the pending "Ask about <role>" prefix on free-text turns
      // only. Intent-based clicks (advance, wrap_up, etc.) shouldn't get
      // mangled. Clear the pending role after consuming it.
      if (pendingAskRoleRef.current && !intent) {
        const role = pendingAskRoleRef.current;
        pendingAskRoleRef.current = null;
        message = `[About ${role}] ${message}`;
      }

      // Dismiss the in-chat welcome card the moment the user sends anything,
      // so manually typing a first message has the same effect as clicking
      // "I'm Ready!".
      onUserSentMessage?.();
      // Clear any custom placeholder set by a previous quick reply.
      setInputPlaceholderOverride(null);

      // Wrap-up intercept: don't route the click to the agent. Persist the
      // user message (so they see their click registered in the chat),
      // then flip wrapUpState to 'pending' — ChatMessages renders the
      // WrapUpCard inline, which calls wrap-up-extract / wrap-up-save.
      // QuickReplies stay hidden until the card completes.
      if (intent === 'wrap_up') {
        addMessage('user', message);
        setWrapUpState('pending');
        return;
      }

      // Chapter-1 feedback intercept: when the user clicks Continue from
      // the values section AND we haven't captured chapter feedback yet,
      // open the modal first. The actual advance fires only after the
      // modal is submitted (handleChapterFeedbackSubmit below). If the
      // user soft-cancels (X button), the click is voided — no user
      // message added, no advance.
      if (
        !skipChapterFeedback &&
        intent === 'advance' &&
        currentSectionIndex === 4 && // values
        SECTION_INDEX_TO_TYPE[currentSectionIndex + 1] === 'top_career_1' &&
        !chapterFeedbackAlreadySubmitted
      ) {
        setPendingAdvance({ message, intent });
        setChapterFeedbackOpen(true);
        return; // stop here — modal drives the rest
      }

      // Fast path: clean "Continue to next section" click. Always fires when
      // the click intent is 'advance' (regardless of whether discussion just
      // happened). When discussion DID happen, we additionally fire the agent
      // in the background so it can call fb_unified with a rich summary —
      // its text reply isn't shown in chat (a toast confirms feedback saved
      // when fb_unified completes). User sees the next section immediately
      // and the feedback save happens concurrently in the background.
      //
      // Welcome → approach handling: when currentSectionIndex < 1 we're in
      // the welcome state (no section delivered yet, or only the synthetic
      // executive-summary at index 0 which is never delivered via chat).
      // The first 'advance' click should deliver `approach`. The agent
      // prompt explicitly says it doesn't deliver sections, so the fast
      // path has to handle this transition too.
      const previousType = SECTION_INDEX_TO_TYPE[currentSectionIndex] ?? undefined;
      const isWelcomeAdvance = currentSectionIndex < 1 && intent === 'advance';
      const nextType: DeliverableSectionType | undefined = isWelcomeAdvance
        ? 'approach'
        : (SECTION_INDEX_TO_TYPE[currentSectionIndex + 1] ?? undefined);
      const shouldUseFastPath =
        fastPathEnabled &&
        intent === 'advance' &&
        nextType !== undefined;

      if (shouldUseFastPath && nextType) {
        const hadDiscussion = !lastTurnWasAdvanceRef.current;

        // Add user message to local state with skipPersist — the edge
        // function will persist it server-side (atomic with the section
        // delivery). If the fast path fails and we fall through to the
        // agent path, we write the user msg to chat_messages there.
        const newId = addMessage('user', message, { skipPersist: true });
        if (newId) lastUserMessageIdRef.current = newId;
        setLoadingMode('delivery');
        setIsWaitingForResponse(true);
        onUserActivity?.();

        // Fire agent in background for fb_unified summary capture. We don't
        // display its reply — the toast (fired immediately below) is the
        // user-visible confirmation. The agent writes the user message +
        // its reply to chat_histories itself via langchain's Postgres
        // memory node, so we tell the fast path NOT to write the user
        // message (avoids duplicate).
        if (hadDiscussion && previousType) {
          // Optimistic toast — fires synchronously with the click so the
          // user sees the confirmation tied to their action, not 10-15s
          // later when they're already reading the next section. Agent
          // runs to completion in the background; failures are logged
          // but don't surface (rare, and the discussion itself is still
          // preserved in chat history).
          toast({
            title: 'Saved',
            description: 'Your feedback will be reflected in your final report.',
          });
          sendMessage(sessionId, message, {
            report_id: reportId,
            first_name: firstName,
            country,
          }).catch((err) => {
            console.error('[advance] background agent failed:', err);
          });
        }

        try {
          const response = await deliver({
            reportId,
            sectionType: nextType,
            previousSectionType: previousType,
            userMessage: message,
            sessionId,
            userId,
            // When the agent is also running (discussion case), it writes
            // the user message to n8n_chat_histories itself via langchain.
            // Skip the edge function's own n8n_chat_histories user-msg write
            // to avoid a duplicate. (chat_messages persistence still happens.)
            skipHistoryUserWrite: hadDiscussion,
          });

          // Bot message: local state only — the edge function already wrote
          // the row to chat_messages server-side, so persistence is atomic
          // with the API response. Refresh-mid-flight is now safe.
          addMessage('bot', response, { skipPersist: true });
          scanForSections(response);
          lastTurnWasAdvanceRef.current = true;
          setIsWaitingForResponse(false);
          return;
        } catch (error) {
          console.error('[fast-path] deliver-section failed, falling back to agent:', error);
          // User msg was added with skipPersist=true expecting the edge
          // function to write it. It didn't. Persist now so refresh is
          // safe and the agent's eventual reply lands at the right place.
          supabase.from('chat_messages').insert({
            session_id: sessionId,
            report_id: reportId,
            user_id: userId,
            sender: 'user',
            content: message,
          }).then(({ error: persistErr }) => {
            if (persistErr) console.error('[fast-path] fallback persist failed:', persistErr);
          });
          // Fall through to the agent path below — but DON'T re-call
          // addMessage('user'), it's already in local state. Flip the
          // indicator to 'agent' so the user sees honest copy for the
          // longer LLM wait that's about to happen.
          setLoadingMode('agent');
        }
      } else {
        // Pure agent path (no fast path attempted): standard frontend
        // persistence via addMessage's fire-and-forget Supabase write.
        // Capture the new message id so we can pin a retry affordance
        // to it if the agent call fails below.
        const newId = addMessage('user', message);
        if (newId) lastUserMessageIdRef.current = newId;
        setLoadingMode('agent');
        setIsWaitingForResponse(true);
        onUserActivity?.();
      }

      try {
        const response = await sendMessage(sessionId, message, {
          report_id: reportId,
          first_name: firstName,
          country,
        });

        if (response) {
          addMessage('bot', response);
          scanForSections(response);
        } else {
          addMessage('bot', 'I didn\'t receive a response. Please try again.');
        }
        // After an agent turn, the routing precondition flips based on
        // intent: an 'advance' click that fell through to the agent (e.g.
        // because the previous turn was a discussion) means the agent
        // just handled fb_unified — the NEXT Continue is now safe for
        // fast path. Anything else (free text, Explore, See Differently)
        // is a discussion and the next Continue must again flow to the
        // agent.
        lastTurnWasAdvanceRef.current = intent === 'advance';
      } catch (error) {
        console.error('Failed to send message:', error);

        const errorMessage =
          error instanceof DOMException && error.name === 'AbortError'
            ? 'The request timed out. The AI is taking longer than usual. Please try again.'
            : 'Something went wrong. Tap the retry icon next to your message, or try again.';

        toast({
          title: 'Message failed',
          description: errorMessage,
          variant: 'destructive',
        });

        // Pin the retry button to the user message we just added so the
        // user can click instead of retyping. Use the most recent user
        // message id from local state — works for both the pure-agent
        // path and the fast-path-fallback path (where the message was
        // added with skipPersist before falling through).
        const failedId = lastUserMessageIdRef.current;
        if (failedId) {
          setFailedSends((prev) => ({ ...prev, [failedId]: { message, intent } }));
        }
      } finally {
        setIsWaitingForResponse(false);
      }
    };

    const handleRetry = async (messageId: string) => {
      const entry = failedSends[messageId];
      if (!entry || !sessionId) return;
      // Remove the failed marker optimistically so the icon disappears
      // while we retry. Re-add it on second failure.
      setFailedSends((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      setLoadingMode('agent');
      setIsWaitingForResponse(true);
      try {
        const response = await sendMessage(sessionId, entry.message, {
          report_id: reportId,
          first_name: firstName,
          country,
        });
        if (response) {
          addMessage('bot', response);
          scanForSections(response);
        } else {
          addMessage('bot', "I didn't receive a response. Please try again.");
        }
        lastTurnWasAdvanceRef.current = entry.intent === 'advance';
      } catch (error) {
        console.error('Retry failed:', error);
        toast({
          title: 'Still failing',
          description: 'Network or server might still be down. Try again in a moment.',
          variant: 'destructive',
        });
        setFailedSends((prev) => ({ ...prev, [messageId]: entry }));
      } finally {
        setIsWaitingForResponse(false);
      }
    };

    // Modal handlers — bound to ChapterFeedbackModal below.
    const handleChapterFeedbackSubmit = async (payload: ChapterFeedbackPayload) => {
      try {
        await submitChapterFeedback(reportId, payload);
      } catch (error) {
        console.error('[chapter-feedback] submit failed:', error);
        toast({
          title: 'Could not save your feedback',
          description: 'Please try again, or click X to skip and continue.',
          variant: 'destructive',
        });
        return; // keep the modal open so the user can retry
      }
      setChapterFeedbackOpen(false);
      // Re-run the original advance with skipChapterFeedback=true so we
      // don't loop back into the modal.
      const adv = pendingAdvance;
      setPendingAdvance(null);
      if (adv) {
        await handleSend(adv.message, adv.intent, true);
      }
    };

    const handleChapterFeedbackCancel = () => {
      // Soft cancel — close modal, void the pending advance. User can
      // keep chatting and click Continue again later.
      setChapterFeedbackOpen(false);
      setPendingAdvance(null);
    };

    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ChatMessages
          ref={ref}
          messages={messages}
          isLoading={isLoading}
          isWaitingForResponse={isWaitingForResponse}
          loadingMode={loadingMode}
          isUserTyping={isUserTyping}
          currentSectionIndex={currentSectionIndex}
          onSectionDetected={onSectionDetected}
          onQuickReply={handleSend}
          onFocusInput={handleFocusInput}
          onDreamJobsRead={onDreamJobsRead}
          onSequentialRevealStateChange={handleRevealStateChange}
          hasUnrevealedSubsections={latestUnrevealedCount !== 0}
          onAskAboutRole={handleAskAboutRole}
          onComparisonExplain={(content) => addMessage('bot', content)}
          showWelcome={showWelcome}
          isReturningUser={isReturningUser}
          welcomeFirstName={firstName}
          welcomeCompletedSectionIndex={welcomeCompletedSectionIndex}
          onWelcomeReady={onWelcomeReady}
          sections={sections}
          reportId={reportId}
          wrapUpState={wrapUpState}
          onWrapUpCompleted={() => setWrapUpState('completed')}
          failedMessageIds={Object.keys(failedSends)}
          onRetryMessage={handleRetry}
          bookmarkedMessageIds={bookmarkedIds}
          onBookmarkToggle={handleBookmarkToggle}
          likedMessageIds={likedMessageIds}
          onLikeToggle={handleLikeToggle}
        />

        {/* Mobile-only Complete Session CTA — sidebar button isn't visible on mobile */}
        {isSessionCompleted && (
          <div className="md:hidden px-4 py-3 bg-white border-t border-gray-100">
            <button
              onClick={onSessionComplete}
              className="w-full bg-atlas-teal text-white rounded-full py-3 font-semibold text-sm flex items-center justify-center gap-2"
            >
              View Your Report →
            </button>
          </div>
        )}

        <ChatInput
          ref={inputRef}
          onSend={handleSend}
          onTypingChange={setIsUserTyping}
          // Disable typing on the welcome screen so users can't accidentally
          // start with an off-script message that confuses the bot. They
          // click "I'm Ready!" to kick off, then type freely from there.
          // Also disabled while the latest section reveal still has hidden
          // sub-sections — forces the user to read everything before they
          // can react.
          //
          // EXCEPTION: returning users with an autoResumeMessage are NOT new
          // users — if their history failed to load (network blip, server
          // hiccup, edge case) we'd rather let them type than trap them in
          // a disabled welcome state with no escape.
          disabled={
            isSessionCompleted ||
            isWaitingForResponse ||
            (messages.length === 0 && !isWaitingForResponse && !autoResumeMessage) ||
            latestUnrevealedCount !== 0 ||
            wrapUpState !== 'idle'
          }
          placeholder={
            isSessionCompleted
              ? 'Session completed - your report is ready above'
              : wrapUpState === 'pending'
                ? 'Wrapping up — finish your highlights above to close out'
                : wrapUpState === 'completed'
                  ? 'Session closed - click Exit to Dashboard above'
                  : messages.length === 0
                    ? "Click 'I'm Ready!' above to begin"
                    : latestUnrevealedCount > 0
                      ? `Click to reveal the next ${latestUnrevealedCount} section${latestUnrevealedCount === 1 ? '' : 's'}…`
                      : (inputPlaceholderOverride ?? 'Type here')
          }
          isSidebarCollapsed={isSidebarCollapsed}
        />

        <ChapterFeedbackModal
          open={chapterFeedbackOpen}
          firstName={firstName}
          onSubmit={handleChapterFeedbackSubmit}
          onCancel={handleChapterFeedbackCancel}
        />
      </div>
    );
  }
);

ChatContainer.displayName = 'ChatContainer';
