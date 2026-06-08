import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { WrapUpCard } from './WrapUpCard';
import { QuickReplies, type QuickReplyIntent } from './QuickReplies';
import { WelcomeCard } from './WelcomeCard';
import { WelcomeBackCard } from './WelcomeBackCard';
import { Loader2 } from 'lucide-react';
import { ALL_SECTIONS } from './ReportSidebar';
import type { ChatMessage as ChatMessageType } from '@/hooks/useChatMessages';
import type { ReportSection } from '@/hooks/useReportSections';

export interface ChatMessagesHandle {
  scrollToSection: (sectionId: string) => void;
}

interface ChatMessagesProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  isWaitingForResponse: boolean;
  isUserTyping: boolean;
  // 'delivery' = platform fast-path is loading a section (~200ms);
  // 'agent'    = WF5.3 LLM is composing a reply (3-30s).
  // Drives the typing indicator's copy. Defaults to 'agent' upstream.
  loadingMode?: 'delivery' | 'agent' | 'preparing';
  currentSectionIndex: number;
  onSectionDetected: (index: number) => void;
  onQuickReply: (message: string, intent?: QuickReplyIntent) => void;
  // Optional placeholder lets quick-reply / chip clicks customize the input
  // prompt (e.g. 'Tell me how you see it…') when focusing without sending.
  onFocusInput: (placeholder?: string) => void;
  onDreamJobsRead?: () => void;
  // Forwarded from the latest bot message's SequentialSubsections so the
  // parent (ChatContainer) can lock the input until everything's read.
  onSequentialRevealStateChange?: (revealed: number, total: number) => void;
  // True when the latest section reveal still has hidden sub-sections.
  // We use this to suppress quick replies until the user has clicked
  // through every chevron — otherwise they'd react to half a section.
  hasUnrevealedSubsections?: boolean;
  // In-chat welcome card (shown as the empty state when no messages exist).
  showWelcome?: boolean;
  isReturningUser?: boolean;
  welcomeFirstName?: string;
  welcomeCompletedSectionIndex?: number;
  onWelcomeReady?: () => void;
  // Career sections from the user's report — used by ChatMessage to render
  // match scores + AI impact badges next to career titles.
  sections?: ReportSection[];
  // Forwarded to CollapsibleCareerBlocks for the "Ask about this role"
  // per-card button. Container scopes the next user message to the role.
  onAskAboutRole?: (roleTitle: string) => void;
  // Wrap-up flow. When state is 'pending' we render the WrapUpCard
  // after the last message and suppress QuickReplies. When 'completed'
  // we surface the post-wrap pill (Exit to Dashboard) via the existing
  // hasWrappedUp branch.
  reportId?: string;
  wrapUpState?: 'idle' | 'pending' | 'completed';
  onWrapUpCompleted?: () => void;
  // IDs of user messages whose agent call threw. ChatMessage renders a
  // small retry affordance to the right of these bubbles. Click hits
  // onRetryMessage(id) and the parent re-runs the send.
  failedMessageIds?: string[];
  onRetryMessage?: (messageId: string) => void;
  // Bot messages the user has bookmarked for verbatim preservation.
  // Renders a "Save"/"Saved" pill in the message footer. Excluded from
  // the very first welcome bubble (where Save would be meaningless).
  bookmarkedMessageIds?: string[];
  onBookmarkToggle?: (messageId: string) => void;
  // Bot messages the user has thumbed-up as impressive. Renders a filled
  // thumbs-up in the message footer; persisted to content_feedback.
  likedMessageIds?: string[];
  onLikeToggle?: (messageId: string, text: string) => void;
  // Posts a comparison explanation into the chat as a bot message.
  onComparisonExplain?: (content: string) => void;
}

