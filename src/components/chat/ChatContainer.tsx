import { useTranslation } from 'react-i18next';
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
import { inferQuickReplyIntent } from './quickReplyIntent';

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

// The career-chapter section types. These are written by WF4 — the LAST step of
// the n8n pipeline — whereas personality sections come from WF1. The chat
// unlocks as soon as WF1 finishes, so a fast reader can reach the career
// chapter (right after the Cairnly feedback modal) before WF4 has written
// these rows. We gate delivery of these specifically.
const CAREER_SECTION_TYPES = new Set<DeliverableSectionType>([
  'top_career_1',
  'top_career_2',
  'top_career_3',
  'runner_ups',
  'outside_box',
  'dream_jobs',
]);

// Reverse of SECTION_INDEX_TO_TYPE, plus the highest deliverable index. Used
// by the stalled-section skip to find the next section that actually has
// content when one never arrives.
const SECTION_TYPE_TO_INDEX = Object.entries(SECTION_INDEX_TO_TYPE).reduce<
  Partial<Record<DeliverableSectionType, number>>
>((acc, [index, type]) => {
  if (type) acc[type] = Number(index);
  return acc;
}, {});
const LAST_SECTION_INDEX = Math.max(...Object.keys(SECTION_INDEX_TO_TYPE).map(Number));

// Smallest index whose section is a career section. Derived from the maps above
// so it stays correct if the ordering ever changes.
const FIRST_CAREER_INDEX = Math.min(
  ...Object.entries(SECTION_INDEX_TO_TYPE)
    .filter(([, type]) => type !== null && CAREER_SECTION_TYPES.has(type))
    .map(([index]) => Number(index)),
);

// Section context the chat sends to WF5 (the coach) in metadata so it knows
// where the user is and whether any career has been revealed yet. Without this
// WF5 can't honor its "don't suggest careers from upcoming sections" rule — it
// has no way to know careers are still locked. Consumed in WF5's SESSION DATA.
function sectionMetadata(currentSectionIndex: number): {
  current_section: DeliverableSectionType | null;
  careers_revealed: boolean;
} {
  return {
    current_section: SECTION_INDEX_TO_TYPE[currentSectionIndex] ?? null,
    careers_revealed: currentSectionIndex >= FIRST_CAREER_INDEX,
  };
}

