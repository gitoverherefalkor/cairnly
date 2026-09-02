import { useTranslation } from 'react-i18next';
import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Send, Mic, MessageCircle, X, FolderOpen, Loader2 } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

export interface ChatInputHandle {
  focus: () => void;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  isSidebarCollapsed?: boolean;
  /** When set, shows an "Asking about: <role>" context chip above the input. */
  askAboutRole?: string | null;
  /** Clears the pending ask-about-role scoping (chip's ✕). */
  onCancelAskAboutRole?: () => void;
  /**
   * While a multi-card section locks the input: how many cards are still
   * unopened. Renders a progress chip pinned above the input, so the user
   * sees why they can't type yet.
   */
  cardsLeftCount?: number | null;
  /** Click on the cards-left chip — scrolls the chat to a collapsed card. */
  onCardsLeftClick?: () => void;
}

const MIN_HEIGHT = 56;
const MAX_HEIGHT = 212; // 8 lines

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(({
  onSend,
  onTypingChange,
  disabled = false,
  placeholder,
  isSidebarCollapsed = false,
  askAboutRole = null,
  onCancelAskAboutRole,
  cardsLeftCount = null,
  onCardsLeftClick,
}, ref) => {
  const { t } = useTranslation('chat');
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice input via shared hook. cleanOnStop: when the user stops dictating,
  // the raw transcript is tidied (punctuation, capitals) by clean-transcript;
  // isCleaning drives a brief spinner and blocks send until the tidy text is in.
  const { isListening, isCleaning, isSupported: hasSpeechRecognition, toggleListening, stopListening } =
    useSpeechRecognition({
      onTranscript: setText,
      existingText: text,
      cleanOnStop: true,
    });

  // Space bar controls dictation: while listening, ANY space press stops it
  // (the user isn't typing during dictation). Document-level so it works
  // regardless of where focus ended up.
  useEffect(() => {
    if (!isListening) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        stopListening();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isListening, stopListening]);

  // Expose focus method so quick replies can focus the input
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Notify parent when user starts/stops typing (drives quick-reply visibility)
  useEffect(() => {
    onTypingChange?.(text.trim().length > 0);
  }, [text, onTypingChange]);

  // Auto-resize textarea on content change
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isCleaning) return;

    // Auto-stop mic when sending — and skip the cleanup pass, whose result
    // would otherwise repopulate the just-cleared field with stale text.
    if (isListening) {
      stopListening({ skipClean: true });
    }

    onSend(trimmed);
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Space in an EMPTY field starts dictation (nobody starts a message with
    // a space). Stopping via space is handled by the document listener above.
    if (
      e.key === ' ' &&
      text.length === 0 &&
      hasSpeechRecognition &&
      !isListening &&
      !isCleaning &&
      !disabled
    ) {
      e.preventDefault();
      void toggleListening();
    }
  };

  const sidebarWidth = isSidebarCollapsed ? '80px' : '320px';

  return (
    <>
      {/* Inline style to apply symmetric sidebar offset on desktop, so the
          input stays centered on the page (sidebar lives on the left). */}
      <style>{`
        .chat-input-root { left: 0; right: 0; }
        @media (min-width: 768px) {
          .chat-input-root { left: ${sidebarWidth}; right: ${sidebarWidth}; }
        }
      `}</style>
      <div className="chat-input-root fixed bottom-0 z-30">
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2">
          <div className="max-w-[800px] mx-auto">
            {/* Card-open progress chip — pinned with the input (same treatment
                as the ask-about chip) so it can't end up half-hidden behind
                the floating input bar. */}
            {cardsLeftCount != null && cardsLeftCount > 0 && (
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  onClick={onCardsLeftClick}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-atlas-teal bg-white border border-atlas-teal/25 rounded-full px-3 py-1.5 shadow-md hover:bg-atlas-teal/5 transition-colors"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  {t('ui.cardsLeft', {
                    count: cardsLeftCount,
                    defaultValue:
                      cardsLeftCount === 1
                        ? '1 card left, tap to expand'
                        : '{{count}} cards left, tap to expand',
                  })}
                </button>
              </div>
            )}
            {/* "Asking about: <role>" context chip — pinned with the input so it
                stays centered and sidebar-offset, sitting just above the box. */}
            {askAboutRole && (
              <div className="mb-2">
                <div className="inline-flex items-center gap-2 max-w-full rounded-full border border-atlas-teal/40 bg-white shadow-md pl-3 pr-2 py-1.5 text-sm">
                  <MessageCircle size={14} className="shrink-0 text-atlas-teal" />
                  <span className="text-atlas-navy min-w-0 truncate">
                    {t('ui.askingAbout')} <span className="font-semibold text-atlas-teal">{askAboutRole}</span>
                  </span>
                  <button
                    type="button"
                    onClick={onCancelAskAboutRole}
                    aria-label="Cancel asking about this role"
                    className="shrink-0 rounded-full p-0.5 text-gray-400 hover:text-atlas-navy hover:bg-gray-100 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                placeholder ??
                (hasSpeechRecognition
                  ? t('ui.inputPlaceholderVoice', { defaultValue: 'Type here or dictate…' })
                  : t('ui.inputPlaceholder'))
              }
              disabled={disabled}
              rows={1}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 sm:px-5 pr-[88px] sm:pr-[104px] py-3 sm:py-4 text-sm sm:text-[0.9375rem] leading-normal font-sans resize-none overflow-y-hidden shadow-md focus:outline-none focus:border-atlas-teal focus:ring-2 focus:ring-atlas-teal/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
            />

            {/* Buttons container — vertically centered against the textarea.
                Tried bottom-anchoring earlier but it visually drifted off-center
                at the default single-line height. Center is the better default. */}
            <div className="absolute right-2 sm:right-3 top-[calc(50%-3px)] -translate-y-1/2 flex items-center gap-1">
              {/* Mic button — only show if browser supports speech recognition */}
              {hasSpeechRecognition && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={disabled || isCleaning}
                  title={
                    isListening
                      ? t('ui.micTitleStop', { defaultValue: 'Stop dictation (space)' })
                      : t('ui.micTitle', { defaultValue: 'Dictate (tip: space starts and stops)' })
                  }
                  className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-md transition-colors ${
                    isListening
                      ? 'text-red-500 bg-red-50 animate-mic-pulse'
                      : 'text-gray-400 hover:text-atlas-teal hover:bg-atlas-teal/5'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isCleaning ? (
                    <Loader2 size={20} className="animate-spin text-atlas-teal" />
                  ) : (
                    <>
                      <Mic size={18} className="sm:hidden" />
                      <Mic size={20} className="hidden sm:block" />
                    </>
                  )}
                </button>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={disabled || !text.trim() || isCleaning}
                title={t('input.send', { defaultValue: 'Send' })}
                className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-atlas-teal rounded-md text-white transition-all hover:bg-atlas-teal/90 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} className="sm:hidden" />
                <Send size={18} className="hidden sm:block" />
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
});

ChatInput.displayName = 'ChatInput';