export const ChatMessages = forwardRef<ChatMessagesHandle, ChatMessagesProps>(
  ({ messages, isLoading, isWaitingForResponse, isUserTyping, loadingMode = 'agent', currentSectionIndex, onSectionDetected, onQuickReply, onFocusInput, onDreamJobsRead, showWelcome, isReturningUser, welcomeFirstName, welcomeCompletedSectionIndex = -1, onWelcomeReady, sections, onSequentialRevealStateChange, hasUnrevealedSubsections = false, onAskAboutRole, reportId, wrapUpState = 'idle', onWrapUpCompleted, failedMessageIds, onRetryMessage, bookmarkedMessageIds, onBookmarkToggle, likedMessageIds, onLikeToggle, onComparisonExplain }, ref) => {
    const failedSet = new Set(failedMessageIds ?? []);
    const likedSet = new Set(likedMessageIds ?? []);
    const bookmarkedSet = new Set(bookmarkedMessageIds ?? []);
    const isDreamJobsSection = currentSectionIndex >= ALL_SECTIONS.length - 1;
    // Tracks "every card opened at least once" for ALL multi-card sections
    // (runner_ups, outside_box, dream_jobs). Keyed by message id so navigating
    // back/forward doesn't unlock QuickReplies on a different message that
    // hasn't been fully read. CollapsibleCareerBlocks fires the parent's
    // onAllBlocksOpened callback once everOpened reaches blocks.length.
    const [openedByMessageId, setOpenedByMessageId] = useState<Record<string, boolean>>({});

    // Detect if the user has already sent a wrap-up message
    const hasWrappedUp = messages.some(
      (msg) => msg.sender === 'user' && msg.content.toLowerCase().includes('wrap up')
    );
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const lastMessageRef = useRef<HTMLDivElement>(null);
    const isUserScrolledUpRef = useRef(false);
    const prevMessagesLengthRef = useRef(messages.length);

    // Track if user has scrolled up (to disable auto-scroll)
    const handleScroll = useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const threshold = 100; // px from bottom
      isUserScrolledUpRef.current =
        container.scrollTop + container.clientHeight < container.scrollHeight - threshold;
    }, []);

    // When a new message arrives: scroll to the top of the new message so user reads from the start.
    // While waiting for a response: scroll to bottom to show the typing indicator.
    useEffect(() => {
      const newMessageArrived = messages.length > prevMessagesLengthRef.current;
      prevMessagesLengthRef.current = messages.length;

      if (newMessageArrived) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.sender === 'bot') {
          // Scroll so the top of the new bot message is visible
          lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          isUserScrolledUpRef.current = false;
          return;
        }
      }

      // For user messages or typing indicator, scroll to bottom (unless user scrolled up)
      if (!isUserScrolledUpRef.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, [messages.length, isWaitingForResponse]);

    // Expose scrollToSection for sidebar navigation. Uses scrollIntoView
    // (not container.scrollTo) because the page scrolls at the WINDOW
    // level, not within the chat container — the container's scrollTop
    // is always 0. scrollIntoView walks ancestors and scrolls whichever
    // one is actually scrollable. CSS scroll-margin-top on the h3 leaves
    // breathing room above the heading (set in markdownComponents.h3).
    useImperativeHandle(ref, () => ({
      scrollToSection: (sectionId: string) => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const heading = container.querySelector(`[data-section-id="${sectionId}"]`) as HTMLElement | null;
        if (!heading) return;
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }));

    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-blue-100/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading conversation...</span>
          </div>
        </div>
      );
    }

    // Empty chat → render the WelcomeCard (or WelcomeBackCard) as the empty
    // state, vertically centered. This replaces the old standalone welcome
    // page so the user sees the chat layout (input + sidebar) right away.
    // They can either click "I'm Ready!" (auto-fires kickoff message via
    // autoResumeMessage) or just type their first message manually.
    //
    // Gate is purely based on messages.length so the welcome shows for ALL
    // empty-chat scenarios — new users, testers with a stale localStorage
    // sessionId, returning users whose stored session has no Supabase
    // messages yet. Once any message exists, welcome auto-hides.
    if (messages.length === 0 && !isWaitingForResponse) {
      return (
        <div className="flex-1 overflow-y-auto flex items-center justify-center px-3 sm:px-6 pt-4 pb-[180px] sm:pb-[140px]">
          {isReturningUser ? (
            <WelcomeBackCard
              onContinue={onWelcomeReady ?? (() => {})}
              firstName={welcomeFirstName || undefined}
              completedSectionIndex={welcomeCompletedSectionIndex}
            />
          ) : (
            <WelcomeCard
              onReady={onWelcomeReady ?? (() => {})}
              isLoading={false}
            />
          )}
        </div>
      );
    }

    return (
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-[800px] mx-auto px-3 sm:px-6 pt-4 sm:pt-8 pb-[180px] sm:pb-[140px]">
          {messages.length === 0 && !isWaitingForResponse && (
            <div className="text-center text-blue-100/70 text-sm py-12">
              Send a message to start your session
            </div>
          )}

          {messages.map((msg, idx, arr) => {
            const isLastMessage = idx === arr.length - 1;
            const isLastBotMessage = isLastMessage && msg.sender === 'bot';
            // Most recent bot message in the array — may or may not be the
            // very last message (user could have typed a reply after it).
            // Computed inline because the JSX flow doesn't have a clean
            // place to memoize without restructuring the component.
            let latestBotIdx = -1;
            for (let i = arr.length - 1; i >= 0; i--) {
              if (arr[i].sender === 'bot') { latestBotIdx = i; break; }
            }
            const isLatestBotMessage = idx === latestBotIdx;
            // Dream jobs message: collapse all blocks by default, track when all opened
            const isDreamJobsMessage = isLastBotMessage && isDreamJobsSection;
            // Multi-card section detection: any bot message with 2+ ###
            // headings is a multi-card delivery (runner_ups / outside_box /
            // dream_jobs). The QuickReplies underneath should stay hidden
            // until the user has expanded every card at least once — same
            // gating logic that already existed for dream_jobs only.
            const headingCount = msg.sender === 'bot'
              ? (msg.content.match(/^### /gm) || []).length
              : 0;
            const isMultiCardMessage = isLastBotMessage && headingCount >= 2;
            const allCardsOpened = openedByMessageId[msg.id] === true;

            // Detect what KIND of bot message this is so QuickReplies show
            // the right set (or nothing):
            //  - Section reveal (### heading present): full replies after
            //    the user has clicked through every chevron.
            //  - Follow-up with options (no ###, multiple bold-bulleted
            //    items): no quick replies — the chips inside the message
            //    are the choice mechanism.
            //  - Deep dive (anything else from the bot): only 'Continue to
            //    next section'. The chat input handles further follow-ups.
            //    Prevents the explore-more loop reported earlier.
            const isSectionReveal = msg.sender === 'bot' && /^### /m.test(msg.content);
            // A follow-up message has 2+ bullets and ends with a "something
            // else / let me know" escape hatch — that's the unique signal
            // the WF5.3 prompt produces, regardless of whether each bullet
            // uses a bold lead. (Earlier this required `- **` on every
            // bullet; the current prompt example uses plain bullets, so
            // chips silently stopped rendering.)
            const bulletCount = (msg.content.match(/^\s*-\s+/gm) || []).length;
            const hasEscapeHatch = /something else|let me know|on your mind/i.test(msg.content);
            const isFollowUp =
              isLastBotMessage &&
              msg.sender === 'bot' &&
              !isSectionReveal &&
              bulletCount >= 2 &&
              hasEscapeHatch;
            const isDeepDive =
              isLastBotMessage &&
              msg.sender === 'bot' &&
              !isSectionReveal &&
              !isFollowUp;

            return (
              <React.Fragment key={msg.id}>
                {isLastMessage && <div ref={lastMessageRef} />}
                <ChatMessage
                  messageId={msg.id}
                  content={msg.content}
                  sender={msg.sender}
                  onSectionDetected={onSectionDetected}
                  defaultAllCollapsed={isMultiCardMessage}
                  onAllBlocksOpened={isMultiCardMessage ? () => {
                    setOpenedByMessageId((prev) => prev[msg.id] ? prev : { ...prev, [msg.id]: true });
                    if (isDreamJobsMessage) onDreamJobsRead?.();
                  } : undefined}
                  sections={sections}
                  isLatestBotMessage={isLatestBotMessage}
                  onChipSend={onQuickReply}
                  onChipFocusInput={onFocusInput}
                  onSequentialRevealStateChange={onSequentialRevealStateChange}
                  onAskAboutRole={onAskAboutRole}
                  onComparisonExplain={onComparisonExplain}
                  failed={failedSet.has(msg.id)}
                  onRetry={onRetryMessage}
                  bookmarkable={msg.sender === 'bot' && !!onBookmarkToggle}
                  bookmarked={bookmarkedSet.has(msg.id)}
                  alreadyInReport={isSectionReveal}
                  onBookmarkToggle={onBookmarkToggle}
                  liked={likedSet.has(msg.id)}
                  onLikeToggle={msg.sender === 'bot' ? onLikeToggle : undefined}
                />
                {isLastBotMessage && !isFollowUp && !hasUnrevealedSubsections && wrapUpState !== 'pending' && (
                  <QuickReplies
                    onSend={onQuickReply}
                    onFocusInput={onFocusInput}
                    visible={!isWaitingForResponse && !isUserTyping && (!isMultiCardMessage || allCardsOpened)}
                    isLastSection={isDreamJobsSection}
                    isWrappedUp={hasWrappedUp}
                    isDeepDive={isDeepDive}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Wrap-up card — replaces the QuickReplies area while the user
              reviews + saves the extracted Discussion Highlights. Anchors
              after the last chat message so it reads as the end of the
              conversation, not a separate dialog. */}
          {wrapUpState === 'pending' && reportId && (
            <WrapUpCard
              reportId={reportId}
              onCompleted={() => onWrapUpCompleted?.()}
              savedResponses={messages
                .filter(
                  (m) =>
                    m.sender === 'bot' &&
                    bookmarkedSet.has(m.id) &&
                    // Exclude report sections (### heading) — they're already in
                    // the report, so only genuinely-saved AI responses carry over.
                    !/^### /m.test(m.content)
                )
                .map((m) => ({ content: m.content, saved_at: m.created_at }))}
            />
          )}

          {/* Post-wrap pill ("Exit to Dashboard"). Rendered OUTSIDE the
              messages loop because the wrap-up click leaves a user
              message as the last message — the in-loop QuickReplies
              wrapper is gated on isLastBotMessage and would skip,
              leaving the user with no exit affordance after refresh. */}
          {wrapUpState === 'completed' && (
            <QuickReplies
              onSend={onQuickReply}
              onFocusInput={onFocusInput}
              visible={!isWaitingForResponse && !isUserTyping}
              isLastSection
              isWrappedUp
              isDeepDive={false}
            />
          )}

          <TypingIndicator
            isVisible={isWaitingForResponse}
            mode={loadingMode}
          />

          {/* Invisible anchor for auto-scrolling */}
          <div ref={bottomRef} />
        </div>
      </div>
    );
  }
);

ChatMessages.displayName = 'ChatMessages';