// True if at least one report_sections row exists for this section type. Uses
// a count-style select so multi-row sections (runner_ups, outside_box) don't
// trip maybeSingle's "multiple rows" error.
async function sectionRowExists(reportId: string, sectionType: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('report_sections')
    .select('id')
    .eq('report_id', reportId)
    .eq('section_type', sectionType)
    .limit(1);
  if (error) {
    console.error('[career-gate] existence check failed:', error);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

// Poll until the section row appears or we time out. Returns true once ready,
// false if it never showed up within the window. Generous timeout: WF3+WF4
// normally finish well within this, and the user's reading + feedback-modal
// time overlaps with it.
async function waitForSectionRow(
  reportId: string,
  sectionType: string,
  { timeoutMs = 240_000, intervalMs = 4_000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await sectionRowExists(reportId, sectionType)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return sectionRowExists(reportId, sectionType);
}

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
  // Survey-sourced context forwarded to the coach (WF5) SESSION DATA header.
  // Extracted from the report's survey responses in Chat.tsx.
  assessmentPurpose?: string;
  goalAlignment?: string;
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
      assessmentPurpose,
      goalAlignment,
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
    const { t } = useTranslation('chat');
    const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
    // 'delivery' for fast-path section loads (just a Supabase SELECT + render,
    // ~200ms), 'agent' for LLM replies. Drives the typing indicator's copy
    // so it doesn't claim to be doing analysis when it's just rendering.
    const [loadingMode, setLoadingMode] = useState<'delivery' | 'agent' | 'preparing'>('agent');
    // Wrap-up flow state. When the user clicks "All done, wrap up session"
    // we intercept (don't route to the agent) and show the WrapUpCard
    // instead. While 'pending' we hide the regular QuickReplies; on
    // completion we surface the POST_WRAP_REPLIES (Exit to Dashboard).
    const [wrapUpState, setWrapUpState] = useState<'idle' | 'pending' | 'completed'>('idle');
    // Track whether we've already rehydrated wrapUpState from chat history
    // on this mount, so we don't loop-set state every time messages or
    // sections change later in the session.
    const wrapUpRehydratedRef = useRef(false);
    // IDs of bot messages the user kept via the inline "Keep"
    // button. Persisted to localStorage so a refresh mid-session
    // doesn't drop selections (the content itself is written to
    // saved_chat_responses on click). Sent to wrap-up-save as verbatim
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
    // Visible "Asking about: <role>" context chip shown above the input after
    // the user clicks "Ask about this role". Mirrors pendingAskRoleRef (which
    // drives the [About <role>] prefix); this state just renders the cue so
    // the action doesn't feel like it did nothing. Cleared on send or cancel.
    const [askAboutRole, setAskAboutRole] = useState<string | null>(null);
    // Track how many sub-sections of the LATEST bot message are still hidden
    // behind a chevron. -1 = not yet reported (treat as locked); 0 = fully
    // revealed (unlocked); >0 = locked until reveals happen. New bot messages
    // reset to -1 so the UI defaults to LOCKED until ChatMessage reports
    // back, preventing a flash of QuickReplies before the sub-section
    // structure is registered.
    const [latestUnrevealedCount, setLatestUnrevealedCount] = useState(-1);
    // True while the latest multi-card section (runner_ups / outside_box /
    // dream_jobs) still has collapsed cards. Locks the input so the user has to
    // open every card before reacting — same gate the Continue button uses.
    const [multiCardLocked, setMultiCardLocked] = useState(false);
    // Live "N of M cards ever opened" for whichever multi-card message is
    // currently locking the input. Drives the small progress chip above the
    // input so users aren't left guessing how many cards still need a tap.
    const [cardOpenProgress, setCardOpenProgress] = useState<{ opened: number; total: number } | null>(null);
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
    // Set once the chapter feedback modal is submitted this session. Guards the
    // modal from re-opening on a retry (e.g. after a career-readiness timeout)
    // before `sections` (react-query) has refreshed to include the new
    // chapter_1_feedback row.
    const chapterFeedbackDoneRef = useRef(false);

    // Consecutive "waited for the section row and it never appeared" counts,
    // keyed by section type. Reset the moment the row shows up. Drives the
    // escalation in the career gate below: one timeout is a slow pipeline,
    // two means the row probably isn't coming at all.
    const sectionWaitFailuresRef = useRef<Record<string, number>>({});
    // The section we've given up waiting for, if any. Surfaces the "Skip this
    // section" pill so a broken upstream workflow can't dead-end the session.
    const [stalledSection, setStalledSection] = useState<DeliverableSectionType | null>(null);
    // Guards against filing the same support request on every retry click.
    const stallReportedRef = useRef<Record<string, boolean>>({});

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
        if (m.sender === 'user' && /wrap up|sessie afronden/i.test(m.content)) {
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
      // Dutch boilerplate — exact substrings of the NL intro/outro strings in
      // supabase/functions/deliver-section/boilerplate.ts. Keep in sync.
      { phrase: 'laten we eens in je persoonlijkheidsprofiel duiken', sectionIndex: 1 },
      { phrase: 'laten we het hebben over je sterke punten', sectionIndex: 2 },
      { phrase: 'nu de groeikansen', sectionIndex: 3 },
      { phrase: 'tot slot kijken we naar je kernwaarden', sectionIndex: 4 },
      { phrase: 'een van de meest geschikte banen voor jou', sectionIndex: 5 },
      { phrase: 'dat was je tweede match', sectionIndex: 6 },
      { phrase: 'dat was je derde topmatch', sectionIndex: 7 },
      { phrase: 'runner-up matches', sectionIndex: 8 },
      { phrase: 'outside-the-box loopbaanopties', sectionIndex: 9 },
      { phrase: 'we vroegen naar je droombaan', sectionIndex: 10 },
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
    const handleFocusInput = (placeholder?: string, pillKey?: string) => {
      setInputPlaceholderOverride(placeholder ?? null);
      // Remember which focus-type pill (differently / somethingElse) opened
      // the input, so the next typed turn can carry a "via <pill>" label in
      // the transcript. Only set when a pill says so — other focus calls
      // (e.g. follow-up chips) leave any pending label alone.
      if (pillKey) pendingQuickReplyRef.current = pillKey;
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

    // Which focus-type quick-reply pill (differently / somethingElse) the
    // user clicked before typing. Consumed by the next free-text send as
    // message metadata; cleared on intent sends (the user moved on).
    const pendingQuickReplyRef = useRef<string | null>(null);

    const handleAskAboutRole = (roleTitle: string) => {
      pendingAskRoleRef.current = roleTitle;
      setAskAboutRole(roleTitle);
      setInputPlaceholderOverride(
        t('ui.askAboutPlaceholder', { role: roleTitle, defaultValue: `Ask about ${roleTitle}…` }),
      );
      inputRef.current?.focus();
    };

    // Cancel the pending "Ask about this role" scoping (the chip's ✕).
    const cancelAskAboutRole = () => {
      pendingAskRoleRef.current = null;
      setAskAboutRole(null);
      setInputPlaceholderOverride(null);
    };

    // Click on the "N cards left" chip: scroll to a card that is still
    // collapsed and pulse it. Collapsed cards carry data-card-collapsed
    // (CollapsibleCareerBlocks); the gating message is the newest one, so of
    // all matches the LAST in document order belongs to it.
    const scrollToCollapsedCard = useCallback(() => {
      const els = document.querySelectorAll('[data-card-collapsed="true"]');
      const el = els[els.length - 1] as HTMLElement | undefined;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.animate(
        [
          { boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.55)' },
          { boxShadow: '0 0 0 3px rgba(13, 148, 136, 0)' },
        ],
        { duration: 1400, easing: 'ease-out' },
      );
    }, []);

    // File a support request when a section never arrives. A stalled section
    // means an upstream workflow didn't write its rows — invisible to us
    // otherwise, because nothing errors: the user just sits in front of a
    // spinner. Routing it through submit-support-request puts it in the same
    // inbox (and the same ops feed) as a hand-written report, so it actually
    // gets seen. Fire-and-forget: a failure here must never block the user's
    // way out of the stall.
    const reportStalledSection = useCallback(
      async (sectionType: DeliverableSectionType, attempts: number) => {
        if (stallReportedRef.current[sectionType]) return;
        stallReportedRef.current[sectionType] = true;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('submit-support-request', {
            body: {
              category: 'ai_chat',
              email: session?.user?.email ?? 'unknown@cairnly.io',
              page: '/chat',
              user_agent: navigator.userAgent,
              message:
                `[automatic] Section "${sectionType}" never appeared for report ${reportId} ` +
                `after ${attempts} waits. The report_sections rows for this section are missing, ` +
                `so the chat could not deliver it and the user was offered a skip. ` +
                `Check the upstream n8n workflow run for this report.`,
            },
          });
        } catch (err) {
          console.error('[stalled-section] failed to file support request:', err);
        }
      },
      [reportId],
    );

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
        intent = inferQuickReplyIntent(message);
      }

      // Apply the pending "Ask about <role>" prefix on free-text turns
      // only. Intent-based clicks (advance, wrap_up, etc.) shouldn't get
      // mangled. Clear the pending role after consuming it.
      if (pendingAskRoleRef.current && !intent) {
        const role = pendingAskRoleRef.current;
        pendingAskRoleRef.current = null;
        // Localised prefix: the user sees this as part of their own message,
        // and the agent mirrors the language of the turn.
        message = `${t('prompts.aboutPrefix', { role })} ${message}`;
      }

      // An intent send (advance / wrap-up / skip) means the user moved on:
      // drop any lingering "Ask about <role>" scoping, chip included, so the
      // next free-text turn in the new section doesn't get a stale prefix.
      // Same for a pending quick-reply label.
      if (intent) {
        cancelAskAboutRole();
        pendingQuickReplyRef.current = null;
      }

      // Consume the pending pill label for this free-text turn.
      const quickReplyKey = !intent ? pendingQuickReplyRef.current : null;
      pendingQuickReplyRef.current = null;

      // Dismiss the in-chat welcome card the moment the user sends anything,
      // so manually typing a first message has the same effect as clicking
      // "I'm Ready!".
      onUserSentMessage?.();
      // Clear any custom placeholder set by a previous quick reply.
      setInputPlaceholderOverride(null);
      // Clear the "Asking about: <role>" chip — the role has now been consumed
      // (free text) or the user is moving on (intent), so the cue is stale.
      setAskAboutRole(null);

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

      // Stalled-section skip. The user gave up waiting on a section whose rows
      // never arrived; jump them to the next section that DOES have content so
      // a broken upstream workflow costs them one section instead of the whole
      // session. If nothing deliverable is left, go straight to wrap-up.
      if (intent === 'skip_stalled') {
        const stalled = stalledSection;
        addMessage('user', message, { skipPersist: true });
        setStalledSection(null);
        setLoadingMode('delivery');
        setIsWaitingForResponse(true);

        const stalledIndex = (stalled && SECTION_TYPE_TO_INDEX[stalled]) ?? currentSectionIndex + 1;
        let targetIndex = -1;
        let targetType: DeliverableSectionType | undefined;
        for (let i = stalledIndex + 1; i <= LAST_SECTION_INDEX; i++) {
          const candidate = SECTION_INDEX_TO_TYPE[i];
          if (!candidate) continue;
          if (await sectionRowExists(reportId, candidate)) {
            targetIndex = i;
            targetType = candidate;
            break;
          }
        }

        if (targetType) {
          try {
            const response = await deliver({
              reportId,
              sectionType: targetType,
              previousSectionType: SECTION_INDEX_TO_TYPE[currentSectionIndex] ?? undefined,
              userMessage: message,
              sessionId,
              userId,
            });
            addMessage('bot', response, { skipPersist: true });
            onSectionDetected(targetIndex);
            lastTurnWasAdvanceRef.current = true;
            setIsWaitingForResponse(false);
            return;
          } catch (error) {
            console.error('[skip-stalled] deliver failed, wrapping up instead:', error);
          }
        }

        // Nothing further to deliver (or that delivery failed too) — close the
        // session cleanly rather than leaving them stranded again. The skip
        // click never reached the edge function, so persist it here.
        supabase.from('chat_messages').insert({
          session_id: sessionId,
          report_id: reportId,
          user_id: userId,
          sender: 'user',
          content: message,
        }).then(({ error: persistErr }) => {
          if (persistErr) console.error('[skip-stalled] persist failed:', persistErr);
        });
        setIsWaitingForResponse(false);
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
        !chapterFeedbackAlreadySubmitted &&
        !chapterFeedbackDoneRef.current
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
            title: t('ui.savedTitle'),
            // Refers to the section discussion (which IS summarised into the
            // report), not the Cairnly product-feedback modal that can fire
            // just before this on the values→career transition. The old
            // generic "Your feedback…" wording made product feedback look
            // like it went into the report, which it doesn't.
            description: t('ui.savedSectionBody'),
          });
          sendMessage(sessionId, message, {
            report_id: reportId,
            first_name: firstName,
            country,
            assessment_purpose: assessmentPurpose,
            goal_alignment: goalAlignment,
            ...sectionMetadata(currentSectionIndex),
          }).catch((err) => {
            console.error('[advance] background agent failed:', err);
          });
        }

        // Career-chapter gate. The career sections come from WF4 (the last
        // pipeline step), but the chat unlocks after WF1, so a fast reader can
        // arrive here (just after the Cairnly feedback modal) before the rows
        // exist. Rather than 404 → fall through to the agent (which won't
        // deliver sections), show a "preparing" state and wait for WF4.
        if (CAREER_SECTION_TYPES.has(nextType) && !(await sectionRowExists(reportId, nextType))) {
          setLoadingMode('preparing');
          const becameReady = await waitForSectionRow(reportId, nextType);
          if (!becameReady) {
            // Timed out waiting for WF4. Leave the user at the current section
            // (we never advanced). The user message was added with skipPersist
            // and the deliver never ran, so nothing is persisted — a refresh
            // cleanly returns them to the Continue button. Do NOT fall through
            // to the agent.
            //
            // Attempt 1 is a genuine "still working" nudge: WF4 really can run
            // long, and retrying usually works. But when the row is never
            // coming (e.g. Aug 2026: WF4's "Insert dream" node was left
            // disabled after a test, so dream_jobs rows silently stopped being
            // written), repeating that nudge traps the user in a loop with no
            // way to finish their report and no signal reaching us. From
            // attempt 2 we stop pretending it's a delay, raise a support
            // request so it surfaces, and offer a way past the section.
            const attempts = (sectionWaitFailuresRef.current[nextType] ?? 0) + 1;
            sectionWaitFailuresRef.current[nextType] = attempts;

            if (attempts === 1) {
              addMessage(
                'bot',
                "Your career matches are taking a little longer to finalize. Hang tight — give it a moment and tap Continue again.",
                { skipPersist: true },
              );
            } else {
              setStalledSection(nextType);
              void reportStalledSection(nextType, attempts);
              addMessage(
                'bot',
                "This section still isn't coming through, and that's on our side, not something you did. I've flagged it to the team so they can look at it.\n\nYou don't have to sit here waiting: you can skip ahead and finish the rest of your session now. We'll follow up about this section by email.",
                { skipPersist: true },
              );
            }
            setLoadingMode('agent');
            setIsWaitingForResponse(false);
            return;
          }
          // Ready now — restore the fast "loading section" copy for the actual
          // deliver call below, and clear any earlier stall for this section.
          sectionWaitFailuresRef.current[nextType] = 0;
          setStalledSection((prev) => (prev === nextType ? null : prev));
          setLoadingMode('delivery');
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
          // Advance the sidebar directly from the section we just delivered.
          // The fast path KNOWS which section it requested, so we don't rely on
          // scanForSections reverse-engineering it from the prose — that matches
          // English boilerplate phrases only and silently fails on localized
          // (e.g. Dutch) reports, leaving progress stuck a section behind.
          // scanForSections still runs as a backup for the agent path.
          onSectionDetected(isWelcomeAdvance ? 1 : currentSectionIndex + 1);
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
        const newId = addMessage(
          'user',
          message,
          quickReplyKey ? { metadata: { quick_reply: quickReplyKey } } : undefined,
        );
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
          assessment_purpose: assessmentPurpose,
          goal_alignment: goalAlignment,
          ...sectionMetadata(currentSectionIndex),
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
          assessment_purpose: assessmentPurpose,
          goal_alignment: goalAlignment,
          ...sectionMetadata(currentSectionIndex),
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
      // Remember it's done for this session so a retry (e.g. after a career
      // readiness timeout) can't re-open the modal before `sections` refreshes.
      chapterFeedbackDoneRef.current = true;
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
          onMultiCardLockChange={setMultiCardLocked}
          onCardOpenProgressChange={setCardOpenProgress}
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
          isStalled={stalledSection !== null}
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
              {t('session.viewReport', { defaultValue: 'View Your Report' })} →
            </button>
          </div>
        )}

        {/* The welcome screen has nothing to type into (the input was disabled
            there anyway): hide the bar so the welcome card can take the same
            vertical box as the sidebar. Returning users with an auto-resume
            keep it, they are mid-conversation. */}
        {!(messages.length === 0 && !isWaitingForResponse && !autoResumeMessage) && (
          <ChatInput
            ref={inputRef}
            onSend={handleSend}
            askAboutRole={isSessionCompleted ? null : askAboutRole}
            onCancelAskAboutRole={cancelAskAboutRole}
            cardsLeftCount={
              multiCardLocked && cardOpenProgress
                ? cardOpenProgress.total - cardOpenProgress.opened
                : null
            }
            onCardsLeftClick={scrollToCollapsedCard}
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
              // The "reveal each section / open each card" gates block the normal
              // flow, but a user who clicked "Ask about this role" has already
              // picked a revealed card — let them ask without first opening every
              // other card. Scoped to askAboutRole so the sequential-reveal gate
              // is untouched for every other case.
              (!askAboutRole && (latestUnrevealedCount !== 0 || multiCardLocked)) ||
              wrapUpState !== 'idle'
            }
            placeholder={
              isSessionCompleted
                ? t('ui.phSessionCompleted')
                : wrapUpState === 'pending'
                  ? t('ui.phWrappingUp')
                  : wrapUpState === 'completed'
                    ? t('ui.phSessionClosed')
                    : messages.length === 0
                      ? t('ui.phNotStarted')
                      : askAboutRole
                        ? t('ui.phAskQuestion')
                        : latestUnrevealedCount > 0
                        ? t('ui.phRevealNext', { count: latestUnrevealedCount })
                        : multiCardLocked
                          ? t('ui.phOpenCards')
                          // undefined lets ChatInput pick its own default,
                          // which is voice-aware ("Typ hier of dicteer…").
                          : (inputPlaceholderOverride ?? undefined)
            }
            isSidebarCollapsed={isSidebarCollapsed}
          />
        )}

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
